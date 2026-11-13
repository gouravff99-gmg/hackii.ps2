import { DriverStatus, MATCHING, Strategy, VehicleCategory, type AllocationBreakdown, type LatLng } from "@ps02/shared";
import { VehicleCategory as PrismaVehicleCategory } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { haversineKm } from "./geo";
import { idleMinutes, rankDrivers, rankNearestOnly, workloadOf, type RankCandidate } from "./matching";
import { eligibleDriverWhere } from "./driverEligibility";

/** Fallback road speed used when only a straight-line distance is available. */
const PICKUP_SPEED_KMH = 24;
const ROAD_FACTOR = 1.3;

export function pickupEtaMinutes(distanceKm: number): number {
  return (distanceKm * ROAD_FACTOR * 60) / PICKUP_SPEED_KMH;
}

export interface AllocationResult {
  candidates: RankCandidate[];
  ranked: AllocationBreakdown[];
  chosen: AllocationBreakdown | null;
  strategy: Strategy;
  retryable?: boolean;
}

export function buildDemoAllocation(
  driver: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    busyMinutesToday: number;
    completedToday: number;
    acceptanceRate: number;
    lastIdleSince: Date | string;
  },
  pickup: LatLng,
  etaMin = env.demoPickupEtaMin,
): AllocationResult {
  const candidate: RankCandidate = {
    driverId: driver.id,
    driverName: driver.name,
    distanceKm: haversineKm(pickup, { lat: driver.lat, lng: driver.lng }),
    etaMin,
    workload: workloadOf(driver),
    acceptanceRate: driver.acceptanceRate,
    idleMin: idleMinutes(driver.lastIdleSince),
  };
  const ranked = rankDrivers([candidate]);

  return {
    candidates: [candidate],
    ranked,
    chosen: ranked[0] ?? null,
    strategy: Strategy.SMART,
  };
}

/**
 * Load AVAILABLE drivers within `radiusKm`, drop excluded ones, and rank them
 * with either SMART (weighted, explainable) or NEAREST (baseline).
 */
export async function allocateDriver(params: {
  pickup: LatLng;
  strategy: Strategy;
  excludeDriverIds?: string[];
  radiusKm?: number;
  now?: Date;
  includeSimulated?: boolean;
  /** Restrict candidates to a service category (BIKE / CAR / POOL). */
  category?: VehicleCategory;
}): Promise<AllocationResult> {
  const radiusKm = params.radiusKm ?? MATCHING.candidateRadiusKm;
  const now = params.now ?? new Date();
  const excluded = new Set(params.excludeDriverIds ?? []);

  const categoryFilter =
    params.category === VehicleCategory.BIKE
      ? { vehicleCategory: PrismaVehicleCategory.BIKE }
      : params.category === VehicleCategory.CAR
        ? { vehicleCategory: PrismaVehicleCategory.CAR }
        : params.category === VehicleCategory.POOL
          ? {
              OR: [
                { vehicleCategory: PrismaVehicleCategory.POOL },
                { vehicleCategory: PrismaVehicleCategory.CAR, poolEnabled: true },
              ],
            }
          : {};

  const drivers = await prisma.driver.findMany({
    where: {
      AND: [
        { status: DriverStatus.AVAILABLE },
        categoryFilter,
        eligibleDriverWhere({ now, includeSimulated: params.includeSimulated }),
      ],
    },
    include: { user: { select: { name: true } } },
  });

  const candidates: RankCandidate[] = [];

  for (const driver of drivers) {
    if (excluded.has(driver.id)) continue;
    const distanceKm = haversineKm(params.pickup, { lat: driver.lat, lng: driver.lng });
    if (distanceKm > radiusKm) continue;

    candidates.push({
      driverId: driver.id,
      driverName: driver.user.name,
      distanceKm,
      etaMin: pickupEtaMinutes(distanceKm),
      workload: workloadOf(driver),
      acceptanceRate: driver.acceptanceRate,
      idleMin: idleMinutes(driver.lastIdleSince, now),
    });
  }

  const ranked =
    params.strategy === Strategy.NEAREST ? rankNearestOnly(candidates) : rankDrivers(candidates);

  return {
    candidates,
    ranked,
    chosen: ranked[0] ?? null,
    strategy: params.strategy,
  };
}

/**
 * Demo dispatch targets one configured existing driver, independent of
 * pickup distance. Availability is still required to prevent concurrent rides.
 */
export async function allocateDemoDriver(params: {
  pickup: LatLng;
  excludeDriverIds?: string[];
}): Promise<AllocationResult> {
  const excluded = new Set(params.excludeDriverIds ?? []);
  const driver = await prisma.driver.findFirst({
    where: {
      user: { email: env.demoDriverEmail },
    },
    include: { user: { select: { name: true } } },
  });

  if (!driver || excluded.has(driver.id)) {
    return {
      candidates: [],
      ranked: [],
      chosen: null,
      strategy: Strategy.SMART,
    };
  }
  if (driver.status !== DriverStatus.AVAILABLE) {
    return {
      candidates: [],
      ranked: [],
      chosen: null,
      strategy: Strategy.SMART,
      retryable: driver.status === DriverStatus.BUSY,
    };
  }

  return buildDemoAllocation(
    {
      id: driver.id,
      name: driver.user.name,
      lat: driver.lat,
      lng: driver.lng,
      busyMinutesToday: driver.busyMinutesToday,
      completedToday: driver.completedToday,
      acceptanceRate: driver.acceptanceRate,
      lastIdleSince: driver.lastIdleSince,
    },
    params.pickup,
  );
}

/** Re-derive the explanation for an already-persisted ranking. */
export function topAlternates(ranked: AllocationBreakdown[], count = 2): AllocationBreakdown[] {
  return ranked.slice(1, 1 + count);
}
