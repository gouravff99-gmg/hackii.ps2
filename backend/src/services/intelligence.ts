import { DriverStatus as PrismaDriverStatus, RideStatus as PrismaRideStatus } from "@prisma/client";
import {
  CITY,
  type IntelligenceConfidence,
  type IntelligenceDataSource,
  type MobilityIntelligenceResponse,
  type MobilityZoneInsight,
} from "@ps02/shared";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { eligibleDriverWhere } from "./driverEligibility";
import { computeSurge, demandSupplyRatio } from "./surge";
import { pointInBounds, zoneIdFor } from "./geo";
import { DEMAND_WINDOW_MINUTES, getZoneMetrics } from "./zones";

export const STALE_LOCATION_THRESHOLD_MS = 2 * 60_000;

type ActivityRide = {
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  status: PrismaRideStatus;
  simRunId: string | null;
  requestedAt: Date;
  acceptedAt: Date | null;
};

type OnlineDriver = {
  lat: number;
  lng: number;
  status: PrismaDriverStatus;
  isSimulated: boolean;
  user: { email: string };
};

export function classifyAvailability(
  requests: number,
  availableDrivers: number,
  hasUsableData: boolean,
): MobilityZoneInsight["availability"] {
  if (!hasUsableData) return "INSUFFICIENT_DATA";
  if (requests === 0) return availableDrivers > 0 ? "GOOD" : "INSUFFICIENT_DATA";
  if (availableDrivers === 0) return "HIGH_PRESSURE";
  const coverage = availableDrivers / requests;
  if (coverage >= 1) return "GOOD";
  if (coverage >= 0.5) return "MODERATE";
  if (coverage >= 0.25) return "LIMITED";
  return "HIGH_PRESSURE";
}

function confidenceForZone(
  measuredRequests: number,
  availableDrivers: number,
  busyDrivers: number,
): IntelligenceConfidence {
  const liveSamples = measuredRequests + availableDrivers + busyDrivers;
  if (liveSamples >= 10 && measuredRequests >= 3) return "HIGH";
  if (liveSamples >= 3) return "MEDIUM";
  return "LOW";
}

/**
 * Combines measured ride activity, fresh eligible driver supply, and the
 * existing hourly forecast into one privacy-safe, aggregated zone response.
 */
export async function getMobilityIntelligence(
  now = new Date(),
  hourOfDay = now.getHours(),
): Promise<MobilityIntelligenceResponse> {
  const since = new Date(now.getTime() - DEMAND_WINDOW_MINUTES * 60_000);
  const historySince = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const freshSince = new Date(now.getTime() - STALE_LOCATION_THRESHOLD_MS);

  const [baseMetrics, rides, drivers] = await Promise.all([
    getZoneMetrics({ now, hourOfDay }),
    prisma.ride.findMany({
      where: {
        OR: [
          { requestedAt: { gte: since } },
          { acceptedAt: { gte: historySince } },
          { status: { in: [PrismaRideStatus.REQUESTED, PrismaRideStatus.REASSIGNING] } },
        ],
      },
      select: {
        pickupLat: true,
        pickupLng: true,
        dropLat: true,
        dropLng: true,
        status: true,
        simRunId: true,
        requestedAt: true,
        acceptedAt: true,
      },
    }),
    prisma.driver.findMany({
      where: {
        AND: [
          eligibleDriverWhere({ now }),
          {
            status: { in: [PrismaDriverStatus.AVAILABLE, PrismaDriverStatus.BUSY] },
            locationUpdatedAt: { gte: freshSince },
          },
        ],
      },
      select: {
        lat: true,
        lng: true,
        status: true,
        isSimulated: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  const requestsByZone = new Map<string, { measured: number; simulated: number; pending: number }>();
  const dropoffsByZone = new Map<string, number>();
  const assignmentWaitByZone = new Map<string, { totalSeconds: number; count: number }>();
  for (const ride of rides as ActivityRide[]) {
    if (!pointInBounds(ride.pickupLat, ride.pickupLng)) continue;
    const zoneId = zoneIdFor(ride.pickupLat, ride.pickupLng);
    const counts = requestsByZone.get(zoneId) ?? { measured: 0, simulated: 0, pending: 0 };
    if (ride.requestedAt >= since) {
      if (ride.simRunId) counts.simulated += 1;
      else counts.measured += 1;
      if (pointInBounds(ride.dropLat, ride.dropLng)) {
        const dropZoneId = zoneIdFor(ride.dropLat, ride.dropLng);
        dropoffsByZone.set(dropZoneId, (dropoffsByZone.get(dropZoneId) ?? 0) + 1);
      }
      if (ride.acceptedAt && ride.requestedAt >= historySince && !ride.simRunId) {
        const seconds = (ride.acceptedAt.getTime() - ride.requestedAt.getTime()) / 1000;
        if (seconds >= 0) {
          const samples = assignmentWaitByZone.get(zoneId) ?? { totalSeconds: 0, count: 0 };
          samples.totalSeconds += seconds;
          samples.count += 1;
          assignmentWaitByZone.set(zoneId, samples);
        }
      }
    }
    if (ride.status === PrismaRideStatus.REQUESTED || ride.status === PrismaRideStatus.REASSIGNING) {
      counts.pending += 1;
    }
    requestsByZone.set(zoneId, counts);
  }

  const driversByZone = new Map<string, {
    available: number;
    busy: number;
    simulated: number;
    live: number;
    demo: number;
  }>();
  for (const driver of drivers as OnlineDriver[]) {
    if (!pointInBounds(driver.lat, driver.lng)) continue;
    const zoneId = zoneIdFor(driver.lat, driver.lng);
    const counts = driversByZone.get(zoneId) ?? {
      available: 0,
      busy: 0,
      simulated: 0,
      live: 0,
      demo: 0,
    };
    const isDemoDriver = env.demoMode && driver.user.email === env.demoDriverEmail;
    if (driver.status === PrismaDriverStatus.AVAILABLE) counts.available += 1;
    if (driver.status === PrismaDriverStatus.BUSY) counts.busy += 1;
    if (driver.isSimulated) counts.simulated += 1;
    else if (isDemoDriver) counts.demo += 1;
    else counts.live += 1;
    driversByZone.set(zoneId, counts);
  }

  const zones: MobilityZoneInsight[] = baseMetrics.zones.map((zone) => {
    const activity = requestsByZone.get(zone.zoneId) ?? { measured: 0, simulated: 0, pending: 0 };
    const supply = driversByZone.get(zone.zoneId) ?? {
      available: 0,
      busy: 0,
      simulated: 0,
      live: 0,
      demo: 0,
    };
    const currentRequests15m = activity.measured + activity.simulated;
    const dataSources: IntelligenceDataSource[] = [];
    if (activity.measured > 0 || supply.live > 0) {
      dataSources.push("LIVE");
    }
    if (activity.simulated > 0 || supply.simulated > 0) dataSources.push("SIMULATION");
    if (supply.demo > 0) dataSources.push("DEMO");
    if (zone.predictedDemand !== undefined) dataSources.push("FORECAST");
    const hasUsableData = dataSources.includes("LIVE") || dataSources.includes("SIMULATION");

    return {
      ...zone,
      supply: supply.available,
      ratio: demandSupplyRatio(zone.demand, supply.available),
      surge: computeSurge(zone.demand, supply.available),
      currentRequests15m,
      requestedDropoffs15m: dropoffsByZone.get(zone.zoneId) ?? 0,
      measuredRequests15m: activity.measured,
      simulatedRequests15m: activity.simulated,
      pendingRequests: activity.pending,
      averageAssignmentWaitSeconds: assignmentWaitByZone.has(zone.zoneId)
        ? Math.round(
            assignmentWaitByZone.get(zone.zoneId)!.totalSeconds /
              assignmentWaitByZone.get(zone.zoneId)!.count,
          )
        : null,
      assignmentSamples7d: assignmentWaitByZone.get(zone.zoneId)?.count ?? 0,
      availableDrivers: supply.available,
      busyDrivers: supply.busy,
      demandSupplyGap: activity.pending - supply.available,
      availability: classifyAvailability(currentRequests15m, supply.available, hasUsableData),
      confidence: confidenceForZone(activity.measured, supply.available, supply.busy),
      dataSources,
    };
  });

  return {
    city: CITY.name,
    generatedAt: now.toISOString(),
    windowMinutes: DEMAND_WINDOW_MINUTES,
    staleLocationThresholdSeconds: STALE_LOCATION_THRESHOLD_MS / 1000,
    zones,
  };
}
