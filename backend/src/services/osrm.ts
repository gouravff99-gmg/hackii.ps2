import type { LatLng, RouteResult } from "@ps02/shared";
import { env } from "../config/env";
import { coordKey, haversineKm, haversineMatrix } from "./geo";

/** Fallback approximations when OSRM is unreachable (see docs/ASSUMPTIONS.md #11). */
const ROAD_FACTOR = 1.3;
const FALLBACK_SPEED_KMH = 24;
const MAX_CACHE_ENTRIES = 500;

const routeCache = new Map<string, RouteResult>();

interface OsrmRouteResponse {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates: Array<[number, number]> };
  }>;
}

interface OsrmTableResponse {
  distances?: Array<Array<number | null>>;
  durations?: Array<Array<number | null>>;
}

export interface DistanceMatrix {
  distancesKm: number[][];
  durationsMin: number[][];
  source: "osrm" | "haversine";
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.httpTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "ps02-ride-hailing/0.1" },
    });
    if (!response.ok) throw new Error(`OSRM responded ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function fallbackRoute(origin: LatLng, destination: LatLng): RouteResult {
  const distanceKm = haversineKm(origin, destination) * ROAD_FACTOR;
  return {
    distanceKm,
    durationMin: (distanceKm / FALLBACK_SPEED_KMH) * 60,
    polyline: [],
    source: "haversine",
  };
}

function remember(key: string, result: RouteResult) {
  if (routeCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = routeCache.keys().next().value;
    if (oldest !== undefined) routeCache.delete(oldest);
  }
  routeCache.set(key, result);
}

/**
 * Road route between two points. Uses OSRM with a hard timeout, an in-memory
 * cache keyed by coordinates rounded to 4 dp, and a Haversine fallback so the
 * product keeps working offline.
 */
export async function getRoute(origin: LatLng, destination: LatLng): Promise<RouteResult> {
  const key = `${coordKey(origin)}|${coordKey(destination)}`;
  const cached = routeCache.get(key);
  if (cached) return cached;

  let result: RouteResult;
  try {
    const url =
      `${env.osrmBaseUrl}/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?overview=full&geometries=geojson`;
    const payload = (await fetchJson(url)) as OsrmRouteResponse;
    const route = payload.routes?.[0];
    if (!route) throw new Error("OSRM returned no route");
    result = {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      polyline: (route.geometry?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })),
      source: "osrm",
    };
  } catch {
    result = fallbackRoute(origin, destination);
  }

  remember(key, result);
  return result;
}

function fallbackMatrix(points: LatLng[]): DistanceMatrix {
  const straight = haversineMatrix(points);
  return {
    distancesKm: straight.map((row) => row.map((km) => km * ROAD_FACTOR)),
    durationsMin: straight.map((row) => row.map((km) => ((km * ROAD_FACTOR) / FALLBACK_SPEED_KMH) * 60)),
    source: "haversine",
  };
}

/**
 * All-pairs distance/duration matrix for pooling. One OSRM `/table` call, with
 * a Haversine matrix fallback (see Feature 3).
 */
export async function getTable(points: LatLng[]): Promise<DistanceMatrix> {
  if (points.length < 2) return fallbackMatrix(points);

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  try {
    const url = `${env.osrmBaseUrl}/table/v1/driving/${coords}?annotations=distance,duration`;
    const payload = (await fetchJson(url)) as OsrmTableResponse;
    if (!payload.distances || !payload.durations) throw new Error("OSRM returned no table");

    return {
      distancesKm: payload.distances.map((row) =>
        row.map((meters, index) =>
          meters === null ? haversineKm(points[index], points[0]) * ROAD_FACTOR : meters / 1000,
        ),
      ),
      durationsMin: payload.durations.map((row) => row.map((seconds) => (seconds ?? 0) / 60)),
      source: "osrm",
    };
  } catch {
    return fallbackMatrix(points);
  }
}

export function clearRouteCache() {
  routeCache.clear();
}
