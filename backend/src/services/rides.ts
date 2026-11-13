import { Prisma, RideStatus } from "@prisma/client";
import {
  Strategy,
  type EstimateResponse,
  type LatLng,
  type RideStatusPayload,
} from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { computeFare } from "./fare";
import { getRoute } from "./osrm";
import { validateRidePoints } from "./bookingValidation";
import { surgeForPickup } from "./zones";
import { appendRideEvent, transitionRide } from "./rideStateMachine";
import { clearDispatchState, dispatchRide } from "./dispatch";
import { notifyUser } from "./realtime";

const ACTIVE_STATUSES: RideStatus[] = [
  RideStatus.REQUESTED,
  RideStatus.ACCEPTED,
  RideStatus.ARRIVING,
  RideStatus.ONGOING,
  RideStatus.REASSIGNING,
];

export interface RidePlaceInput {
  pickup: LatLng;
  drop: LatLng;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Distance, ETA, surge-adjusted fare and the route polyline for a trip. */
export async function estimateRide(input: RidePlaceInput): Promise<EstimateResponse> {
  validateRidePoints(input.pickup, input.drop);

  const route = await getRoute(input.pickup, input.drop);
  if (
    !Number.isFinite(route.distanceKm) ||
    route.distanceKm <= 0 ||
    !Number.isFinite(route.durationMin) ||
    route.durationMin <= 0
  ) {
    throw ApiError.badRequest("A valid route could not be calculated for these locations");
  }
  const surge = await surgeForPickup(input.pickup.lat, input.pickup.lng);
  const fare = computeFare(route.distanceKm, route.durationMin, surge);

  return {
    distanceKm: round2(route.distanceKm),
    etaMin: round2(route.durationMin),
    durationMin: round2(route.durationMin),
    fare,
    surge,
    polyline: route.polyline,
    source: route.source,
  };
}

export async function createRide(
  passengerId: string,
  input: RidePlaceInput,
  options: { strategy?: Strategy; simRunId?: string } = {},
) {
  validateRidePoints(input.pickup, input.drop);

  const estimate = await estimateRide(input);
  const promisedEtaMin = Math.max(1, Math.round(estimate.etaMin));

  const ride = await prisma.ride.create({
    data: {
      passengerId,
      pickupLat: input.pickup.lat,
      pickupLng: input.pickup.lng,
      dropLat: input.drop.lat,
      dropLng: input.drop.lng,
      status: RideStatus.REQUESTED,
      distanceKm: estimate.distanceKm,
      etaMin: estimate.etaMin,
      fareEstimate: estimate.fare,
      surgeMultiplier: estimate.surge,
      promisedEtaMin,
      simRunId: options.simRunId,
    },
  });

  await appendRideEvent(ride.id, "REQUESTED", "Ride requested", {
    pickup: input.pickup,
    drop: input.drop,
    surge: estimate.surge,
  });
  if (env.demoMode) {
    await appendRideEvent(
      ride.id,
      "DEMO_MODE",
      "Demo assignment enabled. Driver assignment ignores pickup distance; the ETA is simulated.",
      {
        driverEmail: env.demoDriverEmail,
        etaMode: "simulated",
        trackingMode: "last-reported-gps",
      },
    );
  }

  await dispatchRide(ride.id, options.strategy ?? Strategy.SMART);
  return ride;
}

const rideDetailInclude = {
  passenger: { select: { id: true, name: true, email: true } },
  driver: { include: { user: { select: { id: true, name: true, email: true } } } },
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.RideInclude;

export type RideDetail = Prisma.RideGetPayload<{ include: typeof rideDetailInclude }>;

export interface Viewer {
  id: string;
  role: string;
  driverId?: string;
}

/** Load a ride with its events (no authorization check). */
export async function loadRideDetail(rideId: string): Promise<RideDetail> {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: rideDetailInclude,
  });
  if (!ride) throw ApiError.notFound("Ride not found");
  return ride;
}

/** Load a ride with its events and enforce per-viewer authorization. */
export async function getRideForViewer(rideId: string, viewer: Viewer): Promise<RideDetail> {
  const ride = await loadRideDetail(rideId);

  const isAdmin = viewer.role === "ADMIN";
  const isPassenger = ride.passengerId === viewer.id;
  const isDriver = Boolean(viewer.driverId) && ride.driverId === viewer.driverId;

  if (!isAdmin && !isPassenger && !isDriver) {
    throw ApiError.forbidden("You do not have access to this ride");
  }

  return ride;
}

export async function listPassengerRides(passengerId: string, limit = 25) {
  return prisma.ride.findMany({
    where: { passengerId },
    orderBy: { requestedAt: "desc" },
    take: limit,
    include: { driver: { include: { user: true } } },
  });
}

export async function listDriverRides(driverId: string, limit = 25) {
  return prisma.ride.findMany({
    where: { driverId },
    orderBy: { requestedAt: "desc" },
    take: limit,
    include: { passenger: { select: { id: true, name: true } } },
  });
}

export async function getDriverActiveRide(driverId: string) {
  return prisma.ride.findFirst({
    where: {
      driverId,
      status: { in: [RideStatus.ACCEPTED, RideStatus.ARRIVING, RideStatus.ONGOING] },
    },
    orderBy: { requestedAt: "desc" },
    include: {
      passenger: { select: { id: true, name: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function cancelRide(rideId: string, viewer: Viewer): Promise<RideDetail> {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) throw ApiError.notFound("Ride not found");

  const isAdmin = viewer.role === "ADMIN";
  if (!isAdmin && ride.passengerId !== viewer.id) {
    throw ApiError.forbidden("You can only cancel your own rides");
  }
  if (!ACTIVE_STATUSES.includes(ride.status)) {
    throw ApiError.conflict(`A ${ride.status.toLowerCase()} ride cannot be cancelled`);
  }
  if (ride.status === RideStatus.ONGOING) {
    throw ApiError.conflict("An ongoing trip cannot be cancelled");
  }

  clearDispatchState(rideId);

  const updated = await transitionRide({
    rideId,
    to: RideStatus.CANCELLED,
    message: isAdmin ? "Ride cancelled by administrator" : "Ride cancelled by passenger",
    update: { driver: ride.driverId ? { disconnect: true } : undefined },
  });

  if (ride.driverId) {
    // The ride's driver is disconnected above, so resolve the user from the
    // driver record we are releasing rather than from the updated ride.
    const freed = await prisma.driver.update({
      where: { id: ride.driverId },
      data: { status: "AVAILABLE", lastIdleSince: new Date() },
      select: { userId: true },
    });
    notifyUser(
      freed.userId,
      "info",
      "Ride cancelled",
      isAdmin ? "An administrator cancelled the ride." : "The passenger cancelled the ride.",
      rideId,
    );
  }

  return getRideForViewer(rideId, viewer);
}

/**
 * Driver progression through the live stages.
 * ACCEPTED -> ARRIVING -> ONGOING -> COMPLETED.
 */
export async function advanceRide(
  rideId: string,
  driverId: string,
  next: RideStatus,
): Promise<RideDetail> {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) throw ApiError.notFound("Ride not found");
  if (ride.driverId !== driverId) throw ApiError.forbidden("This ride is not assigned to you");

  if (next === RideStatus.ARRIVING) {
    await transitionRide({
      rideId,
      to: RideStatus.ARRIVING,
      message: "Driver is arriving at the pickup point",
      eventType: "ARRIVING",
      payload: { driverId },
    });
    notifyUser(ride.passengerId, "info", "Driver arriving", "Your driver is arriving at the pickup point.", rideId);
    return loadRideDetail(rideId);
  }

  if (next === RideStatus.ONGOING) {
    await transitionRide({
      rideId,
      to: RideStatus.ONGOING,
      message: "Trip started",
      eventType: "ONGOING",
      update: { startedAt: new Date() },
      payload: { driverId },
    });
    notifyUser(ride.passengerId, "info", "Trip started", "You are on your way to the destination.", rideId);
    return loadRideDetail(rideId);
  }

  if (next === RideStatus.COMPLETED) {
    const startedAt = ride.startedAt ?? ride.acceptedAt ?? ride.requestedAt;
    const durationMin = Math.max(1, (Date.now() - startedAt.getTime()) / 60_000);
    const fareFinal = computeFare(ride.distanceKm, durationMin, ride.surgeMultiplier);

    await transitionRide({
      rideId,
      to: RideStatus.COMPLETED,
      message: "Trip completed",
      eventType: "COMPLETED",
      update: { completedAt: new Date(), fareFinal },
      payload: { driverId, fareFinal },
    });

    await prisma.$transaction([
      prisma.driver.update({
        where: { id: driverId },
        data: {
          status: "AVAILABLE",
          completedToday: { increment: 1 },
          busyMinutesToday: { increment: durationMin },
          lastIdleSince: new Date(),
        },
      }),
    ]);

    clearDispatchState(rideId);
    notifyUser(ride.passengerId, "success", "Trip completed", `Fare: ₹${fareFinal.toFixed(2)}`, rideId);
    return loadRideDetail(rideId);
  }

  throw ApiError.badRequest(`Unsupported ride advance target: ${next}`);
}

/** Wire shape shared with the frontend for live ride cards. */
export function toRideStatusPayload(ride: {
  id: string;
  status: string;
  driverId: string | null;
}): RideStatusPayload {
  return {
    rideId: ride.id,
    status: ride.status,
    driverId: ride.driverId ?? null,
    at: new Date().toISOString(),
  };
}
