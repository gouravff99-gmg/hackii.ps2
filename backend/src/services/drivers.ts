import { DriverStatus, type NearbyDriver } from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { haversineKm, pointInBounds, pointInIndiaBounds, zoneIdFor } from "./geo";
import { pickupEtaMinutes } from "./allocation";
import { eligibleDriverWhere, isDriverEligible } from "./driverEligibility";
import { emitZonesUpdate } from "./realtime";

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

  const updated = await prisma.driver.update({
    where: { id: driverId },
    data: {
      status,
      lastIdleSince: status === DriverStatus.AVAILABLE ? new Date() : driver.lastIdleSince,
    },
  });
  emitZonesUpdate();
  return updated;
}

export async function updateDriverLocation(driverId: string, lat: number, lng: number) {
  if (!pointInIndiaBounds(lat, lng)) {
    throw ApiError.badRequest("Driver location must be within India");
  }
  const previous = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { lat: true, lng: true, status: true },
  });
  if (!previous) throw ApiError.notFound("Driver profile not found");
  const driver = await prisma.driver.update({
    where: { id: driverId },
    data: { lat, lng, locationUpdatedAt: new Date() },
  });
  const distanceDelta = haversineKm({ lat: previous.lat, lng: previous.lng }, { lat, lng });
  if (distanceDelta > 0) {
    await prisma.ride.updateMany({
      where: { driverId, status: "ONGOING" },
      data: { actualDistanceKm: { increment: distanceDelta } },
    });
  }
  const previousZone = pointInBounds(previous.lat, previous.lng)
    ? zoneIdFor(previous.lat, previous.lng)
    : null;
  const currentZone = pointInBounds(lat, lng) ? zoneIdFor(lat, lng) : null;
  if (
    previousZone !== currentZone &&
    (driver.status === DriverStatus.AVAILABLE || driver.status === DriverStatus.BUSY)
  ) {
    emitZonesUpdate();
  }
  return driver;
}

export async function getDriverProfile(driverId: string) {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!driver) throw ApiError.notFound("Driver profile not found");
  return driver;
}

export async function updateVehicleRegistration(driverId: string, registration: string | null) {
  return prisma.driver.update({
    where: { id: driverId },
    data: { vehicleRegistration: registration },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}
