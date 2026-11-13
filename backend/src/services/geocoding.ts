import type { LatLng, PlaceSuggestion } from "@ps02/shared";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

const CACHE_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 500;
const MIN_REQUEST_INTERVAL_MS = 1_000;

interface NominatimPlace {
  place_id: number | string;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
}

interface NominatimAddress {
  display_name?: string;
}

const cache = new Map<string, { expiresAt: number; value: PlaceSuggestion[] | string }>();
let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

function cached(key: string): PlaceSuggestion[] | string | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function remember(key: string, value: PlaceSuggestion[] | string) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

async function waitForNominatimSlot(): Promise<void> {
  const slot = requestQueue.then(async () => {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
  });
  requestQueue = slot.catch(() => undefined);
  await slot;
}

async function fetchNominatim<T>(url: URL): Promise<T> {
  await waitForNominatimSlot();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.httpTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "ps02-ride-hailing/0.2",
      },
    });
    if (!response.ok) {
      throw new ApiError(502, "Address lookup is temporarily unavailable", {
        code: "geocoding_unavailable",
      });
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Address lookup is temporarily unavailable", {
      code: "geocoding_unavailable",
    });
  } finally {
    clearTimeout(timer);
  }
}

function searchUrl(query: string): URL {
  const url = new URL("/search", `${env.nominatimBaseUrl.replace(/\/$/, "")}/`);
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    countrycodes: "in",
  }).toString();
  return url;
}

function reverseUrl(point: LatLng): URL {
  const url = new URL("/reverse", `${env.nominatimBaseUrl.replace(/\/$/, "")}/`);
  url.search = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lng),
    format: "jsonv2",
    zoom: "18",
  }).toString();
  return url;
}

function normalizePlace(place: NominatimPlace): PlaceSuggestion | null {
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !place.display_name) return null;
  return {
    placeId: String(place.place_id),
    lat,
    lng,
    displayName: place.display_name,
    type: place.type,
  };
}

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (normalizedQuery.length < 3) return [];

  const key = `search:${normalizedQuery.toLocaleLowerCase()}`;
  const hit = cached(key);
  if (Array.isArray(hit)) return hit;

  const places = await fetchNominatim<NominatimPlace[]>(searchUrl(normalizedQuery));
  const suggestions = places.map(normalizePlace).filter((place): place is PlaceSuggestion => place !== null);
  remember(key, suggestions);
  return suggestions;
}

export async function reverseGeocode(point: LatLng): Promise<string> {
  const key = `reverse:${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
  const hit = cached(key);
  if (typeof hit === "string") return hit;

  const place = await fetchNominatim<NominatimAddress>(reverseUrl(point));
  if (!place.display_name) {
    throw new ApiError(404, "No nearby address was found for this location", {
      code: "address_not_found",
    });
  }
  remember(key, place.display_name);
  return place.display_name;
}

export function clearGeocodingCache() {
  cache.clear();
}
