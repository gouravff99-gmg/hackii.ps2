import {
  DriverStatus as PrismaDriverStatus,
  RideStatus as PrismaRideStatus,
  VehicleCategory as PrismaVehicleCategory,
} from "@prisma/client";
import {
  AREA_CATEGORIES,
  BELAGAVI_AREAS,
  DEMAND_TIME_WINDOWS,
  DemoScenario,
  DemandTrend,
  VehicleCategory,
  areaForPoint,
  demandLevelFromScore,
  generateAreaDemand,
  generateDistrictDemand,
  haversineKm,
  isWeekendDay,
  resolveTimeWindow,
  type AreaCategoryView,
  type AreaDataConfidence,
  type AreaDataSource,
  type AreaDemandResponse,
  type AreaDemandView,
  type AreaPoolView,
  type DemandTimeWindow,
  type DemandWindowId,
  type DriverAreaOpportunitiesResponse,
  type DriverAreaOpportunity,
  type PoolDemand,
} from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { eligibleDriverWhere } from "./driverEligibility";

export type AreaSourceMode = "auto" | "demo" | "live";

export interface AreaDemandQuery {
  scenario?: DemoScenario;
  dayOfWeek?: number;
  windowId?: DemandWindowId;
  hour?: number;
  source?: AreaSourceMode;
  /** Inclusive local date (YYYY-MM-DD) used for live historical counts. */
  date?: string;
  category?: VehicleCategory;
  origin?: { lat: number; lng: number };
  now?: Date;
}

const LIVE_LOOKBACK_DAYS = 7;
const POOL_SEATS_PER_VEHICLE = 4;
const DISCLAIMER =
  "DEMO values are deterministic synthetic estimates for presentation, not measured Belagavi statistics. LIVE values come from real RideOps rides and drivers. Operational-zone polygons are approximate and are not official administrative boundaries.";

type LiveRideRow = {
  pickupLat: number;
  pickupLng: number;
  category: PrismaVehicleCategory;
  status: PrismaRideStatus;
};

type LiveDriverRow = {
  lat: number;
  lng: number;
  status: PrismaDriverStatus;
  vehicleCategory: PrismaVehicleCategory;
  poolEnabled: boolean;
  seatCapacity: number;
};

interface AreaLiveCounts {
  rides: Record<VehicleCategory, number>;
  pending: Record<VehicleCategory, number>;
  available: Record<VehicleCategory, number>;
  busy: Record<VehicleCategory, number>;
  poolVehicles: number;
  poolSeatCapacity: number;
  poolOccupiedSeats: number;
}

const PENDING_STATUSES: PrismaRideStatus[] = [
  PrismaRideStatus.REQUESTED,
  PrismaRideStatus.REASSIGNING,
];

function emptyCategoryCount(): Record<VehicleCategory, number> {
  return {
    [VehicleCategory.BIKE]: 0,
    [VehicleCategory.CAR]: 0,
    [VehicleCategory.POOL]: 0,
  };
}

function emptyLiveCounts(): AreaLiveCounts {
  return {
    rides: emptyCategoryCount(),
    pending: emptyCategoryCount(),
    available: emptyCategoryCount(),
    busy: emptyCategoryCount(),
    poolVehicles: 0,
    poolSeatCapacity: 0,
    poolOccupiedSeats: 0,
  };
}

function toSharedCategory(value: PrismaVehicleCategory): VehicleCategory {
  if (value === PrismaVehicleCategory.BIKE) return VehicleCategory.BIKE;
  if (value === PrismaVehicleCategory.POOL) return VehicleCategory.POOL;
  return VehicleCategory.CAR;
}

/** Date range for live counts; defaults to the trailing 7 days. */
function liveRange(date: string | undefined, now: Date): { gte: Date; lte: Date } {
  if (date) {
    const start = new Date(`${date}T00:00:00`);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start.getTime() + 24 * 60 * 60_000);
      return { gte: start, lte: end };
    }
  }
  return { gte: new Date(now.getTime() - LIVE_LOOKBACK_DAYS * 24 * 60 * 60_000), lte: now };
}

function dataConfidenceFor(category: AreaCategoryView): AreaDataConfidence {
  const samples = category.liveRequests + category.liveAvailableDrivers + category.liveBusyDrivers;
  if (samples >= 6) return "HIGH";
  if (samples >= 2) return "MEDIUM";
  return "LOW";
}

async function loadLiveCounts(
  now: Date,
  date: string | undefined,
): Promise<Map<string, AreaLiveCounts>> {
  const range = liveRange(date, now);
  const [rides, drivers] = await Promise.all([
    prisma.ride.findMany({
      where: {
        OR: [
          { requestedAt: { gte: range.gte, lte: range.lte } },
          { status: { in: PENDING_STATUSES } },
        ],
      },
      select: { pickupLat: true, pickupLng: true, category: true, status: true },
    }),
    prisma.driver.findMany({
      where: {
        AND: [
          eligibleDriverWhere({ now }),
          {
            status: {
              in: [PrismaDriverStatus.AVAILABLE, PrismaDriverStatus.BUSY],
            },
          },
        ],
      },
      select: {
        lat: true,
        lng: true,
        status: true,
        vehicleCategory: true,
        poolEnabled: true,
        seatCapacity: true,
      },
    }),
  ]);

  const byArea = new Map<string, AreaLiveCounts>();

  for (const ride of rides as LiveRideRow[]) {
    const area = areaForPoint({ lat: ride.pickupLat, lng: ride.pickupLng });
    if (!area) continue;
    const counts = byArea.get(area.id) ?? emptyLiveCounts();
    const category = toSharedCategory(ride.category);
    counts.rides[category] += 1;
    if (PENDING_STATUSES.includes(ride.status)) counts.pending[category] += 1;
    if (category === VehicleCategory.POOL) {
      // Each pool ride currently occupies one seat; co-rider merging is not
      // modelled yet, so we never inflate this into "multiple cars".
      counts.poolOccupiedSeats += 1;
    }
    byArea.set(area.id, counts);
  }

  for (const driver of drivers as LiveDriverRow[]) {
    const area = areaForPoint({ lat: driver.lat, lng: driver.lng });
    if (!area) continue;
    const counts = byArea.get(area.id) ?? emptyLiveCounts();
    const category = toSharedCategory(driver.vehicleCategory);
    if (driver.status === PrismaDriverStatus.AVAILABLE) counts.available[category] += 1;
    if (driver.status === PrismaDriverStatus.BUSY) counts.busy[category] += 1;
    if (category === VehicleCategory.POOL && driver.poolEnabled) {
      // One car is one vehicle regardless of seat count.
      counts.poolVehicles += 1;
      counts.poolSeatCapacity += Math.max(1, driver.seatCapacity);
    }
    byArea.set(area.id, counts);
  }

  return byArea;
}

function availabilityFrom(
  requests: number,
  availableDrivers: number,
  window: DemandTimeWindow,
): AreaCategoryView["availability"] {
  if (requests === 0 && availableDrivers === 0) return "INSUFFICIENT_DATA";
  if (requests === 0) return "GOOD";
  if (availableDrivers === 0) return "HIGH_PRESSURE";
  const hourly = requests / Math.max(1, window.endHour - window.startHour);
  const coverage = availableDrivers / Math.max(1, hourly);
  if (coverage >= 1) return "GOOD";
  if (coverage >= 0.5) return "MODERATE";
  if (coverage >= 0.25) return "LIMITED";
  return "HIGH_PRESSURE";
}

function trendFrom(
  current: number,
  previous: number,
): AreaCategoryView["trend"] {
  const change = (current - previous) / Math.max(1, previous);
  if (change >= 0.15) return DemandTrend.RISING;
  if (change <= -0.15) return DemandTrend.FALLING;
  return DemandTrend.STEADY;
}

const CONFIDENCE_RANK: Record<AreaDataConfidence, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

function strongestConfidence(values: AreaDataConfidence[]): AreaDataConfidence {
  return values.reduce<AreaDataConfidence>(
    (best, value) => (CONFIDENCE_RANK[value] > CONFIDENCE_RANK[best] ? value : best),
    "LOW",
  );
}

function mergePool(
  demo: PoolDemand | undefined,
  live: {
    vehicles: number;
    seatCapacity: number;
    occupiedSeats: number;
  },
  requests: number,
): AreaPoolView | undefined {
  if (!demo && live.vehicles === 0) return undefined;
  const activeVehicles = (demo?.activeVehicles ?? 0) + live.vehicles;
  const seatCapacity = (demo?.seatCapacity ?? 0) + live.seatCapacity;
  const occupiedSeats = Math.min(
    seatCapacity,
    (demo?.occupiedSeats ?? 0) + live.occupiedSeats,
  );
  const availableSeats = Math.max(0, seatCapacity - occupiedSeats);
  return {
    activeVehicles,
    seatCapacity,
    occupiedSeats,
    availableSeats,
    compatibleRequests: demo?.compatibleRequests ?? Math.round(requests * 0.35),
    estimatedWaitMin: Math.min(
      45,
      3 + Math.round(requests / Math.max(1, availableSeats || 1)),
    ),
    estimatedDetourMin: demo?.estimatedDetourMin ?? Math.round(2 + requests / 12),
    liveVehicles: live.vehicles,
    liveSeatCapacity: live.seatCapacity,
    liveOccupiedSeats: live.occupiedSeats,
    liveAvailableSeats: Math.max(0, live.seatCapacity - live.occupiedSeats),
  };
}

/**
 * Merge deterministic DEMO baseline with LIVE DB rows for the requested
 * filters. Values are never silently mixed: each area/category carries a
 * source label and live counts are reported separately.
 */
export async function getAreaDemand(query: AreaDemandQuery = {}): Promise<AreaDemandResponse> {
  const now = query.now ?? new Date();
  const scenario = query.scenario ?? DemoScenario.NORMAL;
  const dayOfWeek = query.dayOfWeek ?? now.getDay();
  const window =
    DEMAND_TIME_WINDOWS.find((entry) => entry.id === query.windowId) ??
    resolveTimeWindow(query.hour ?? now.getHours());
  const isWeekend = scenario === DemoScenario.WEEKEND || isWeekendDay(dayOfWeek);
  const sourceMode: AreaSourceMode = query.source ?? "auto";
  const selectedCategory = query.category ?? VehicleCategory.CAR;

  const demoSnapshots = generateAreaDemand({ scenario, dayOfWeek, windowId: window.id });
  const windowIndex = DEMAND_TIME_WINDOWS.findIndex((entry) => entry.id === window.id);
  const previousWindow =
    DEMAND_TIME_WINDOWS[(windowIndex - 1 + DEMAND_TIME_WINDOWS.length) % DEMAND_TIME_WINDOWS.length];
  const previousByArea = new Map(
    generateAreaDemand({ scenario, dayOfWeek, windowId: previousWindow.id }).map((snapshot) => [
      snapshot.areaId,
      snapshot,
    ]),
  );
  const liveByArea =
    sourceMode === "demo" ? new Map<string, AreaLiveCounts>() : await loadLiveCounts(now, query.date);

  // First pass: compute requests/available per area so we can normalise scores
  // against the actual displayed values.
  type Draft = {
    snapshot: (typeof demoSnapshots)[number];
    counts: Record<
      VehicleCategory,
      {
        requests: number;
        available: number;
        busy: number;
        pending: number;
        liveRequests: number;
        liveAvailable: number;
        liveBusy: number;
        source: AreaDataSource;
        pool?: AreaPoolView;
      }
    >;
  };

  const drafts: Draft[] = demoSnapshots.map((snapshot) => {
    const live = liveByArea.get(snapshot.areaId) ?? emptyLiveCounts();
    const counts = {} as Draft["counts"];
    for (const category of AREA_CATEGORIES) {
      const demo = snapshot.categories[category];
      const liveRequests = sourceMode === "demo" ? 0 : live.rides[category];
      const liveAvailable = sourceMode === "demo" ? 0 : live.available[category];
      const liveBusy = sourceMode === "demo" ? 0 : live.busy[category];
      const livePending = sourceMode === "demo" ? 0 : live.pending[category];

      let requests = demo.requests;
      let available = demo.availableDrivers;
      let busy = demo.busyDrivers;
      let pending = demo.pendingRequests;
      let source: AreaDataSource = "DEMO";

      if (sourceMode === "live") {
        requests = liveRequests;
        available = liveAvailable;
        busy = liveBusy;
        pending = livePending;
        source = "LIVE";
      } else if (sourceMode === "auto") {
        requests = demo.requests + liveRequests;
        available = demo.availableDrivers + liveAvailable;
        busy = demo.busyDrivers + liveBusy;
        pending = demo.pendingRequests + livePending;
        source = liveRequests + liveAvailable + liveBusy > 0 ? "BLENDED" : "DEMO";
      }

      counts[category] = {
        requests,
        available,
        busy,
        pending,
        liveRequests,
        liveAvailable,
        liveBusy,
        source,
        pool:
          category === VehicleCategory.POOL
            ? mergePool(
                demo.pool,
                {
                  vehicles: live.poolVehicles,
                  seatCapacity: live.poolSeatCapacity,
                  occupiedSeats: live.poolOccupiedSeats,
                },
                requests,
              )
            : undefined,
      };
    }
    return { snapshot, counts };
  });

  const maxima: Record<VehicleCategory, number> = {
    [VehicleCategory.BIKE]: 1,
    [VehicleCategory.CAR]: 1,
    [VehicleCategory.POOL]: 1,
  };
  for (const category of AREA_CATEGORIES) {
    maxima[category] = Math.max(1, ...drafts.map((draft) => draft.counts[category].requests));
  }

  const areas: AreaDemandView[] = drafts.map(({ snapshot, counts }) => {
    const categories = {} as Record<VehicleCategory, AreaCategoryView>;
    const sources = new Set<AreaDataSource>();
    for (const category of AREA_CATEGORIES) {
      const draft = counts[category];
      const demo = snapshot.categories[category];
      const score = Math.round((draft.requests / maxima[category]) * 100);
      const level = demandLevelFromScore(score);
      const gapShare = draft.pending / Math.max(1, draft.pending + draft.available);
      const waitMin =
        draft.pending > 0
          ? Math.min(45, 3 + Math.round((draft.pending / Math.max(1, draft.available)) * 4))
          : 2;
      const seatPressure =
        draft.pool && draft.pool.seatCapacity > 0
          ? 1 - draft.pool.availableSeats / draft.pool.seatCapacity
          : 0;
      categories[category] = {
        category,
        requests: draft.requests,
        availableDrivers: draft.available,
        busyDrivers: draft.busy,
        pendingRequests: draft.pending,
        demandScore: score,
        demandLevel: level,
        trend: trendFrom(
          draft.requests,
          previousByArea.get(snapshot.areaId)?.categories[category].requests ?? 0,
        ),
        estimatedWaitMin: waitMin,
        availability:
          sourceMode === "live"
            ? availabilityFrom(draft.requests, draft.available, window)
            : demo.availability,
        opportunityScore: Math.round(
          Math.min(100, score * 0.5 + gapShare * 35 + seatPressure * 15),
        ),
        source: draft.source,
        liveRequests: draft.liveRequests,
        liveAvailableDrivers: draft.liveAvailable,
        liveBusyDrivers: draft.liveBusy,
        livePendingRequests: sourceMode === "demo" ? 0 : liveByArea.get(snapshot.areaId)?.pending[category] ?? 0,
        pool: draft.pool,
      };
      sources.add(draft.source);
    }

    const base = BELAGAVI_AREAS.find((area) => area.id === snapshot.areaId);
    return {
      areaId: snapshot.areaId,
      name: snapshot.name,
      state: "Karnataka",
      district: snapshot.district,
      taluk: snapshot.taluk,
      city: snapshot.city,
      kind: snapshot.kind,
      center: snapshot.center,
      polygon: snapshot.polygon,
      boundaryKind: snapshot.boundaryKind,
      note: snapshot.note,
      windowId: snapshot.windowId,
      windowLabel: snapshot.windowLabel,
      dayOfWeek,
      isWeekend,
      scenario,
      peakWindowId: snapshot.peakWindowId,
      peakWindowLabel: snapshot.peakWindowLabel,
      categories,
      distanceKm: query.origin && base
        ? Math.round(haversineKm(query.origin, base.center) * 100) / 100
        : undefined,
      sources: [...sources],
      dataConfidence: strongestConfidence(
        (Object.values(categories) as AreaCategoryView[]).map(dataConfidenceFor),
      ),
    };
  });

  const totals = {
    requests: 0,
    bikeRequests: 0,
    carRequests: 0,
    poolRequests: 0,
    availableDrivers: 0,
    busyDrivers: 0,
    pendingRequests: 0,
    poolActiveVehicles: 0,
    poolAvailableSeats: 0,
    liveRequests: 0,
  };
  for (const area of areas) {
    for (const category of AREA_CATEGORIES) {
      const view = area.categories[category];
      totals.requests += view.requests;
      totals.availableDrivers += view.availableDrivers;
      totals.busyDrivers += view.busyDrivers;
      totals.pendingRequests += view.pendingRequests;
      totals.liveRequests += view.liveRequests;
      if (category === VehicleCategory.BIKE) totals.bikeRequests += view.requests;
      if (category === VehicleCategory.CAR) totals.carRequests += view.requests;
      if (category === VehicleCategory.POOL) {
        totals.poolRequests += view.requests;
        totals.poolActiveVehicles += view.pool?.activeVehicles ?? 0;
        totals.poolAvailableSeats += view.pool?.availableSeats ?? 0;
      }
    }
  }

  const anyLive = areas.some((area) => area.sources.includes("LIVE") || area.sources.includes("BLENDED"));
  const anyDemo = areas.some((area) => area.sources.includes("DEMO") || area.sources.includes("BLENDED"));
  const source: AreaDataSource =
    sourceMode === "demo" ? "DEMO" : anyLive && anyDemo ? "BLENDED" : anyLive ? "LIVE" : "DEMO";

  return {
    source,
    generatedAt: now.toISOString(),
    scenario,
    dayOfWeek,
    isWeekend,
    windowId: window.id,
    windowLabel: window.label,
    timeWindows: [...DEMAND_TIME_WINDOWS],
    hierarchy: {
      state: "Karnataka",
      district: "Belagavi",
      taluk: "Belagavi",
      city: "Belagavi",
    },
    areas,
    districts: generateDistrictDemand({ scenario, dayOfWeek, windowId: window.id }),
    totals,
    selectedCategory,
    disclaimer: DISCLAIMER,
  };
}

function opportunityReason(category: AreaCategoryView, distanceKm: number, areaName: string): string {
  const level = category.demandLevel.toLowerCase().replace("_", " ");
  if (category.pendingRequests > category.availableDrivers) {
    return `${areaName} — ${level} demand with a supply gap`;
  }
  if (category.demandLevel === "HIGH" || category.demandLevel === "VERY_HIGH" || category.demandLevel === "CRITICAL") {
    return `${areaName} — ${level} demand`;
  }
  if (distanceKm <= 2) return `${areaName} — close by, steady demand`;
  return `${areaName} — ${level} demand`;
}

/**
 * Vehicle-specific opportunities for one driver. Read-only: never moves the
 * driver or fabricates their GPS position.
 */
export async function getDriverAreaOpportunities(
  driverId: string,
  options: { category?: VehicleCategory; windowId?: DemandWindowId; scenario?: DemoScenario } = {},
): Promise<DriverAreaOpportunitiesResponse> {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { id: true, lat: true, lng: true, vehicleCategory: true, poolEnabled: true },
  });
  if (!driver) {
    throw ApiError.notFound("Driver profile not found");
  }

  const category =
    options.category ??
    (toSharedCategory(driver.vehicleCategory) === VehicleCategory.POOL && driver.poolEnabled
      ? VehicleCategory.POOL
      : toSharedCategory(driver.vehicleCategory));

  const demand = await getAreaDemand({
    scenario: options.scenario,
    windowId: options.windowId,
    source: "auto",
    category,
  });

  const opportunities: DriverAreaOpportunity[] = demand.areas.map((area) => {
    const view = area.categories[category];
    const distanceKm = Math.round(haversineKm({ lat: driver.lat, lng: driver.lng }, area.center) * 100) / 100;
    const travelEtaMin = Math.max(1, Math.round((distanceKm * 1.3 * 60) / 24));
    const distancePenalty = Math.min(30, distanceKm * 2.5);
    const score = Math.max(0, Math.min(100, Math.round(view.opportunityScore - distancePenalty)));
    return {
      areaId: area.areaId,
      name: area.name,
      category,
      demandLevel: view.demandLevel,
      demandScore: view.demandScore,
      opportunityScore: score,
      demandTrend: view.trend,
      availableDrivers: view.availableDrivers,
      pendingRequests: view.pendingRequests,
      distanceKm,
      travelEtaMin,
      poolAvailableSeats: view.pool?.availableSeats ?? 0,
      source: view.source,
      reason: opportunityReason(view, distanceKm, area.name),
    };
  });

  return {
    driverId: driver.id,
    category,
    generatedAt: demand.generatedAt,
    windowId: demand.windowId,
    windowLabel: demand.windowLabel,
    areas: opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore),
  };
}
