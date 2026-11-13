import { DriverStatus, type NearbyDriver } from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { haversineKm, pointInBounds } from "./geo";
import { pickupEtaMinutes } from "./allocation";

/** Available drivers within `radiusKm` of a point, nearest first. */
export async function findNearbyDrivers(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<NearbyDriver[]> {
  const drivers = await prisma.driver.findMany({
    where: { status: DriverStatus.AVAILABLE },
    include: { user: { select: { name: true } } },
  });

  return drivers
    .map((driver) => {
      const distanceKm = haversineKm({ lat, lng }, { lat: driver.lat, lng: driver.lng });
      return {
        id: driver.id,
        name: driver.user.name,
        vehicleType: driver.vehicleType,
        lat: driver.lat,
        lng: driver.lng,
        distanceKm: Math.round(distanceKm * 100) / 100,
        etaMin: Math.round(pickupEtaMinutes(distanceKm) * 10) / 10,
      };
    })
    .filter((driver) => driver.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

const ALLOWED_STATUS_CHANGES: Record<DriverStatus, DriverStatus[]> = {
  OFFLINE: [DriverStatus.AVAILABLE],
  AVAILABLE: [DriverStatus.OFFLINE, DriverStatus.BUSY, DriverStatus.REPOSITIONING],
  BUSY: [DriverStatus.AVAILABLE, DriverStatus.OFFLINE],
  REPOSITIONING: [DriverStatus.AVAILABLE, DriverStatus.OFFLINE],
};

export async function setDriverStatus(driverId: string, status: DriverStatus) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw ApiError.notFound("Driver profile not found");

  if (driver.status === status) return driver;

  const allowed = ALLOWED_STATUS_CHANGES[driver.status];
  if (!allowed.includes(status)) {
    throw ApiError.conflict(`Driver cannot go from ${driver.status} to ${status}`);
  }

  return prisma.driver.update({
    where: { id: driverId },
    data: {
      status,
      lastIdleSince: status === DriverStatus.AVAILABLE ? new Date() : driver.lastIdleSince,
    },
  });
}

export async function updateDriverLocation(driverId: string, lat: number, lng: number) {
  if (!pointInBounds(lat, lng)) {
    throw ApiError.badRequest("Location is outside the service area");
  }
  return prisma.driver.update({
    where: { id: driverId },
    data: { lat, lng },
  });
}

export async function getDriverProfile(driverId: string) {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!driver) throw ApiError.notFound("Driver profile not found");
  return driver;
}
