import { AreaKind, DemandLevel, VehicleCategory } from "./enums";
import type { LatLng } from "./types";

/**
 * Geographic hierarchy used by the area-wise heatmap.
 *
 * IMPORTANT: the locality polygons are *operational zones* built around real
 * Belagavi place coordinates. They are approximate service areas, not official
 * administrative boundaries. Coordinates were resolved from OpenStreetMap
 * Nominatim place searches (see docs/ROOT_CAUSE_HEATMAP.md).
 */

export interface KarnatakaHierarchy {
  state: { id: string; name: string; center: LatLng };
  districts: { id: string; name: string; center: LatLng }[];
  taluks: { id: string; name: string; district: string; center: LatLng }[];
  city: { id: string; name: string; district: string; taluk: string; center: LatLng };
}

export const KARNATAKA_HIERARCHY: KarnatakaHierarchy = {
  state: { id: "karnataka", name: "Karnataka", center: { lat: 15.3173, lng: 75.7139 } },
  districts: [{ id: "belagavi", name: "Belagavi", center: { lat: 15.8572666, lng: 74.5069343 } }],
  taluks: [
    { id: "belagavi", name: "Belagavi", district: "Belagavi", center: { lat: 15.8572666, lng: 74.5069343 } },
  ],
  city: {
    id: "belagavi-city",
    name: "Belagavi",
    district: "Belagavi",
    taluk: "Belagavi",
    center: { lat: 15.8572666, lng: 74.5069343 },
  },
};

const KM_PER_DEG_LAT = 110.574;

/** Build a deterministic hexagonal operational-zone polygon around a centre. */
export function operationalPolygon(center: LatLng, radiusKm = 0.55, sides = 6): LatLng[] {
  const latDelta = radiusKm / KM_PER_DEG_LAT;
  const lngDelta = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  return Array.from({ length: sides }, (_, index) => {
    const angle = (Math.PI * 2 * index) / sides - Math.PI / 2;
    return {
      lat: Math.round((center.lat + Math.sin(angle) * latDelta) * 1e7) / 1e7,
      lng: Math.round((center.lng + Math.cos(angle) * lngDelta) * 1e7) / 1e7,
    };
  });
}

export interface MobilityArea {
  id: string;
  name: string;
  state: string;
  district: string;
  taluk: string;
  city: string;
  kind: AreaKind;
  center: LatLng;
  /** Approximate operational zone. Not an official administrative boundary. */
  boundaryKind: "OPERATIONAL_ZONE";
  polygon: LatLng[];
  /** Plain-language note used in the UI. */
  note: string;
}

function area(
  id: string,
  name: string,
  center: LatLng,
  kind: AreaKind,
  note: string,
  radiusKm = 0.55,
): MobilityArea {
  return {
    id,
    name,
    state: "Karnataka",
    district: "Belagavi",
    taluk: "Belagavi",
    city: "Belagavi",
    kind,
    center,
    boundaryKind: "OPERATIONAL_ZONE",
    polygon: operationalPolygon(center, radiusKm),
    note,
  };
}

/**
 * Initial Belagavi demonstration areas. Order is stable and used as a
 * deterministic seed input; do not reorder without updating snapshots/tests.
 */
export const BELAGAVI_AREAS: readonly MobilityArea[] = [
  area("tilakwadi", "Tilakwadi", { lat: 15.8368581, lng: 74.5019281 }, AreaKind.RESIDENTIAL, "Residential and retail mix; morning and evening commuter demand.", 0.6),
  area("shahapur", "Shahapur", { lat: 15.8400681, lng: 74.5177745 }, AreaKind.RESIDENTIAL, "Dense residential area with college and market traffic."),
  area("vadgaon", "Vadgaon", { lat: 15.8335862, lng: 74.5242118 }, AreaKind.RESIDENTIAL, "Residential area with evening return trips."),
  area("angol", "Angol", { lat: 15.8229951, lng: 74.5030977 }, AreaKind.MIXED, "Residential and small commercial activity."),
  area("hindwadi", "Hindwadi", { lat: 15.8335, lng: 74.4938 }, AreaKind.RESIDENTIAL, "Residential area with short local trips.", 0.5),
  area("camp", "Camp", { lat: 15.8514981, lng: 74.4996608 }, AreaKind.COMMERCIAL, "Commercial and administrative activity through the day."),
  area("udyambag", "Udyambag", { lat: 15.8174629, lng: 74.4926262 }, AreaKind.INDUSTRIAL, "Industrial estate; shift-change peaks.", 0.65),
  area("nehru-nagar", "Nehru Nagar", { lat: 15.858, lng: 74.514 }, AreaKind.EDUCATION, "Education and residential demand around class hours.", 0.55),
  area("bus-stand", "Central Bus Stand area", { lat: 15.8638847, lng: 74.5210605 }, AreaKind.TRANSPORT_HUB, "Intercity arrivals and departures; strong morning and evening peaks.", 0.7),
  area("railway-station", "Railway Station area", { lat: 15.8500884, lng: 74.5084034 }, AreaKind.TRANSPORT_HUB, "Train arrivals and departures; time-of-day spikes.", 0.6),
];

export const AREA_IDS = BELAGAVI_AREAS.map((entry) => entry.id);

export const AREA_CATEGORIES: readonly VehicleCategory[] = [
  VehicleCategory.BIKE,
  VehicleCategory.CAR,
  VehicleCategory.POOL,
];

/* ------------------------------------------------------------------ */
/* Time windows                                                        */
/* ------------------------------------------------------------------ */

export type DemandWindowId =
  | "LATE_NIGHT"
  | "MORNING_COMMUTE"
  | "MORNING_ACTIVITY"
  | "AFTERNOON"
  | "EVENING_TRANSITION"
  | "EVENING_PEAK"
  | "NIGHT";

export interface DemandTimeWindow {
  id: DemandWindowId;
  label: string;
  shortLabel: string;
  startHour: number;
  /** Exclusive end hour; 24 means midnight. */
  endHour: number;
}

/** Seven demonstrative windows. Chronological order. */
export const DEMAND_TIME_WINDOWS: readonly DemandTimeWindow[] = [
  { id: "LATE_NIGHT", label: "Late night", shortLabel: "12–6 am", startHour: 0, endHour: 6 },
  { id: "MORNING_COMMUTE", label: "Morning commute", shortLabel: "6–9 am", startHour: 6, endHour: 9 },
  { id: "MORNING_ACTIVITY", label: "Morning activity", shortLabel: "9 am–12 pm", startHour: 9, endHour: 12 },
  { id: "AFTERNOON", label: "Afternoon", shortLabel: "12–3 pm", startHour: 12, endHour: 15 },
  { id: "EVENING_TRANSITION", label: "Evening transition", shortLabel: "3–6 pm", startHour: 15, endHour: 18 },
  { id: "EVENING_PEAK", label: "Evening peak", shortLabel: "6–9 pm", startHour: 18, endHour: 21 },
  { id: "NIGHT", label: "Night", shortLabel: "9 pm–12 am", startHour: 21, endHour: 24 },
];

export function resolveTimeWindow(hour: number): DemandTimeWindow {
  const safe = Number.isFinite(hour) ? Math.min(23.99, Math.max(0, hour)) : 12;
  return (
    DEMAND_TIME_WINDOWS.find((window) => safe >= window.startHour && safe < window.endHour) ??
    DEMAND_TIME_WINDOWS[5]
  );
}

export function timeWindowById(id: string): DemandTimeWindow | undefined {
  return DEMAND_TIME_WINDOWS.find((window) => window.id === id);
}

export function isWeekendDay(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers (pure, shared by browser and backend)              */
/* ------------------------------------------------------------------ */

export function haversineKm(a: LatLng, b: LatLng): number {
  const deg = Math.PI / 180;
  const dLat = (b.lat - a.lat) * deg;
  const dLng = (b.lng - a.lng) * deg;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * deg) * Math.cos(b.lat * deg) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ray-casting point-in-polygon test. Points on the edge count as inside. */
export function pointInPolygon(point: LatLng, polygon: readonly LatLng[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.lat > point.lat !== b.lat > point.lat &&
      point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Resolve a coordinate to an area. When approximate zones overlap, pick the
 * nearest containing centre so results stay deterministic.
 */
export function areaForPoint(point: LatLng): MobilityArea | null {
  const matches = BELAGAVI_AREAS.filter((entry) => pointInPolygon(point, entry.polygon));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => haversineKm(point, a.center) - haversineKm(point, b.center))[0];
}

export function demandLevelFromScore(score: number): DemandLevel {
  if (!Number.isFinite(score) || score <= 0) return DemandLevel.VERY_LOW;
  if (score < 20) return DemandLevel.VERY_LOW;
  if (score < 40) return DemandLevel.LOW;
  if (score < 60) return DemandLevel.MODERATE;
  if (score < 75) return DemandLevel.HIGH;
  if (score < 90) return DemandLevel.VERY_HIGH;
  return DemandLevel.CRITICAL;
}

export const DEMAND_LEVEL_LABEL: Record<DemandLevel, string> = {
  VERY_LOW: "Very low",
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  VERY_HIGH: "Very high",
  CRITICAL: "Critical",
};
