import { DriverStatus, Role } from "@prisma/client";
import { RideStatus as PrismaRideStatus } from "@prisma/client";
import { DriverStatus as SharedDriverStatus, RideStatus as SharedRideStatus } from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { round2 } from "./fare";
import { buildRecommendations, getZoneMetrics, type ZoneMetrics } from "./zones";
import { groupPoolCandidates, planPool, stopsForMatrix, type PoolMatrix } from "./pooling";
import { haversineKm } from "./geo";
import { listLatestRuns } from "./evaluation";
import type { ForecastCell, PoolCandidate, Recommendation } from "@ps02/shared";

/* ------------------------------------------------------------------ */
/* Admin overview                                                      */
/* ------------------------------------------------------------------ */

export interface OverviewMetrics {
  totalDrivers: number;
  availableDrivers: number;
  busyDrivers: number;
  offlineDrivers: number;
  activeRides: number;
  completedRidesToday: number;
  acceptedRidesToday: number;
  averagePassengerWaitSec: number | null;
  driverUtilization: number;
  totalPassengers: number;
}

export async function getOverview(): Promise<OverviewMetrics> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [totalDrivers, availableDrivers, busyDrivers, offlineDrivers, activeRides, completedRidesToday, totalPassengers, acceptedToday, driverAgg] =
    await Promise.all([
      prisma.driver.count(),
      prisma.driver.count({ where: { status: DriverStatus.AVAILABLE } }),
      prisma.driver.count({ where: { status: DriverStatus.BUSY } }),
      prisma.driver.count({ where: { status: DriverStatus.OFFLINE } }),
      prisma.ride.count({
        where: {
          status: {
            in: [
              PrismaRideStatus.REQUESTED,
              PrismaRideStatus.ACCEPTED,
              PrismaRideStatus.ARRIVING,
              PrismaRideStatus.ARRIVED,
              PrismaRideStatus.ONGOING,
              PrismaRideStatus.REASSIGNING,
            ],
          },
        },
      }),
      prisma.ride.count({
        where: { status: PrismaRideStatus.COMPLETED, completedAt: { gte: startOfDay } },
      }),
      prisma.user.count({ where: { role: Role.PASSENGER } }),
      prisma.ride.findMany({
        where: { acceptedAt: { gte: startOfDay } },
        select: { requestedAt: true, acceptedAt: true },
      }),
      prisma.driver.aggregate({ _sum: { busyMinutesToday: true } }),
    ]);

  const waits = acceptedToday
    .filter((ride) => ride.acceptedAt)
    .map((ride) => (ride.acceptedAt!.getTime() - ride.requestedAt.getTime()) / 1000)
    .filter((seconds) => seconds >= 0);

  const averagePassengerWaitSec =
    waits.length > 0 ? round2(waits.reduce((sum, value) => sum + value, 0) / waits.length) : null;

  const minutesSinceMidnight = Math.max(1, (Date.now() - startOfDay.getTime()) / 60_000);
  const capacity = Math.max(1, totalDrivers) * minutesSinceMidnight;
  const driverUtilization = round2(Math.min(1, (driverAgg._sum.busyMinutesToday ?? 0) / capacity));

  return {
    totalDrivers,
    availableDrivers,
    busyDrivers,
    offlineDrivers,
    activeRides,
    completedRidesToday,
    acceptedRidesToday: waits.length,
    averagePassengerWaitSec,
    driverUtilization,
    totalPassengers,
  };
}

/* ------------------------------------------------------------------ */
/* Fleet + ride management lists                                       */
/* ------------------------------------------------------------------ */

export async function listDriversForAdmin() {
  const drivers = await prisma.driver.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return drivers.map((driver) => ({
    id: driver.id,
    name: driver.user.name,
    email: driver.user.email,
    vehicleType: driver.vehicleType,
    status: driver.status as SharedDriverStatus,
    lat: driver.lat,
    lng: driver.lng,
    acceptanceRate: driver.acceptanceRate,
    completedToday: driver.completedToday,
    busyMinutesToday: driver.busyMinutesToday,
    isSimulated: driver.isSimulated,
    lastIdleSince: driver.lastIdleSince.toISOString(),
  }));
}

export async function listRidesForAdmin(limit = 50) {
  const rides = await prisma.ride.findMany({
    orderBy: { requestedAt: "desc" },
    take: limit,
    include: {
      passenger: { select: { name: true } },
      driver: { include: { user: { select: { name: true } } } },
    },
  });

  return rides.map((ride) => ({
    id: ride.id,
    status: ride.status as SharedRideStatus,
    passengerName: ride.passenger.name,
    driverId: ride.driverId,
    driverName: ride.driver?.user.name ?? null,
    pickup: { lat: ride.pickupLat, lng: ride.pickupLng },
    drop: { lat: ride.dropLat, lng: ride.dropLng },
    distanceKm: ride.distanceKm,
    fareEstimate: ride.fareEstimate,
    fareFinal: ride.fareFinal,
    surgeMultiplier: ride.surgeMultiplier,
    requestedAt: ride.requestedAt.toISOString(),
    completedAt: ride.completedAt?.toISOString() ?? null,
  }));
}

export async function listRecentEvents(limit = 60) {
  const events = await prisma.rideEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { ride: { select: { status: true } } },
  });

  return events.map((event) => ({
    id: event.id,
    rideId: event.rideId,
    type: event.type,
    message: event.message,
    rideStatus: event.ride.status as SharedRideStatus,
    createdAt: event.createdAt.toISOString(),
  }));
}

/* ------------------------------------------------------------------ */
/* Demand intelligence                                                 */
/* ------------------------------------------------------------------ */

export interface ForecastComparison {
  hourOfDay: number;
  cells: ForecastCell[];
  totals: { predicted: number; actual: number; difference: number };
}

export async function getForecastComparison(hourOfDay: number): Promise<ForecastComparison> {
  const [forecasts, history] = await Promise.all([
    prisma.demandForecast.findMany({ where: { hourOfDay } }),
    prisma.demandHistory.findMany({ where: { hourOfDay }, select: { zoneId: true, demand: true } }),
  ]);

  const actualBuckets = new Map<string, number[]>();
  for (const row of history) {
    const list = actualBuckets.get(row.zoneId) ?? [];
    list.push(row.demand);
    actualBuckets.set(row.zoneId, list);
  }

  const cells: ForecastCell[] = forecasts.map((forecast) => {
    const samples = actualBuckets.get(forecast.zoneId) ?? [];
    const actual =
      samples.length > 0 ? round2(samples.reduce((sum, value) => sum + value, 0) / samples.length) : undefined;
    return {
      zoneId: forecast.zoneId,
      hourOfDay,
      predictedDemand: round2(forecast.predictedDemand),
      actualDemand: actual,
      difference: actual === undefined ? undefined : round2(forecast.predictedDemand - actual),
    };
  });

  const predicted = round2(cells.reduce((sum, cell) => sum + cell.predictedDemand, 0));
  const actual = round2(cells.reduce((sum, cell) => sum + (cell.actualDemand ?? 0), 0));

  return {
    hourOfDay,
    cells: cells.sort((a, b) => b.predictedDemand - a.predictedDemand),
    totals: { predicted, actual, difference: round2(predicted - actual) },
  };
}

export async function getDemandIntelligence(hourOfDay?: number): Promise<{
  metrics: ZoneMetrics;
  recommendations: Recommendation[];
  forecast: { predictedTotal: number; actualTotal: number; hours: number[] };
}> {
  const metrics = await getZoneMetrics({ hourOfDay });
  const recommendations = buildRecommendations(metrics.zones);

  const [forecastCount, historyCount] = await Promise.all([
    prisma.demandForecast.count(),
    prisma.demandHistory.count(),
  ]);

  return {
    metrics,
    recommendations,
    forecast: {
      predictedTotal: forecastCount,
      actualTotal: historyCount,
      hours: Array.from({ length: 24 }, (_, hour) => hour),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Pooling + allocation inspection                                     */
/* ------------------------------------------------------------------ */

export interface PoolCandidateGroup {
  rideIds: string[];
  plan: ReturnType<typeof planPool>;
}

export async function getPoolCandidates(): Promise<{ candidates: PoolCandidate[]; groups: PoolCandidateGroup[] }> {
  const rides = await prisma.ride.findMany({
    where: { status: PrismaRideStatus.REQUESTED, poolGroupId: null },
    orderBy: { requestedAt: "asc" },
    take: 12,
  });

  const candidates: PoolCandidate[] = rides.map((ride) => ({
    rideId: ride.id,
    pickup: { lat: ride.pickupLat, lng: ride.pickupLng },
    drop: { lat: ride.dropLat, lng: ride.dropLng },
    soloDistanceKm: ride.distanceKm,
    soloDurationMin: ride.etaMin,
    soloFare: ride.fareEstimate,
  }));

  const groups: PoolCandidateGroup[] = [];

  for (const group of groupPoolCandidates(candidates)) {
    const stops = stopsForMatrix(group);
    const matrix: PoolMatrix = {
      distancesKm: stops.map((a) => stops.map((b) => haversineKm(a, b) * 1.3)),
      durationsMin: stops.map((a) =>
        stops.map((b) => ((haversineKm(a, b) * 1.3) / 24) * 60),
      ),
    };
    const plan = planPool(group, matrix);
    groups.push({ rideIds: group.map((candidate) => candidate.rideId), plan });
  }

  return { candidates, groups };
}

export async function getAllocationSnapshots(limit = 20) {
  const rides = await prisma.ride.findMany({
    where: { driverId: { not: null } },
    orderBy: { requestedAt: "desc" },
    take: limit * 3,
    include: { driver: { include: { user: { select: { name: true } } } } },
  });

  return rides
    .filter((ride) => Array.isArray(ride.allocationScores))
    .slice(0, limit)
    .map((ride) => {
      const scores = Array.isArray(ride.allocationScores) ? ride.allocationScores : [];
      return {
        rideId: ride.id,
        status: ride.status as SharedRideStatus,
        pickup: { lat: ride.pickupLat, lng: ride.pickupLng },
        drop: { lat: ride.dropLat, lng: ride.dropLng },
        assignedDriverId: ride.driverId,
        assignedDriverName: ride.driver?.user.name ?? null,
        requestedAt: ride.requestedAt.toISOString(),
        scores: scores.slice(0, 5),
      };
    });
}

export async function getEvaluationHistory(limit = 20) {
  return listLatestRuns(limit);
}
