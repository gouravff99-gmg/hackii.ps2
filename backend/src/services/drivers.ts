import { DriverStatus, type NearbyDriver } from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { haversineKm, pointInIndiaBounds } from "./geo";
import { pickupEtaMinutes } from "./allocation";
import { eligibleDriverWhere, isDriverEligible } from "./driverEligibility";

/** Available drivers within `radiusKm` of a point, nearest first. */
export async function findNearbyDrivers(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<NearbyDriver[]> {
  const drivers = await prisma.driver.findMany({
    where: { AND: [{ status: DriverStatus.AVAILABLE }, eligibleDriverWhere()] },
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
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: {
      user: { select: { email: true } },
      onboarding: { include: { documents: { select: { status: true, expiryDate: true } } } },
    },
  });
  if (!driver) throw ApiError.notFound("Driver profile not found");

  const { user: _user, onboarding: _onboarding, ...safeDriver } = driver;
  if (driver.status === status) return safeDriver;
  if (status === DriverStatus.AVAILABLE && !isDriverEligible(driver)) {
    throw ApiError.forbidden("Complete and receive approval for driver onboarding before going online");
  }

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
  if (!pointInIndiaBounds(lat, lng)) {
    throw ApiError.badRequest("Driver location must be within India");
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
