import { DriverStatus, RideStatus, SOCKET_EVENTS, SIM, Strategy, type LatLng, type SimStatus } from "@ps02/shared";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { mulberry32 } from "../lib/rng";
import { randomPointInBounds, haversineKm } from "./geo";
import { getRoute } from "./osrm";
import { getActiveOffer, respondToOffer } from "./dispatch";
import { advanceRide, createRide } from "./rides";
import { broadcast, emitToAdmins } from "./realtime";
import { publishDriverLocation } from "./driverTracking";
import { getRuntimeSpeedFactor, setRuntimeSpeedFactor } from "../lib/runtime";

export { mulberry32 };

/* ------------------------------------------------------------------ */
/* Simulator state                                                     */
/* ------------------------------------------------------------------ */

interface SimDriver {
  driverId: string;
  userId: string;
  lat: number;
  lng: number;
  path: LatLng[] | null;
  pathIndex: number;
  target: LatLng | null;
}

interface ScheduledAction {
  at: number;
  run: () => Promise<void>;
}

interface SimState {
  running: boolean;
  seed: number;
  strategy: Strategy;
  speed: number;
  startedAt: number | null;
  tickTimer: NodeJS.Timeout | null;
  requestTimer: NodeJS.Timeout | null;
  drivers: Map<string, SimDriver>;
  actions: ScheduledAction[];
  tickCount: number;
  activeRides: number;
}

const state: SimState = {
  running: false,
  seed: 1,
  strategy: Strategy.SMART,
  speed: SIM.speed,
  startedAt: null,
  tickTimer: null,
  requestTimer: null,
  drivers: new Map(),
  actions: [],
  tickCount: 0,
  activeRides: 0,
};

const SIM_DRIVER_PASSWORD = "simulated-driver";
let cachedHash: string | null = null;

async function simPasswordHash(): Promise<string> {
  if (!cachedHash) cachedHash = await bcrypt.hash(SIM_DRIVER_PASSWORD, 4);
  return cachedHash;
}

/** Create the simulated fleet + passenger accounts if they do not exist yet. */
async function ensureSimulatedAccounts(numDrivers: number): Promise<void> {
  const passwordHash = await simPasswordHash();
  const random = mulberry32(9_001);

  for (let index = 1; index <= numDrivers; index += 1) {
    const email = `sim-driver-${index}@demo.com`;
    const point = randomPointInBounds(random);

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: `Sim Driver ${index}`,
        email,
        passwordHash,
        role: "DRIVER",
      },
    });

    await prisma.driver.upsert({
      where: { userId: user.id },
      update: { isSimulated: true },
      create: {
        userId: user.id,
        vehicleType: index % 3 === 0 ? "SUV" : index % 2 === 0 ? "HATCHBACK" : "SEDAN",
        status: DriverStatus.OFFLINE,
        lat: point.lat,
        lng: point.lng,
        acceptanceRate: 0.6 + random() * 0.39,
        isSimulated: true,
      },
    });
  }

  for (let index = 1; index <= 3; index += 1) {
    const email = `sim-passenger-${index}@demo.com`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: `Sim Passenger ${index}`,
        email,
        passwordHash,
        role: "PASSENGER",
      },
    });
  }
}

const KM_PER_TICK = 0.045;

function pathFromRoute(polyline: LatLng[], from: LatLng, to: LatLng): LatLng[] {
  if (polyline.length >= 2) {
    return [from, ...polyline, to];
  }
  return [from, to];
}

function moveAlongPath(driver: SimDriver, km: number): boolean {
  if (!driver.path) return false;
  let remaining = km;

  while (remaining > 0 && driver.pathIndex < driver.path.length - 1) {
    const from = driver.path[driver.pathIndex];
    const to = driver.path[driver.pathIndex + 1];
    const segment = haversineKm(from, to);

    if (segment <= 1e-6) {
      driver.pathIndex += 1;
      continue;
    }

    if (segment <= remaining) {
      remaining -= segment;
      driver.pathIndex += 1;
      driver.lat = to.lat;
      driver.lng = to.lng;
    } else {
      const t = remaining / segment;
      driver.lat = from.lat + (to.lat - from.lat) * t;
      driver.lng = from.lng + (to.lng - from.lng) * t;
      remaining = 0;
    }
  }

  return driver.pathIndex >= driver.path.length - 1;
}

async function directMovement(driver: SimDriver, target: LatLng) {
  const route = await getRoute({ lat: driver.lat, lng: driver.lng }, target);
  driver.path = pathFromRoute(route.polyline, { lat: driver.lat, lng: driver.lng }, target);
  driver.pathIndex = 0;
  driver.target = target;
}

function schedule(delayMs: number, run: () => Promise<void>) {
  state.actions.push({ at: Date.now() + Math.max(50, delayMs), run });
}

async function processActions() {
  const now = Date.now();
  const due = state.actions.filter((action) => action.at <= now);
  if (due.length === 0) return;
  state.actions = state.actions.filter((action) => action.at > now);

  for (const action of due) {
    try {
      await action.run();
    } catch (error) {
      console.error("[sim] scheduled action failed", error);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Tick loop                                                           */
/* ------------------------------------------------------------------ */

async function tick() {
  if (!state.running) return;
  state.tickCount += 1;
  const factor = getRuntimeSpeedFactor();

  for (const driver of state.drivers.values()) {
    if (!driver.path) continue;
    const arrived = moveAlongPath(driver, KM_PER_TICK * factor);

    emitToAdmins(SOCKET_EVENTS.DRIVER_LOCATION, {
      driverId: driver.driverId,
      lat: driver.lat,
      lng: driver.lng,
      status: "SIMULATED",
      at: new Date().toISOString(),
    });
    await publishDriverLocation(driver.driverId, { lat: driver.lat, lng: driver.lng });

    if (arrived) {
      driver.path = null;
      driver.target = null;
    }

    // Persist positions periodically to keep nearby-driver queries accurate.
    if (state.tickCount % 5 === 0) {
      await prisma.driver
        .update({ where: { id: driver.driverId }, data: { lat: driver.lat, lng: driver.lng } })
        .catch(() => undefined);
    }
  }

  await processActions();

  const status = getSimulationStatus();
  broadcast(SOCKET_EVENTS.SIM_TICK, { ...status, at: new Date().toISOString() });
}

/* ------------------------------------------------------------------ */
/* Request generation + automatic driver behaviour                     */
/* ------------------------------------------------------------------ */

async function createSimulatedRequest() {
  if (!state.running) return;
  const random = mulberry32(state.seed + state.tickCount * 7919);

  const passengers = await prisma.user.findMany({
    where: { email: { startsWith: "sim-passenger-" } },
    select: { id: true },
  });
  if (passengers.length === 0) return;

  const passenger = passengers[Math.floor(random() * passengers.length)];
  const pickup = randomPointInBounds(random);
  const drop = randomPointInBounds(random);

  const ride = await createRide(
    passenger.id,
    { pickup, drop },
    { strategy: state.strategy, simRunId: "simulator" },
  );

  state.activeRides += 1;
  await autoRespondToOffer(ride.id);
}

async function autoRespondToOffer(rideId: string) {
  const offer = getActiveOffer(rideId);
  if (!offer) return;
  const driver = state.drivers.get(offer.driverId);
  if (!driver) return;

  const record = await prisma.driver.findUnique({ where: { id: offer.driverId } });
  if (!record) return;

  const random = mulberry32(state.seed + Number.parseInt(rideId.slice(-6), 36) + state.tickCount);
  const willAccept = random() < record.acceptanceRate;
  const delayMs = (1_000 + random() * 7_000) / getRuntimeSpeedFactor();

  schedule(delayMs, async () => {
    try {
      if (!getActiveOffer(rideId)) return;
      const result = await respondToOffer({
        rideId,
        driverId: offer.driverId,
        accept: willAccept,
      });

      if (willAccept) {
        await onDriverAccepted(rideId, offer.driverId);
      } else {
        await autoRespondToOffer(rideId);
      }
      void result;
    } catch (error) {
      console.error("[sim] auto response failed", error);
    }
  });
}

async function onDriverAccepted(rideId: string, driverId: string) {
  const driver = state.drivers.get(driverId);
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!driver || !ride) return;

  await directMovement(driver, { lat: ride.pickupLat, lng: ride.pickupLng });

  const factor = getRuntimeSpeedFactor();
  const etaWallMs = (ride.promisedEtaMin * 60_000) / factor;

  schedule(Math.min(etaWallMs * 0.5, 20_000), async () => {
    await advanceRide(rideId, driverId, RideStatus.ARRIVING).catch(() => undefined);
  });

  schedule(Math.min(etaWallMs, 40_000), async () => {
    try {
      await advanceRide(rideId, driverId, RideStatus.ONGOING);
      await directMovement(driver, { lat: ride.dropLat, lng: ride.dropLng });
    } catch {
      /* ride may have been cancelled */
    }
  });

  const tripWallMs = Math.max(8_000, (ride.etaMin * 60_000) / factor);
  schedule(Math.min(etaWallMs, 40_000) + tripWallMs, async () => {
    try {
      await advanceRide(rideId, driverId, RideStatus.COMPLETED);
      state.activeRides = Math.max(0, state.activeRides - 1);
    } catch {
      /* ride may have been cancelled */
    }
  });
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface StartSimulationOptions {
  seed?: number;
  strategy?: Strategy;
  speed?: number;
  numDrivers?: number;
}

export async function startSimulation(options: StartSimulationOptions = {}): Promise<SimStatus> {
  if (state.running) return getSimulationStatus();

  state.seed = options.seed ?? Math.floor(Math.random() * 1_000_000);
  state.strategy = options.strategy ?? Strategy.SMART;
  state.speed = Math.max(1, options.speed ?? SIM.speed);
  state.startedAt = Date.now();
  state.actions = [];
  state.tickCount = 0;
  state.activeRides = 0;
  state.running = true;

  setRuntimeSpeedFactor(state.speed);
  await ensureSimulatedAccounts(options.numDrivers ?? SIM.numDrivers);

  const drivers = await prisma.driver.findMany({
    where: { isSimulated: true, user: { email: { startsWith: "sim-driver-" } } },
    include: { user: { select: { id: true } } },
  });

  state.drivers.clear();
  for (const driver of drivers) {
    state.drivers.set(driver.id, {
      driverId: driver.id,
      userId: driver.user.id,
      lat: driver.lat,
      lng: driver.lng,
      path: null,
      pathIndex: 0,
      target: null,
    });
    await prisma.driver.update({
      where: { id: driver.id },
      data: { status: DriverStatus.AVAILABLE, lastIdleSince: new Date() },
    });
  }

  state.tickTimer = setInterval(() => {
    void tick();
  }, SIM.locationEmitMs);
  state.requestTimer = setInterval(() => {
    void createSimulatedRequest().catch((error) => console.error("[sim] request failed", error));
  }, Math.max(2_000, 8_000 / state.speed));

  emitToAdmins(SOCKET_EVENTS.NOTIFICATION, {
    kind: "success",
    title: "Simulation started",
    message: `Seed ${state.seed} · ${state.strategy} · ${state.drivers.size} drivers`,
    at: new Date().toISOString(),
  });

  return getSimulationStatus();
}

export function stopSimulation(): SimStatus {
  state.running = false;
  if (state.tickTimer) clearInterval(state.tickTimer);
  if (state.requestTimer) clearInterval(state.requestTimer);
  state.tickTimer = null;
  state.requestTimer = null;
  state.actions = [];
  setRuntimeSpeedFactor(1);

  emitToAdmins(SOCKET_EVENTS.NOTIFICATION, {
    kind: "info",
    title: "Simulation stopped",
    message: `${state.drivers.size} simulated drivers are now idle`,
    at: new Date().toISOString(),
  });

  return getSimulationStatus();
}

export async function resetSimulation(): Promise<SimStatus> {
  stopSimulation();
  state.drivers.clear();
  state.tickCount = 0;
  state.activeRides = 0;
  state.startedAt = null;

  await prisma.driver.updateMany({
    where: { isSimulated: true },
    data: { status: DriverStatus.OFFLINE },
  });

  return getSimulationStatus();
}

export function getSimulationStatus(): SimStatus {
  const simTime = state.startedAt
    ? new Date(state.startedAt + (Date.now() - state.startedAt) * state.speed).toISOString()
    : new Date().toISOString();

  return {
    running: state.running,
    seed: state.seed,
    strategy: state.strategy,
    speed: state.speed,
    simTime,
    drivers: state.drivers.size,
    activeRides: state.activeRides,
  };
}

export function isSimulationRunning(): boolean {
  return state.running;
}

/** Exposed for chaos tooling: simulated drivers currently in the fleet. */
export function listSimulatedDrivers(): string[] {
  return [...state.drivers.keys()];
}

/** Used by chaos "killDriver": take a driver out of service immediately. */
export async function killSimulatedDriver(driverId: string): Promise<void> {
  state.drivers.delete(driverId);
  await prisma.driver
    .update({ where: { id: driverId }, data: { status: DriverStatus.OFFLINE } })
    .catch(() => undefined);
}
