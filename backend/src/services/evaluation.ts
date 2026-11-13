import { ALLOC_WEIGHTS, Strategy, type Metrics, type SimRunRecord } from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { mulberry32 } from "../lib/rng";
import { haversineKm, randomPointInBounds } from "./geo";
import { rankDrivers, rankNearestOnly, type RankCandidate } from "./matching";
import { pickupEtaMinutes } from "./allocation";

/** Average road speed used inside the headless model (matches the OSRM fallback). */
const SPEED_KMH = 24;
const ROAD_FACTOR = 1.3;
const REQUEST_INTERVAL_SEC = 20;

export interface EvaluationRequest {
  pickup: { lat: number; lng: number };
  drop: { lat: number; lng: number };
  atSec: number;
}

interface DriverState {
  id: string;
  lat: number;
  lng: number;
  acceptanceRate: number;
  availableAtSec: number;
  busySeconds: number;
  completed: number;
  workload: number;
  lastIdleAtSec: number;
}

export interface EvaluationResult {
  nearest: Metrics;
  smart: Metrics;
  runs: SimRunRecord[];
}

/** Same request stream for both strategies, so the comparison is fair. */
export function buildRequestStream(
  seed: number,
  simulatedMinutes: number,
  numDrivers: number,
): EvaluationRequest[] {
  const random = mulberry32(seed);
  const requests: EvaluationRequest[] = [];
  const totalSec = simulatedMinutes * 60;
  const expected = Math.max(1, Math.round(totalSec / REQUEST_INTERVAL_SEC));

  let cursor = 0;
  for (let index = 0; index < expected; index += 1) {
    cursor += REQUEST_INTERVAL_SEC * (0.5 + random());
    if (cursor > totalSec) break;
    requests.push({
      pickup: randomPointInBounds(random),
      drop: randomPointInBounds(random),
      atSec: cursor,
    });
  }

  void numDrivers;
  return requests;
}

function freshDrivers(seed: number, count: number): DriverState[] {
  const random = mulberry32(seed + 13);
  return Array.from({ length: count }, (_, index) => {
    const point = randomPointInBounds(random);
    return {
      id: `driver-${index}`,
      lat: point.lat,
      lng: point.lng,
      acceptanceRate: 0.6 + random() * 0.39,
      availableAtSec: 0,
      busySeconds: 0,
      completed: 0,
      workload: 0,
      lastIdleAtSec: 0,
    };
  });
}

/**
 * Headless run of one allocation strategy over a fixed request stream.
 * No database writes and no sockets: this is a pure planning simulation that
 * reuses the exact ranking functions the live dispatcher uses.
 */
export function runHeadless(
  seed: number,
  strategy: Strategy,
  simulatedMinutes: number,
  numDrivers: number,
): Metrics {
  const requests = buildRequestStream(seed, simulatedMinutes, numDrivers);
  const drivers = freshDrivers(seed, numDrivers);
  const random = mulberry32(seed + 101);

  let completed = 0;
  let cancelled = 0;
  let reassignments = 0;
  let waitSeconds = 0;
  let pickupEtaSum = 0;

  for (const request of requests) {
    const candidates: RankCandidate[] = [];

    for (const driver of drivers) {
      if (driver.availableAtSec > request.atSec) continue;
      const distanceKm = haversineKm(request.pickup, { lat: driver.lat, lng: driver.lng });
      if (distanceKm > 5) continue;
      candidates.push({
        driverId: driver.id,
        distanceKm,
        etaMin: pickupEtaMinutes(distanceKm),
        workload: driver.workload,
        acceptanceRate: driver.acceptanceRate,
        idleMin: Math.max(0, (request.atSec - driver.lastIdleAtSec) / 60),
      });
    }

    const ranked =
      candidates.length === 0
        ? []
        : strategy === Strategy.NEAREST
          ? rankNearestOnly(candidates)
          : rankDrivers(candidates, ALLOC_WEIGHTS);

    let assigned: DriverState | null = null;
    let assignedEta = 0;

    for (const entry of ranked) {
      const driver = drivers.find((candidate) => candidate.id === entry.driverId);
      if (!driver) continue;
      if (random() > driver.acceptanceRate) {
        reassignments += 1;
        continue;
      }
      assigned = driver;
      assignedEta = entry.raw.etaMin;
      break;
    }

    if (!assigned) {
      cancelled += 1;
      continue;
    }

    const acceptanceDelaySec = 1 + random() * 7;
    const tripMinutes = (haversineKm(request.pickup, request.drop) * ROAD_FACTOR * 60) / SPEED_KMH;
    const busySeconds = acceptanceDelaySec + assignedEta * 60 + tripMinutes * 60;

    assigned.availableAtSec = request.atSec + busySeconds;
    assigned.busySeconds += busySeconds;
    assigned.completed += 1;
    assigned.workload += assignedEta + tripMinutes;
    assigned.lastIdleAtSec = assigned.availableAtSec;

    waitSeconds += acceptanceDelaySec;
    pickupEtaSum += assignedEta;
    completed += 1;
  }

  const simulatedSeconds = simulatedMinutes * 60;
  const totalBusy = drivers.reduce((sum, driver) => sum + driver.busySeconds, 0);
  const perDriver = drivers.map((driver) => driver.completed);

  return {
    strategy,
    seed,
    simulatedMinutes,
    ridesRequested: requests.length,
    ridesCompleted: completed,
    ridesCancelled: cancelled,
    avgPassengerWaitSec: round2(completed > 0 ? waitSeconds / completed : 0),
    avgPickupEtaMin: round2(completed > 0 ? pickupEtaSum / completed : 0),
    driverUtilization: round4(totalBusy / (drivers.length * simulatedSeconds)),
    completionRate: round4(requests.length > 0 ? completed / requests.length : 0),
    reassignmentCount: reassignments,
    fairnessStdDev: round4(standardDeviation(perDriver)),
  };
}

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Run NEAREST and SMART on the same seed and persist both SimRun rows. */
export async function evaluateStrategies(params: {
  seed: number;
  simulatedMinutes?: number;
  numDrivers?: number;
}): Promise<EvaluationResult> {
  const simulatedMinutes = params.simulatedMinutes ?? 30;
  const numDrivers = params.numDrivers ?? 25;

  const nearest = runHeadless(params.seed, Strategy.NEAREST, simulatedMinutes, numDrivers);
  const smart = runHeadless(params.seed, Strategy.SMART, simulatedMinutes, numDrivers);

  const rows = await prisma.$transaction([
    prisma.simRun.create({
      data: { seed: params.seed, strategy: "NEAREST", metrics: nearest as unknown as object },
    }),
    prisma.simRun.create({
      data: { seed: params.seed, strategy: "SMART", metrics: smart as unknown as object },
    }),
  ]);

  const runs: SimRunRecord[] = rows.map((row) => ({
    id: row.id,
    seed: row.seed,
    strategy: row.strategy as Strategy,
    metrics: row.metrics as unknown as Metrics,
    createdAt: row.createdAt.toISOString(),
  }));

  return { nearest, smart, runs };
}

export async function listLatestRuns(limit = 20): Promise<SimRunRecord[]> {
  const rows = await prisma.simRun.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return rows.map((row) => ({
    id: row.id,
    seed: row.seed,
    strategy: row.strategy as Strategy,
    metrics: row.metrics as unknown as Metrics,
    createdAt: row.createdAt.toISOString(),
  }));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
