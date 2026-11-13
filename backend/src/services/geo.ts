import { CITY, INDIA_BOUNDS, ZONE_SIZE_KM, type LatLng, type ZoneId } from "@ps02/shared";

const DEG = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;
const KM_PER_DEG_LAT = 110.574;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundCoord(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function kmPerDegLng(lat: number): number {
  return 111.32 * Math.cos(lat * DEG);
}

/**
 * The city is tiled into ZONE_SIZE_KM cells derived from the shared bounding
 * box. Row 0 is the north edge, column 0 the west edge -> `r{row}c{col}`.
 */
const latSpanDeg = CITY.bounds.north - CITY.bounds.south;
const lngSpanDeg = CITY.bounds.east - CITY.bounds.west;
const rows = Math.max(1, Math.round((latSpanDeg * KM_PER_DEG_LAT) / ZONE_SIZE_KM));
const cols = Math.max(1, Math.round((lngSpanDeg * kmPerDegLng(CITY.center.lat)) / ZONE_SIZE_KM));

export const ZONE_GRID = {
  rows,
  cols,
  latStep: latSpanDeg / rows,
  lngStep: lngSpanDeg / cols,
} as const;

export function zoneIdFor(lat: number, lng: number): ZoneId {
  const row = clamp(Math.floor((CITY.bounds.north - lat) / ZONE_GRID.latStep), 0, rows - 1);
  const col = clamp(Math.floor((lng - CITY.bounds.west) / ZONE_GRID.lngStep), 0, cols - 1);
  return `r${row}c${col}`;
}

export function zoneIdForPoint(point: LatLng): ZoneId {
  return zoneIdFor(point.lat, point.lng);
}

const ZONE_PATTERN = /^r(\d+)c(\d+)$/;

export function parseZoneId(zoneId: ZoneId): { row: number; col: number } | null {
  const match = ZONE_PATTERN.exec(zoneId);
  if (!match) return null;
  const row = Number(match[1]);
  const col = Number(match[2]);
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  return { row, col };
}

export function zoneCenter(zoneId: ZoneId): LatLng | null {
  const cell = parseZoneId(zoneId);
  if (!cell) return null;
  return {
    lat: CITY.bounds.north - (cell.row + 0.5) * ZONE_GRID.latStep,
    lng: CITY.bounds.west + (cell.col + 0.5) * ZONE_GRID.lngStep,
  };
}

export function allZoneIds(): ZoneId[] {
  const ids: ZoneId[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      ids.push(`r${row}c${col}`);
    }
  }
  return ids;
}

export function pointInBounds(lat: number, lng: number): boolean {
  return (
    lat <= CITY.bounds.north &&
    lat >= CITY.bounds.south &&
    lng >= CITY.bounds.west &&
    lng <= CITY.bounds.east
  );
}

export function pointInIndiaBounds(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= INDIA_BOUNDS.south &&
    lat <= INDIA_BOUNDS.north &&
    lng >= INDIA_BOUNDS.west &&
    lng <= INDIA_BOUNDS.east
  );
}

export function clampToBounds(lat: number, lng: number): LatLng {
  return {
    lat: clamp(lat, CITY.bounds.south, CITY.bounds.north),
    lng: clamp(lng, CITY.bounds.west, CITY.bounds.east),
  };
}

/** Uniform random point inside the city bounding box. */
export function randomPointInBounds(random: () => number): LatLng {
  return {
    lat: CITY.bounds.south + random() * latSpanDeg,
    lng: CITY.bounds.west + random() * lngSpanDeg,
  };
}

/** Haversine distance matrix (kilometres) for a list of points. */
export function haversineMatrix(points: LatLng[]): number[][] {
  return points.map((a) => points.map((b) => haversineKm(a, b)));
}

/** Shift a point by a distance/bearing, used by the simulator to travel routes. */
export function moveTowards(from: LatLng, to: LatLng, fraction: number): LatLng {
  const f = clamp(fraction, 0, 1);
  return {
    lat: from.lat + (to.lat - from.lat) * f,
    lng: from.lng + (to.lng - from.lng) * f,
  };
}

/** Compact key for coordinate-keyed caches. */
export function coordKey(point: LatLng): string {
  return `${roundCoord(point.lat)},${roundCoord(point.lng)}`;
}
