import { DriverStatus as PrismaDriverStatus } from "@prisma/client";
import {
  DriverStatus as SharedDriverStatus,
  type DriverDemandInsightsResponse,
  type DriverZoneInsight,
  type Recommendation,
  type ZoneSnapshot,
} from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { computeSurge, demandSupplyRatio } from "./surge";
import { haversineKm, pointInBounds, ZONE_GRID, zoneCenter, zoneIdFor } from "./geo";
import { ApiError } from "../utils/ApiError";
import { eligibleDriverWhere } from "./driverEligibility";

/** Demand is measured over this trailing window, then scaled to an hourly rate. */
export const DEMAND_WINDOW_MINUTES = 15;

export interface ZoneMetricsOptions {
  now?: Date;
  /** Overrides "current hour" (used by the admin hour slider / simulator clock). */
  hourOfDay?: number;
}

export interface ZoneMetrics {
  zones: ZoneSnapshot[];
  hourOfDay: number;
  windowMinutes: number;
}

/**
 * Builds the live zone picture:
 *  - demand  = recent requests (trailing 15 min, scaled to per-hour) blended 50/50
 *              with the ML forecast for the same hour when one exists
 *  - supply  = AVAILABLE drivers currently inside the zone
 *  - surge   = clamp(1 + 0.5*(demand/supply - 1), 1.0, 2.5)
 */
export async function getZoneMetrics(options: ZoneMetricsOptions = {}): Promise<ZoneMetrics> {
  const now = options.now ?? new Date();
  const hourOfDay = options.hourOfDay ?? now.getHours();
  const since = new Date(now.getTime() - DEMAND_WINDOW_MINUTES * 60_000);

  const [recentRides, availableDrivers, forecasts] = await Promise.all([
    prisma.ride.findMany({
      where: { requestedAt: { gte: since } },
      select: { pickupLat: true, pickupLng: true },
    }),
    prisma.driver.findMany({
      where: {
        AND: [
          {
            status: PrismaDriverStatus.AVAILABLE,
            locationUpdatedAt: { gte: new Date(now.getTime() - 2 * 60_000) },
          },
          eligibleDriverWhere({ now }),
        ],
      },
      select: { lat: true, lng: true },
    }),
    prisma.demandForecast.findMany({
      where: { hourOfDay },
      select: { zoneId: true, predictedDemand: true },
    }),
  ]);

  const observed = new Map<string, number>();
  for (const ride of recentRides) {
    if (!pointInBounds(ride.pickupLat, ride.pickupLng)) continue;
    const zoneId = zoneIdFor(ride.pickupLat, ride.pickupLng);
    observed.set(zoneId, (observed.get(zoneId) ?? 0) + 1);
  }

  const supplyByZone = new Map<string, number>();
  for (const driver of availableDrivers) {
    if (!pointInBounds(driver.lat, driver.lng)) continue;
    const zoneId = zoneIdFor(driver.lat, driver.lng);
    supplyByZone.set(zoneId, (supplyByZone.get(zoneId) ?? 0) + 1);
  }

  const predictedByZone = new Map<string, number>();
  for (const forecast of forecasts) {
    predictedByZone.set(forecast.zoneId, forecast.predictedDemand);
  }

  const scale = 60 / DEMAND_WINDOW_MINUTES;
  const zones: ZoneSnapshot[] = [];

  for (let row = 0; row < ZONE_GRID.rows; row += 1) {
    for (let col = 0; col < ZONE_GRID.cols; col += 1) {
      const zoneId = `r${row}c${col}`;
      const center = zoneCenter(zoneId);
      if (!center) continue;

      const recent = (observed.get(zoneId) ?? 0) * scale;
      const predicted = predictedByZone.get(zoneId);
      const demand = predicted === undefined ? recent : (recent + predicted) / 2;
      const supply = supplyByZone.get(zoneId) ?? 0;

      zones.push({
        zoneId,
        row,
        col,
        center,
        demand: round2(demand),
        supply,
        ratio: demandSupplyRatio(demand, supply),
        surge: computeSurge(demand, supply),
        predictedDemand: predicted === undefined ? undefined : round2(predicted),
      });
    }
  }

  return { zones, hourOfDay, windowMinutes: DEMAND_WINDOW_MINUTES };
}

/** Surge multiplier for the zone containing a pickup point. */
export async function surgeForPickup(lat: number, lng: number, metrics?: ZoneMetrics): Promise<number> {
  if (!pointInBounds(lat, lng)) return 1;
  const zoneId = zoneIdFor(lat, lng);
  const resolved = metrics ?? (await getZoneMetrics());
  const zone = resolved.zones.find((entry) => entry.zoneId === zoneId);
  return zone?.surge ?? 1;
}

/**
 * Ranked repositioning suggestions: move idle supply from surplus zones to
 * deficit zones. This is the proactive-dispatch recommendation list.
 */
export function buildRecommendations(zones: ZoneSnapshot[], limit = 8): Recommendation[] {
  const surplus = zones
    .filter((zone) => zone.supply > 0 && zone.ratio < 1)
    .sort((a, b) => a.ratio - b.ratio);
  const deficit = zones
    .filter((zone) => zone.ratio > 1.25)
    .sort((a, b) => b.ratio - a.ratio);

  const recommendations: Recommendation[] = [];

  for (const from of surplus) {
    if (recommendations.length >= limit) break;
    const spare = Math.floor(from.supply - Math.max(from.demand, 0));
    if (spare <= 0) continue;

    const to = deficit.find((zone) => zone.zoneId !== from.zoneId);
    if (!to) break;

    recommendations.push({
      fromZone: from.zoneId,
      toZone: to.zoneId,
      driversToMove: Math.min(spare, Math.max(1, Math.ceil(to.ratio - 1))),
      reason: `${from.zoneId} has spare supply (ratio ${from.ratio.toFixed(2)}); ${to.zoneId} is under-supplied (ratio ${to.ratio.toFixed(2)}).`,
    });
  }

  return recommendations;
}

export async function getDriverDemandInsights(
  driverId: string,
  now = new Date(),
): Promise<DriverDemandInsightsResponse> {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { lat: true, lng: true, status: true, isSimulated: true, locationUpdatedAt: true },
  });
  if (!driver) throw ApiError.notFound("Driver profile not found");

  const metrics = await getZoneMetrics({ now });
  const since = new Date(now.getTime() - DEMAND_WINDOW_MINUTES * 60_000);
  const recentRides = await prisma.ride.findMany({
    where: { requestedAt: { gte: since } },
    select: { pickupLat: true, pickupLng: true, simRunId: true },
  });
  const requestsByZone = new Map<string, { measured: number; simulated: number }>();
  for (const ride of recentRides) {
    const zoneId = zoneIdFor(ride.pickupLat, ride.pickupLng);
    const counts = requestsByZone.get(zoneId) ?? { measured: 0, simulated: 0 };
    if (ride.simRunId) counts.simulated += 1;
    else counts.measured += 1;
    requestsByZone.set(zoneId, counts);
  }

  const point = { lat: driver.lat, lng: driver.lng };
  const currentZoneId = zoneIdFor(driver.lat, driver.lng);
  const toInsight = (zone: ZoneSnapshot): DriverZoneInsight => {
    const counts = requestsByZone.get(zone.zoneId) ?? { measured: 0, simulated: 0 };
    return {
      ...zone,
      distanceKm: haversineKm(point, zone.center),
      measuredRequests15m: counts.measured,
      simulatedRequests15m: counts.simulated,
      recentRequests15m: counts.measured + counts.simulated,
    };
  };
  const zonesById = new Map(metrics.zones.map((zone) => [zone.zoneId, zone]));
  const current = zonesById.get(currentZoneId);
  if (!current) throw new ApiError(500, "Could not resolve the driver's demand zone");

  const nearbyZones = metrics.zones
    .map(toInsight)
    .filter((zone) => zone.zoneId !== currentZoneId && zone.distanceKm <= 5)
    .sort((a, b) => b.ratio - a.ratio || a.distanceKm - b.distanceKm)
    .slice(0, 5);

  const suggestion = driver.status === PrismaDriverStatus.AVAILABLE
    ? buildRecommendations(metrics.zones).find((item) => item.fromZone === currentZoneId)
    : undefined;
  const target = suggestion ? zonesById.get(suggestion.toZone) : undefined;

  return {
    driverLocation: point,
    currentZone: toInsight(current),
    nearbyZones,
    recommendation:
      suggestion && target
        ? {
            targetZone: target.zoneId,
            center: target.center,
            distanceKm: haversineKm(point, target.center),
            reason: suggestion.reason,
          }
        : null,
    driverStatus: {
      [PrismaDriverStatus.OFFLINE]: SharedDriverStatus.OFFLINE,
      [PrismaDriverStatus.AVAILABLE]: SharedDriverStatus.AVAILABLE,
      [PrismaDriverStatus.BUSY]: SharedDriverStatus.BUSY,
      [PrismaDriverStatus.REPOSITIONING]: SharedDriverStatus.REPOSITIONING,
    }[driver.status],
    driverIsSimulated: driver.isSimulated,
    hourOfDay: metrics.hourOfDay,
    observedWindowMinutes: metrics.windowMinutes,
    peakPeriods: [
      { startHour: 8, endHour: 10 },
      { startHour: 17, endHour: 20 },
    ],
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
