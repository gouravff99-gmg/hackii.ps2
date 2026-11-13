import { Prisma, RideStatus } from "@prisma/client";
import { ROOMS, SOCKET_EVENTS, type RideStatusPayload } from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { emitToAdmins, emitToRide, emitToUser } from "./realtime";

/**
 * The ONLY place ride status changes are validated and persisted.
 * Every transition writes a RideEvent and fans out to the right rooms.
 */
export const RIDE_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  REQUESTED: [RideStatus.ACCEPTED, RideStatus.REASSIGNING, RideStatus.CANCELLED],
  ACCEPTED: [RideStatus.ARRIVING, RideStatus.REASSIGNING, RideStatus.CANCELLED],
  ARRIVING: [RideStatus.ONGOING, RideStatus.REASSIGNING, RideStatus.CANCELLED],
  ONGOING: [RideStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
  REASSIGNING: [RideStatus.ACCEPTED, RideStatus.REQUESTED, RideStatus.CANCELLED],
};

export const TERMINAL_STATUSES: RideStatus[] = [RideStatus.COMPLETED, RideStatus.CANCELLED];

export function canTransition(from: RideStatus, to: RideStatus): boolean {
  return RIDE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: RideStatus, to: RideStatus): void {
  if (!canTransition(from, to)) {
    throw ApiError.conflict(`Illegal ride transition: ${from} -> ${to}`);
  }
}

export function isTerminal(status: RideStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export type RideWithPeople = Prisma.RideGetPayload<{
  include: { passenger: true; driver: { include: { user: true } } };
}>;

const rideInclude = {
  passenger: true,
  driver: { include: { user: true } },
} satisfies Prisma.RideInclude;

export interface TransitionArgs {
  rideId: string;
  to: RideStatus;
  message: string;
  /** Extra columns to persist in the same transaction (driverId, timestamps, ...). */
  update?: Prisma.RideUpdateInput;
  /** Overrides the RideEvent.type (defaults to the target status). */
  eventType?: string;
  payload?: Record<string, unknown>;
  /** ETA shown to the passenger in the live status payload. */
  etaMin?: number;
}

export async function transitionRide(args: TransitionArgs): Promise<RideWithPeople> {
  const current = await prisma.ride.findUnique({
    where: { id: args.rideId },
    include: rideInclude,
  });

  if (!current) throw ApiError.notFound("Ride not found");
  assertTransition(current.status, args.to);

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.ride.update({
      where: { id: args.rideId },
      data: { status: args.to, ...args.update },
      include: rideInclude,
    });

    await tx.rideEvent.create({
      data: {
        rideId: args.rideId,
        type: args.eventType ?? args.to,
        message: args.message,
        payload: (args.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    return next;
  });

  emitRideStatus(updated, args.etaMin, args.message);
  return updated;
}

/** Record a non-transition event (offer sent, delayed, pooled, ...). */
export async function appendRideEvent(
  rideId: string,
  type: string,
  message: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  await prisma.rideEvent.create({
    data: {
      rideId,
      type,
      message,
      payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export function emitRideStatus(ride: RideWithPeople, etaMin?: number, message?: string) {
  const payload: RideStatusPayload = {
    rideId: ride.id,
    status: ride.status,
    driverId: ride.driverId ?? null,
    etaMin,
    message,
    at: new Date().toISOString(),
  };

  emitToUser(ride.passengerId, SOCKET_EVENTS.RIDE_STATUS, payload);
  emitToRide(ride.id, SOCKET_EVENTS.RIDE_STATUS, payload);
  emitToAdmins(SOCKET_EVENTS.RIDE_STATUS, payload);

  if (ride.driver) {
    emitToUser(ride.driver.userId, SOCKET_EVENTS.RIDE_STATUS, payload);
  }
}

/** Room name helper re-exported so socket handlers stay consistent. */
export const rideRoom = ROOMS.ride;
