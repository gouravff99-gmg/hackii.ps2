import { INDIA_BOUNDS, type LatLng } from "@ps02/shared";
import { ApiError } from "../utils/ApiError";

export function validateRidePoints(pickup: LatLng, drop: LatLng): void {
  if (!pointInIndia(pickup)) {
    throw ApiError.badRequest("Pickup must be within India");
  }
  if (!pointInIndia(drop)) {
    throw ApiError.badRequest("Destination must be within India");
  }
  if (pickup.lat === drop.lat && pickup.lng === drop.lng) {
    throw ApiError.badRequest("Pickup and destination must be different locations");
  }
}

function pointInIndia(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= INDIA_BOUNDS.south &&
    point.lat <= INDIA_BOUNDS.north &&
    point.lng >= INDIA_BOUNDS.west &&
    point.lng <= INDIA_BOUNDS.east
  );
}
