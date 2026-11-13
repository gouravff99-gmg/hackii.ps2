import { INDIA_BOUNDS, RideStatus, type LatLng } from "@ps02/shared";

export const LIVE_STATUSES = [
  RideStatus.ACCEPTED,
  RideStatus.ARRIVING,
  RideStatus.ARRIVED,
  RideStatus.ONGOING,
];

export function validGps(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= INDIA_BOUNDS.south &&
    point.lat <= INDIA_BOUNDS.north &&
    point.lng >= INDIA_BOUNDS.west &&
    point.lng <= INDIA_BOUNDS.east
  );
}

export function gpsTimestamp(value?: string): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function distanceKm(from: LatLng, to: LatLng): number {
  const radians = Math.PI / 180;
  const dLat = (to.lat - from.lat) * radians;
  const dLng = (to.lng - from.lng) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * radians) * Math.cos(to.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function storageHas(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function storageMark(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // The animation still works for this mount when session storage is disabled.
  }
}
