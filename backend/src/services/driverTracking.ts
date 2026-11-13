import { RideStatus, SOCKET_EVENTS, type RideDriverLocationPayload } from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { emitToUser } from "./realtime";

const TRACKED_STATUSES = [
  RideStatus.ACCEPTED,
  RideStatus.ARRIVING,
  RideStatus.ARRIVED,
  RideStatus.ONGOING,
];

export async function publishDriverLocation(
  driverId: string,
  location: { lat: number; lng: number },
): Promise<void> {
  const rides = await prisma.ride.findMany({
    where: { driverId, status: { in: TRACKED_STATUSES } },
    select: { id: true, passengerId: true },
  });
  const at = new Date().toISOString();
  for (const ride of rides) {
    const payload: RideDriverLocationPayload = {
      rideId: ride.id,
      driverId,
      ...location,
      at,
    };
    emitToUser(ride.passengerId, SOCKET_EVENTS.RIDE_DRIVER_LOCATION, payload);
  }
}
