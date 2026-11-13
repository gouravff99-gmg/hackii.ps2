import { DriverStatus, MATCHING, Strategy, type AllocationBreakdown, type LatLng } from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { haversineKm } from "./geo";
import { idleMinutes, rankDrivers, rankNearestOnly, workloadOf, type RankCandidate } from "./matching";

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
}): Promise<AllocationResult> {
  const radiusKm = params.radiusKm ?? MATCHING.candidateRadiusKm;
  const now = params.now ?? new Date();
  const excluded = new Set(params.excludeDriverIds ?? []);

  const drivers = await prisma.driver.findMany({
    where: { status: DriverStatus.AVAILABLE },
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

/** Re-derive the explanation for an already-persisted ranking. */
export function topAlternates(ranked: AllocationBreakdown[], count = 2): AllocationBreakdown[] {
  return ranked.slice(1, 1 + count);
}
