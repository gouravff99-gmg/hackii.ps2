import { Prisma, RideStatus } from "@prisma/client";
import {
  DriverStatus,
  SOCKET_EVENTS,
  Strategy,
  TIMEOUTS,
  type RideOfferPayload,
} from "@ps02/shared";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { scaledMs } from "../lib/runtime";
import { ApiError } from "../utils/ApiError";
import { allocateDemoDriver, allocateDriver, type AllocationResult } from "./allocation";
import { isDriverEligible } from "./driverEligibility";
import {
  appendRideEvent,
  transitionRide,
  type RideWithPeople,
} from "./rideStateMachine";
import { emitToUser, notifyUser } from "./realtime";

/** Maximum dispatch rounds before we stop retrying and tell the passenger. */
const MAX_DISPATCH_ATTEMPTS = 3;
/** Delay between empty-fleet retries. */
const RETRY_DELAY_MS = 10_000;

interface OfferState {
  rideId: string;
  driverId: string;
  driverUserId: string;
  etaMin: number;
  expiresAt: number;
  timeout: NodeJS.Timeout;
}

interface AttemptState {
  count: number;
  excluded: Set<string>;
}

const activeOffers = new Map<string, OfferState>();
const attempts = new Map<string, AttemptState>();
const retryTimers = new Map<string, NodeJS.Timeout>();
const reservedDrivers = new Set<string>();

function attemptFor(rideId: string): AttemptState {
  let state = attempts.get(rideId);
  if (!state) {
    state = { count: 0, excluded: new Set<string>() };
    attempts.set(rideId, state);
  }
  return state;
}

export function clearDispatchState(rideId: string) {
  clearOffer(rideId);
  const timer = retryTimers.get(rideId);
  if (timer) {
    clearTimeout(timer);
    retryTimers.delete(rideId);
  }
  attempts.delete(rideId);
}

function clearOffer(rideId: string, keepDriverReserved = false) {
  const offer = activeOffers.get(rideId);
  if (offer) {
    clearTimeout(offer.timeout);
    activeOffers.delete(rideId);
    if (!keepDriverReserved) reservedDrivers.delete(offer.driverId);
  }
}

export function getActiveOffer(rideId: string): OfferState | undefined {
  return activeOffers.get(rideId);
}

export async function getDriverOffer(driverId: string): Promise<RideOfferPayload | null> {
  const offer = [...activeOffers.values()].find((current) => current.driverId === driverId);
  if (!offer || offer.expiresAt <= Date.now()) return null;

  const ride = await prisma.ride.findUnique({ where: { id: offer.rideId } });
  if (
    !ride ||
    (ride.status !== RideStatus.REQUESTED && ride.status !== RideStatus.REASSIGNING)
  ) {
    clearOffer(offer.rideId);
    return null;
  }

  const timeoutMs = Math.max(0, offer.expiresAt - Date.now());
  return {
    rideId: ride.id,
    pickup: { lat: ride.pickupLat, lng: ride.pickupLng },
    drop: { lat: ride.dropLat, lng: ride.dropLng },
    distanceKm: ride.distanceKm,
    etaMin: offer.etaMin,
    fareEstimate: ride.fareEstimate,
    expiresAt: new Date(offer.expiresAt).toISOString(),
    timeoutMs,
    demoMode: env.demoMode,
  };
}

/** True when this driver currently holds an unexpired offer for the ride. */
export function hasOffer(rideId: string, driverId: string): boolean {
  return activeOffers.get(rideId)?.driverId === driverId;
}

/**
 * Find the best driver for a ride and send them a timed offer.
 * Safe to call repeatedly: it only runs while the ride is REQUESTED/REASSIGNING.
 */
export async function dispatchRide(
  rideId: string,
  strategy: Strategy = Strategy.SMART,
): Promise<AllocationResult | null> {
  clearOffer(rideId);

  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) return null;
  if (ride.status !== RideStatus.REQUESTED && ride.status !== RideStatus.REASSIGNING) return null;

  const attempt = attemptFor(rideId);
  const pickup = { lat: ride.pickupLat, lng: ride.pickupLng };
  const result =
    env.demoMode && ride.simRunId !== "simulator"
      ? await allocateDemoDriver({ pickup, excludeDriverIds: [...attempt.excluded] })
      : await allocateDriver({
        pickup,
        strategy,
        excludeDriverIds: [...attempt.excluded],
        includeSimulated: ride.simRunId === "simulator",
      });

  await prisma.ride.update({
    where: { id: rideId },
    data: { allocationScores: result.ranked as unknown as Prisma.InputJsonValue },
  });

  if (!result.chosen) {
    if (env.demoMode && result.retryable) {
      scheduleRetry(rideId, strategy);
      return result;
    }
    attempt.count += 1;
    if (attempt.count > MAX_DISPATCH_ATTEMPTS) {
      await appendRideEvent(rideId, "NOTIFICATION", "No driver could be assigned");
      notifyUser(
        ride.passengerId,
        "warning",
        "No drivers available",
        "We could not find a driver for this ride. Please try again in a moment.",
        rideId,
      );
      return result;
    }

    scheduleRetry(rideId, strategy);
    return result;
  }

  if (reservedDrivers.has(result.chosen.driverId)) {
    if (env.demoMode) {
      scheduleRetry(rideId, strategy);
      return result;
    }
    attempt.excluded.add(result.chosen.driverId);
    return dispatchRide(rideId, strategy);
  }
  reservedDrivers.add(result.chosen.driverId);

  let driver;
  try {
    driver = await prisma.driver.findUnique({
      where: { id: result.chosen.driverId },
      include: { user: { select: { id: true } } },
    });
  } catch (error) {
    reservedDrivers.delete(result.chosen.driverId);
    throw error;
  }
  if (!driver || driver.status !== DriverStatus.AVAILABLE) {
    reservedDrivers.delete(result.chosen.driverId);
    if (env.demoMode && driver?.status === DriverStatus.BUSY) {
      scheduleRetry(rideId, strategy);
      return result;
    }
    if (!driver) {
      attempt.excluded.add(result.chosen.driverId);
      return dispatchRide(rideId, strategy);
    }
    // The chosen driver became busy between ranking and offering; try again.
    attempt.excluded.add(result.chosen.driverId);
    return dispatchRide(rideId, strategy);
  }

  const timeoutMs = scaledMs(TIMEOUTS.driverResponseMs);
  const expiresAt = Date.now() + timeoutMs;

  const payload: RideOfferPayload = {
    rideId,
    pickup: { lat: ride.pickupLat, lng: ride.pickupLng },
    drop: { lat: ride.dropLat, lng: ride.dropLng },
    distanceKm: ride.distanceKm,
    etaMin: result.chosen.raw.etaMin,
    fareEstimate: ride.fareEstimate,
    expiresAt: new Date(expiresAt).toISOString(),
    timeoutMs,
    demoMode: env.demoMode,
  };

  const timeout = setTimeout(() => {
    void handleOfferExpiry(rideId, driver.id).catch((err) => {
      console.error("[dispatch] offer timeout handler failed", err);
    });
  }, timeoutMs);

  try {
    activeOffers.set(rideId, {
      rideId,
      driverId: driver.id,
      driverUserId: driver.user.id,
      etaMin: result.chosen.raw.etaMin,
      expiresAt,
      timeout,
    });

    emitToUser(driver.user.id, SOCKET_EVENTS.RIDE_OFFER, payload);
    await appendRideEvent(rideId, "OFFER_SENT", `Offer sent to driver ${driver.id}`, {
      driverId: driver.id,
      strategy,
      score: result.chosen.score,
      timeoutMs,
      demoMode: env.demoMode,
      etaMode: env.demoMode ? "simulated" : "estimated",
    });
  } catch (error) {
    clearOffer(rideId);
    throw error;
  }

  return result;
}

function scheduleRetry(rideId: string, strategy: Strategy) {
  const existing = retryTimers.get(rideId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    retryTimers.delete(rideId);
    void dispatchRide(rideId, strategy).catch((err) => {
      console.error("[dispatch] retry failed", err);
    });
  }, scaledMs(RETRY_DELAY_MS));
  retryTimers.set(rideId, timer);
}

async function handleOfferExpiry(rideId: string, driverId: string) {
  const offer = activeOffers.get(rideId);
  if (!offer || offer.driverId !== driverId) return;

  clearOffer(rideId);
  await appendRideEvent(rideId, "TIMEOUT", "Driver did not respond in time", { driverId });
  await handleFailedDriver(rideId, driverId, "timeout");
}

/** Shared failure path for reject / timeout / driver cancellation. */
async function handleFailedDriver(
  rideId: string,
  driverId: string,
  reason: "reject" | "timeout" | "cancel",
): Promise<void> {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) return;

  const attempt = attemptFor(rideId);
  attempt.excluded.add(driverId);

  await adjustAcceptanceRate(driverId, reason === "cancel" ? -0.05 : -0.02);
  await releaseDriver(driverId);

  const stillOpen = ride.status === RideStatus.REQUESTED || ride.status === RideStatus.REASSIGNING;
  if (!stillOpen) return;

  // A ride that already had a driver moves through REASSIGNING; a brand-new
  // request simply goes back into the matching pool.
  if (ride.driverId && ride.status !== RideStatus.REASSIGNING) {
    await transitionRide({
      rideId,
      to: RideStatus.REASSIGNING,
      message:
        reason === "timeout"
          ? "Previous driver did not respond"
          : reason === "cancel"
            ? "Previous driver cancelled"
            : "Previous driver declined",
      eventType: reason === "timeout" ? "TIMEOUT" : reason === "cancel" ? "DRIVER_CANCELLED" : "REJECTED",
      update: { driver: { disconnect: true } },
      payload: { driverId },
    });

    notifyUser(
      ride.passengerId,
      "warning",
      "Finding a new driver",
      "Your driver was changed. We are assigning the next best driver now.",
      rideId,
    );
    emitToUser(ride.passengerId, SOCKET_EVENTS.RIDE_REASSIGNED, {
      rideId,
      previousDriverId: driverId,
      newDriverId: null,
      etaMin: ride.promisedEtaMin,
      reason,
      at: new Date().toISOString(),
    });
  } else if (ride.driverId) {
    await prisma.ride.update({ where: { id: rideId }, data: { driver: { disconnect: true } } });
  }

  await dispatchRide(rideId);
}

async function releaseDriver(driverId: string) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) return;

  // Only free the driver if they are not attached to another active ride.
  const otherActive = await prisma.ride.count({
    where: {
      driverId,
      status: {
        in: [
          RideStatus.ACCEPTED,
          RideStatus.ARRIVING,
          RideStatus.ARRIVED,
          RideStatus.ONGOING,
        ],
      },
    },
  });
  if (otherActive > 0) return;

  await prisma.driver.update({
    where: { id: driverId },
    data: {
      status: DriverStatus.AVAILABLE,
      lastIdleSince: new Date(),
    },
  });
  reservedDrivers.delete(driverId);
}

async function adjustAcceptanceRate(driverId: string, delta: number) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) return;
  const next = Math.min(1, Math.max(0, driver.acceptanceRate + delta));
  await prisma.driver.update({ where: { id: driverId }, data: { acceptanceRate: next } });
}

/**
 * Driver accepts or rejects an active offer. This is the single entry point
 * used by both the REST route and the socket handler.
 */
export async function respondToOffer(params: {
  rideId: string;
  driverId: string;
  accept: boolean;
}): Promise<RideWithPeople> {
  const { rideId, driverId, accept } = params;
  const offer = activeOffers.get(rideId);

  if (!offer || offer.driverId !== driverId) {
    throw ApiError.conflict("This ride offer is no longer active");
  }

  clearOffer(rideId, accept);

  let ride;
  try {
    ride = await prisma.ride.findUnique({ where: { id: rideId } });
  } catch (error) {
    if (accept) reservedDrivers.delete(driverId);
    throw error;
  }
  if (!ride && accept) reservedDrivers.delete(driverId);
  if (!ride) throw ApiError.notFound("Ride not found");
  if (ride.status !== RideStatus.REQUESTED && ride.status !== RideStatus.REASSIGNING) {
    if (accept) reservedDrivers.delete(driverId);
    throw ApiError.conflict("This ride can no longer be accepted");
  }

  if (!accept) {
    await appendRideEvent(rideId, "REJECTED", "Driver declined the offer", { driverId });
    await handleFailedDriver(rideId, driverId, "reject");
    const refreshed = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { passenger: true, driver: { include: { user: true } } },
    });
    return refreshed as RideWithPeople;
  }

  let driver;
  try {
    driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        onboarding: { include: { documents: { select: { status: true, expiryDate: true } } } },
      },
    });
  } catch (error) {
    reservedDrivers.delete(driverId);
    throw error;
  }
  if (!driver) {
    reservedDrivers.delete(driverId);
    throw ApiError.notFound("Driver profile not found");
  }
  if (!isDriverEligible(driver, { includeSimulated: ride.simRunId === "simulator" })) {
    reservedDrivers.delete(driverId);
    throw ApiError.forbidden("Driver onboarding approval is required before accepting rides");
  }

  const promisedEtaMin = Math.max(1, Math.round(offer.etaMin));
  let updated: RideWithPeople;
  try {
    updated = await transitionRide({
      rideId,
      to: RideStatus.ACCEPTED,
      message: `Driver accepted the ride (ETA ${promisedEtaMin} min)`,
      update: {
        driver: { connect: { id: driverId } },
        acceptedAt: new Date(),
        promisedEtaMin,
      },
      payload: { driverId, etaMin: promisedEtaMin, demoMode: env.demoMode },
      etaMin: promisedEtaMin,
    });

    await prisma.driver.update({
      where: { id: driverId },
      data: {
        status: DriverStatus.BUSY,
        acceptanceRate: Math.min(1, driver.acceptanceRate + 0.01),
      },
    });
  } catch (error) {
    reservedDrivers.delete(driverId);
    throw error;
  }
  reservedDrivers.delete(driverId);

  attempts.delete(rideId);
  const retry = retryTimers.get(rideId);
  if (retry) {
    clearTimeout(retry);
    retryTimers.delete(rideId);
  }

  notifyUser(
    ride.passengerId,
    "success",
    "Driver on the way",
    `${driver.user.name} accepted your ride and will arrive in about ${promisedEtaMin} min.`,
    rideId,
  );

  return updated;
}

/** Driver cancels after accepting; triggers reassignment (Feature 5). */
export async function driverCancelRide(rideId: string, driverId: string): Promise<void> {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) throw ApiError.notFound("Ride not found");
  if (ride.driverId !== driverId) throw ApiError.forbidden("This ride is not assigned to you");

  if (
    ride.status !== RideStatus.ACCEPTED &&
    ride.status !== RideStatus.ARRIVING &&
    ride.status !== RideStatus.ARRIVED &&
    ride.status !== RideStatus.ONGOING
  ) {
    throw ApiError.conflict("This ride can no longer be cancelled by the driver");
  }

  await transitionRide({
    rideId,
    to: RideStatus.REASSIGNING,
    message: "Driver cancelled the ride",
    eventType: "DRIVER_CANCELLED",
    update: { driver: { disconnect: true } },
    payload: { driverId },
  });

  await adjustAcceptanceRate(driverId, -0.05);
  await releaseDriver(driverId);

  notifyUser(
    ride.passengerId,
    "warning",
    "Finding a new driver",
    "Your driver was changed. We are assigning the next best driver now.",
    rideId,
  );

  await dispatchRide(rideId);
}

/**
 * Delay trigger: if the remaining trip at current progress implies an ETA more
 * than `TIMEOUTS.delayThreshold` above the promised ETA, reassign.
 */
export async function checkDelayAndReassign(
  rideId: string,
  actualEtaMin: number,
): Promise<boolean> {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride || !ride.driverId) return false;
  if (
    ride.status !== RideStatus.ACCEPTED &&
    ride.status !== RideStatus.ARRIVING &&
    ride.status !== RideStatus.ARRIVED
  ) return false;

  const promised = Math.max(1, ride.promisedEtaMin);
  const overrun = (actualEtaMin - promised) / promised;
  if (overrun <= TIMEOUTS.delayThreshold) return false;

  const driverId = ride.driverId;
  await appendRideEvent(rideId, "DELAYED", `Actual ETA ${actualEtaMin} min exceeds promised ${promised} min`, {
    driverId,
    actualEtaMin,
    promisedEtaMin: promised,
  });

  await transitionRide({
    rideId,
    to: RideStatus.REASSIGNING,
    message: "Driver is delayed beyond the threshold",
    eventType: "REASSIGNING",
    update: { driver: { disconnect: true } },
    payload: { driverId, actualEtaMin, promisedEtaMin: promised },
  });

  await releaseDriver(driverId);

  notifyUser(
    ride.passengerId,
    "warning",
    "Finding a new driver",
    `Your driver was changed. A new driver is being assigned.`,
    rideId,
  );

  await dispatchRide(rideId);
  return true;
}
