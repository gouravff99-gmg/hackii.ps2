import { DriverStatus, VehicleCategory, type NearbyDriver } from "@ps02/shared";
import { VehicleCategory as PrismaVehicleCategory } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { haversineKm, pointInBounds, pointInIndiaBounds, zoneIdFor } from "./geo";
import { pickupEtaMinutes } from "./allocation";
import { eligibleDriverWhere, isDriverEligible } from "./driverEligibility";
import { emitZonesUpdate } from "./realtime";

type DriverRow = NonNullable<Awaited<ReturnType<typeof prisma.driver.findUnique>>>;

interface DriverLocationCacheEntry {
  driver: DriverRow;
  latest: { lat: number; lng: number };
  latestAt: number;
  persisted: { lat: number; lng: number };
  persistedAt: number;
  pendingDistanceKm: number;
  initialized: boolean;
  persisting: boolean;
}

const driverLocationCache = new Map<string, DriverLocationCacheEntry>();
const LOCATION_PERSIST_INTERVAL_MS = 30_000;
const LOCATION_PERSIST_DISTANCE_KM = 0.1;

/** Available drivers within `radiusKm` of a point, nearest first. */
export async function findNearbyDrivers(
  lat: number,
  lng: number,
  radiusKm: number,
  category?: VehicleCategory,
): Promise<NearbyDriver[]> {
  const categoryFilter =
    category === VehicleCategory.BIKE
      ? { vehicleCategory: PrismaVehicleCategory.BIKE }
      : category === VehicleCategory.CAR
        ? { vehicleCategory: PrismaVehicleCategory.CAR }
        : category === VehicleCategory.POOL
          ? {
              OR: [
                { vehicleCategory: PrismaVehicleCategory.POOL },
                { vehicleCategory: PrismaVehicleCategory.CAR, poolEnabled: true },
              ],
            }
          : {};

  const drivers = await prisma.driver.findMany({
    where: {
      AND: [{ status: DriverStatus.AVAILABLE }, categoryFilter, eligibleDriverWhere()],
    },
    include: { user: { select: { name: true } } },
  });

  return drivers
    .map((driver) => {
      const current = driverLocationCache.get(driver.id)?.latest;
      const driverLat = current?.lat ?? driver.lat;
      const driverLng = current?.lng ?? driver.lng;
      const distanceKm = haversineKm({ lat, lng }, { lat: driverLat, lng: driverLng });
      return {
        id: driver.id,
        name: driver.user.name,
        vehicleType: driver.vehicleType,
        vehicleCategory: driver.vehicleCategory as unknown as VehicleCategory,
        lat: driverLat,
        lng: driverLng,
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
  const cached = driverLocationCache.get(driverId);
  if (cached) cached.driver = { ...cached.driver, ...updated };
  emitZonesUpdate();
  return updated;
}

export async function updateDriverLocation(driverId: string, lat: number, lng: number) {
  if (!pointInIndiaBounds(lat, lng)) {
    throw ApiError.badRequest("Driver location must be within India");
  }
  const now = Date.now();
  let cached = driverLocationCache.get(driverId);
  if (!cached) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw ApiError.notFound("Driver profile not found");
    const persistedAt = driver.locationUpdatedAt?.getTime() ?? 0;
    cached = {
      driver,
      latest: { lat: driver.lat, lng: driver.lng },
      latestAt: persistedAt,
      persisted: { lat: driver.lat, lng: driver.lng },
      persistedAt,
      pendingDistanceKm: 0,
      initialized: false,
      persisting: false,
    };
    driverLocationCache.set(driverId, cached);
  }

  const previous = cached.latest;
  if (now - cached.latestAt <= 60_000) {
    cached.pendingDistanceKm += haversineKm(previous, { lat, lng });
  }
  cached.latest = { lat, lng };
  cached.latestAt = now;
  const shouldPersist = !cached.persisting && (
    !cached.initialized ||
    now - cached.persistedAt >= LOCATION_PERSIST_INTERVAL_MS ||
    haversineKm(cached.persisted, { lat, lng }) >= LOCATION_PERSIST_DISTANCE_KM
  );

  let driver = cached.driver;
  if (shouldPersist) {
    const distanceToPersist = cached.pendingDistanceKm;
    const snapshot = { lat, lng };
    cached.persisting = true;
    try {
      driver = await prisma.driver.update({
        where: { id: driverId },
        data: { ...snapshot, locationUpdatedAt: new Date(now) },
      });
      if (distanceToPersist > 0) {
        await prisma.ride.updateMany({
          where: { driverId, status: "ONGOING" },
          data: { actualDistanceKm: { increment: distanceToPersist } },
        });
      }
      cached.driver = driver;
      cached.persisted = snapshot;
      cached.persistedAt = now;
      cached.pendingDistanceKm = Math.max(0, cached.pendingDistanceKm - distanceToPersist);
      cached.initialized = true;
    } finally {
      cached.persisting = false;
    }
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
  return {
    ...driver,
    lat,
    lng,
    locationUpdatedAt: new Date(cached.latestAt),
  };
}

export async function getDriverProfile(driverId: string) {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!driver) throw ApiError.notFound("Driver profile not found");
  const latest = driverLocationCache.get(driverId);
  if (latest) {
    return {
      ...driver,
      lat: latest.latest.lat,
      lng: latest.latest.lng,
      locationUpdatedAt: new Date(latest.latestAt),
    };
  }
  return driver;
}

export function getLatestDriverLocation(driverId: string) {
  const latest = driverLocationCache.get(driverId);
  if (!latest) return null;
  return {
    lat: latest.latest.lat,
    lng: latest.latest.lng,
    locationUpdatedAt: new Date(latest.latestAt),
  };
}

export async function updateVehicleRegistration(driverId: string, registration: string | null) {
  return prisma.driver.update({
    where: { id: driverId },
    data: { vehicleRegistration: registration },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}
