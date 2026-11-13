import {
  AreaKind,
  DemandLevel as Level,
  DemandTrend as Trend,
  DemoScenario,
  VehicleCategory,
  type VehicleCategory as Category,
} from "./enums";
import type { ZoneAvailability } from "./types";
import {
  BELAGAVI_AREAS,
  DEMAND_TIME_WINDOWS,
  DEMAND_LEVEL_LABEL,
  demandLevelFromScore,
  isWeekendDay,
  type DemandTimeWindow,
  type DemandWindowId,
  type MobilityArea,
} from "./mobilityAreas";
import { KARNATAKA_DEMO_DISTRICTS } from "./karnatakaDemo";

/**
 * Deterministic Belagavi demand engine.
 *
 * The evening-peak base numbers below are the illustrative seed from the
 * product brief. They are synthetic scenario values, not measured statistics.
 * Every other window/day/scenario is derived by deterministic multipliers, so
 * the same filters always return the same values (no refresh randomness).
 */

type CategoryRecord = Record<Category, number>;

/** Illustrative weekday 18:00–21:00 base (Bike / Car / Pool requests). */
const EVENING_BASE: Record<string, CategoryRecord> = {
  tilakwadi: { BIKE: 42, CAR: 30, POOL: 16 },
  shahapur: { BIKE: 34, CAR: 22, POOL: 12 },
  vadgaon: { BIKE: 28, CAR: 20, POOL: 10 },
  angol: { BIKE: 25, CAR: 18, POOL: 9 },
  udyambag: { BIKE: 38, CAR: 27, POOL: 14 },
  camp: { BIKE: 31, CAR: 24, POOL: 13 },
  hindwadi: { BIKE: 20, CAR: 15, POOL: 7 },
  "nehru-nagar": { BIKE: 23, CAR: 17, POOL: 8 },
  "bus-stand": { BIKE: 48, CAR: 39, POOL: 19 },
  "railway-station": { BIKE: 40, CAR: 34, POOL: 18 },
};

const WINDOW_SHAPE: Record<DemandWindowId, number> = {
  LATE_NIGHT: 0.11,
  MORNING_COMMUTE: 0.78,
  MORNING_ACTIVITY: 0.55,
  AFTERNOON: 0.46,
  EVENING_TRANSITION: 0.72,
  EVENING_PEAK: 1,
  NIGHT: 0.36,
};

/** Kind-specific time-of-day bias. EVENING_PEAK is always the 1.0 reference. */
const KIND_SHAPE: Record<AreaKind, Partial<Record<DemandWindowId, number>>> = {
  TRANSPORT_HUB: { LATE_NIGHT: 1.3, MORNING_COMMUTE: 1.35, NIGHT: 1.25 },
  INDUSTRIAL: { MORNING_COMMUTE: 1.5, EVENING_TRANSITION: 1.2, NIGHT: 1.3 },
  RESIDENTIAL: { MORNING_COMMUTE: 1.12, MORNING_ACTIVITY: 0.95 },
  COMMERCIAL: { MORNING_ACTIVITY: 1.2, AFTERNOON: 1.25, EVENING_TRANSITION: 1.15 },
  EDUCATION: { MORNING_COMMUTE: 1.3, AFTERNOON: 1.18, EVENING_TRANSITION: 1.1 },
  MIXED: {},
};

const CATEGORY_SHAPE: Record<Category, Partial<Record<DemandWindowId, number>>> = {
  BIKE: { LATE_NIGHT: 0.8, MORNING_COMMUTE: 1.15, NIGHT: 0.9 },
  CAR: { LATE_NIGHT: 1.25, MORNING_COMMUTE: 0.95, NIGHT: 1.2 },
  POOL: { LATE_NIGHT: 0.6, MORNING_COMMUTE: 1.1, NIGHT: 0.8 },
};

const WEEKEND_SHAPE: Record<DemandWindowId, CategoryRecord> = {
  LATE_NIGHT: { BIKE: 1.4, CAR: 1.3, POOL: 1.2 },
  MORNING_COMMUTE: { BIKE: 0.65, CAR: 0.75, POOL: 0.55 },
  MORNING_ACTIVITY: { BIKE: 0.85, CAR: 0.85, POOL: 0.8 },
  AFTERNOON: { BIKE: 0.95, CAR: 1.0, POOL: 0.9 },
  EVENING_TRANSITION: { BIKE: 1.05, CAR: 1.05, POOL: 1.1 },
  EVENING_PEAK: { BIKE: 1.0, CAR: 1.0, POOL: 1.05 },
  NIGHT: { BIKE: 1.25, CAR: 1.2, POOL: 1.1 },
};

const SCENARIO_SHAPE: Record<DemoScenario, Partial<Record<DemandWindowId, number>>> = {
  [DemoScenario.NORMAL]: {},
  [DemoScenario.MORNING_PEAK]: { MORNING_COMMUTE: 1.45, MORNING_ACTIVITY: 1.15, LATE_NIGHT: 0.9, EVENING_PEAK: 0.9 },
  [DemoScenario.EVENING_PEAK]: { EVENING_TRANSITION: 1.15, EVENING_PEAK: 1.45, NIGHT: 1.1, MORNING_COMMUTE: 0.9 },
  [DemoScenario.WEEKEND]: {},
  [DemoScenario.LOW_DEMAND]: {
    LATE_NIGHT: 0.55, MORNING_COMMUTE: 0.55, MORNING_ACTIVITY: 0.55, AFTERNOON: 0.55,
    EVENING_TRANSITION: 0.55, EVENING_PEAK: 0.55, NIGHT: 0.55,
  },
  [DemoScenario.HIGH_DEMAND_EVENT]: { EVENING_TRANSITION: 1.2, EVENING_PEAK: 1.75, NIGHT: 1.4, MORNING_COMMUTE: 0.95 },
};

const EVENT_HUB_BOOST = 1.2;
const POOL_SEATS_PER_VEHICLE = 4;
const SUPPLY_DIVISOR: CategoryRecord = { BIKE: 6, CAR: 5, POOL: 8 };

export interface PoolDemand {
  /** Pool-enabled cars. One car is one vehicle, never one seat. */
  activeVehicles: number;
  seatCapacity: number;
  occupiedSeats: number;
  availableSeats: number;
  compatibleRequests: number;
  estimatedWaitMin: number;
  estimatedDetourMin: number;
}

export interface CategoryDemand {
  category: Category;
  requests: number;
  availableDrivers: number;
  busyDrivers: number;
  pendingRequests: number;
  demandScore: number;
  demandLevel: Level;
  trend: Trend;
  estimatedWaitMin: number;
  availability: ZoneAvailability;
  opportunityScore: number;
  pool?: PoolDemand;
}

export interface AreaDemandSnapshot {
  areaId: string;
  name: string;
  district: string;
  taluk: string;
  city: string;
  kind: AreaKind;
  center: { lat: number; lng: number };
  polygon: { lat: number; lng: number }[];
  boundaryKind: "OPERATIONAL_ZONE";
  note: string;
  windowId: DemandWindowId;
  windowLabel: string;
  dayOfWeek: number;
  isWeekend: boolean;
  scenario: DemoScenario;
  peakWindowId: DemandWindowId;
  peakWindowLabel: string;
  categories: Record<Category, CategoryDemand>;
}

export interface AreaDemandOptions {
  scenario?: DemoScenario;
  dayOfWeek?: number;
  windowId?: DemandWindowId;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function shapeFor(area: MobilityArea, category: Category, windowId: DemandWindowId): number {
  return (
    WINDOW_SHAPE[windowId] *
    (KIND_SHAPE[area.kind][windowId] ?? 1) *
    (CATEGORY_SHAPE[category][windowId] ?? 1)
  );
}

function requestCount(
  area: MobilityArea,
  category: Category,
  windowId: DemandWindowId,
  isWeekend: boolean,
  scenario: DemoScenario,
): number {
  const base = EVENING_BASE[area.id]?.[category] ?? 10;
  const eventBoost =
    scenario === DemoScenario.HIGH_DEMAND_EVENT &&
    (area.kind === AreaKind.TRANSPORT_HUB || area.kind === AreaKind.COMMERCIAL)
      ? EVENT_HUB_BOOST
      : 1;
  const weekend = isWeekend ? WEEKEND_SHAPE[windowId][category] : 1;
  const scenarioFactor = SCENARIO_SHAPE[scenario][windowId] ?? 1;
  return Math.max(0, Math.round(base * shapeFor(area, category, windowId) * weekend * scenarioFactor * eventBoost));
}

function supplyFor(
  area: MobilityArea,
  category: Category,
  windowId: DemandWindowId,
  scenario: DemoScenario,
): number {
  const base = EVENING_BASE[area.id]?.[category] ?? 10;
  const availability = Math.max(0.25, WINDOW_SHAPE[windowId] ** 0.6);
  const scenarioFactor = scenario === DemoScenario.LOW_DEMAND ? 1.15 : scenario === DemoScenario.HIGH_DEMAND_EVENT ? 0.85 : 1;
  return Math.max(1, Math.round((base / SUPPLY_DIVISOR[category]) * availability * scenarioFactor));
}

function trendFor(
  area: MobilityArea,
  category: Category,
  windowId: DemandWindowId,
  isWeekend: boolean,
  scenario: DemoScenario,
): Trend {
  const index = DEMAND_TIME_WINDOWS.findIndex((entry) => entry.id === windowId);
  const previous = DEMAND_TIME_WINDOWS[(index - 1 + DEMAND_TIME_WINDOWS.length) % DEMAND_TIME_WINDOWS.length];
  const currentCount = requestCount(area, category, windowId, isWeekend, scenario);
  const previousCount = requestCount(area, category, previous.id, isWeekend, scenario);
  const change = (currentCount - previousCount) / Math.max(1, previousCount);
  if (change >= 0.15) return Trend.RISING;
  if (change <= -0.15) return Trend.FALLING;
  return Trend.STEADY;
}

function poolFor(requests: number, poolVehicles: number): PoolDemand {
  const seatCapacity = poolVehicles * POOL_SEATS_PER_VEHICLE;
  const occupiedSeats = Math.min(seatCapacity, Math.round(requests / 6));
  const availableSeats = Math.max(0, seatCapacity - occupiedSeats);
  return {
    activeVehicles: poolVehicles,
    seatCapacity,
    occupiedSeats,
    availableSeats,
    compatibleRequests: Math.max(0, Math.min(requests, Math.round(requests * 0.35))),
    estimatedWaitMin: clamp(3 + Math.round(requests / Math.max(1, availableSeats || 1)), 3, 40),
    estimatedDetourMin: Math.round(2 + requests / 12),
  };
}

function availabilityFor(requests: number, supply: number, window: DemandTimeWindow): ZoneAvailability {
  if (requests === 0 && supply === 0) return "INSUFFICIENT_DATA";
  const hourly = requests / Math.max(1, window.endHour - window.startHour);
  if (requests === 0) return "GOOD";
  if (supply === 0) return "HIGH_PRESSURE";
  const coverage = supply / Math.max(1, hourly);
  if (coverage >= 1) return "GOOD";
  if (coverage >= 0.5) return "MODERATE";
  if (coverage >= 0.25) return "LIMITED";
  return "HIGH_PRESSURE";
}

function peakWindowFor(area: MobilityArea, isWeekend: boolean, scenario: DemoScenario): DemandTimeWindow {
  let best = DEMAND_TIME_WINDOWS[0];
  let bestTotal = -1;
  for (const window of DEMAND_TIME_WINDOWS) {
    const total = (Object.values(VehicleCategory) as Category[]).reduce(
      (sum, category) => sum + requestCount(area, category, window.id, isWeekend, scenario),
      0,
    );
    if (total > bestTotal) {
      best = window;
      bestTotal = total;
    }
  }
  return best;
}

export function generateAreaDemand(options: AreaDemandOptions = {}): AreaDemandSnapshot[] {
  const scenario = options.scenario ?? DemoScenario.NORMAL;
  const dayOfWeek = options.dayOfWeek ?? 3;
  const window =
    DEMAND_TIME_WINDOWS.find((entry) => entry.id === options.windowId) ?? DEMAND_TIME_WINDOWS[5];
  const isWeekend = scenario === DemoScenario.WEEKEND || isWeekendDay(dayOfWeek);

  const drafts = BELAGAVI_AREAS.map((area) => {
    const requests = {} as CategoryRecord;
    for (const category of Object.values(VehicleCategory) as Category[]) {
      requests[category] = requestCount(area, category, window.id, isWeekend, scenario);
    }
    return { area, requests };
  });

  const maxima = {} as CategoryRecord;
  for (const category of Object.values(VehicleCategory) as Category[]) {
    maxima[category] = Math.max(1, ...drafts.map((draft) => draft.requests[category]));
  }

  return drafts.map(({ area, requests }) => {
    const categories = {} as Record<Category, CategoryDemand>;
    for (const category of Object.values(VehicleCategory) as Category[]) {
      const demand = requests[category];
      const supply = supplyFor(area, category, window.id, scenario);
      const hourly = demand / Math.max(1, window.endHour - window.startHour);
      const pendingRequests = Math.max(0, Math.round(hourly - supply * 0.85));
      const demandScore = Math.round((demand / maxima[category]) * 100);
      const gapShare = pendingRequests / Math.max(1, pendingRequests + supply);
      const pool = category === VehicleCategory.POOL ? poolFor(demand, supply) : undefined;
      const seatPressure = pool ? 1 - pool.availableSeats / Math.max(1, pool.seatCapacity) : 0;
      categories[category] = {
        category,
        requests: demand,
        availableDrivers: supply,
        busyDrivers: Math.max(0, Math.round(supply * 0.25)),
        pendingRequests,
        demandScore,
        demandLevel: demandLevelFromScore(demandScore),
        trend: trendFor(area, category, window.id, isWeekend, scenario),
        estimatedWaitMin: pendingRequests > 0 ? clamp(3 + Math.round((pendingRequests / supply) * 4), 3, 45) : 2,
        availability: availabilityFor(demand, supply, window),
        opportunityScore: Math.round(demandScore * 0.5 + gapShare * 35 + seatPressure * 15),
        pool,
      };
    }
    const peak = peakWindowFor(area, isWeekend, scenario);
    return {
      areaId: area.id,
      name: area.name,
      district: area.district,
      taluk: area.taluk,
      city: area.city,
      kind: area.kind,
      center: area.center,
      polygon: area.polygon,
      boundaryKind: area.boundaryKind,
      note: area.note,
      windowId: window.id,
      windowLabel: window.label,
      dayOfWeek,
      isWeekend,
      scenario,
      peakWindowId: peak.id,
      peakWindowLabel: peak.label,
      categories,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Karnataka district overview (reuses the existing district seed)      */
/* ------------------------------------------------------------------ */

export interface DistrictDemand {
  districtId: string;
  name: string;
  center: { lat: number; lng: number };
  requests: CategoryRecord;
  totalRequests: number;
  demandLevel: Level;
  demandLabel: string;
  peakWindowLabel: string;
}

function stableUnit(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function generateDistrictDemand(options: AreaDemandOptions = {}): DistrictDemand[] {
  const scenario = options.scenario ?? DemoScenario.NORMAL;
  const dayOfWeek = options.dayOfWeek ?? 3;
  const window =
    DEMAND_TIME_WINDOWS.find((entry) => entry.id === options.windowId) ?? DEMAND_TIME_WINDOWS[5];
  const isWeekend = scenario === DemoScenario.WEEKEND || isWeekendDay(dayOfWeek);
  const scenarioFactor =
    scenario === DemoScenario.LOW_DEMAND ? 0.55 :
    scenario === DemoScenario.HIGH_DEMAND_EVENT ? 1.7 :
    scenario === DemoScenario.MORNING_PEAK || scenario === DemoScenario.EVENING_PEAK ? 1.35 : 1;

  return KARNATAKA_DEMO_DISTRICTS.map((district) => {
    const variation = 0.86 + stableUnit(`${district.id}:${window.id}:${dayOfWeek}`) * 0.28;
    const total = Math.max(
      0,
      Math.round(district.activity * 2.2 * WINDOW_SHAPE[window.id] * (isWeekend ? 1.08 : 1) * scenarioFactor * variation),
    );
    const bike = Math.round(total * 0.42);
    const car = Math.round(total * 0.34);
    const requests = { BIKE: bike, CAR: car, POOL: Math.max(0, total - bike - car) } as CategoryRecord;
    const demandScore = Math.min(100, Math.round((total / Math.max(1, 31 * 2.4)) * 100));
    return {
      districtId: district.id,
      name: district.name,
      center: district.center,
      requests,
      totalRequests: total,
      demandLevel: demandLevelFromScore(demandScore),
      demandLabel: DEMAND_LEVEL_LABEL[demandLevelFromScore(demandScore)],
      peakWindowLabel: total > 0 ? window.label : "No data",
    };
  });
}
