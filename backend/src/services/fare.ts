import { FARE } from "@ps02/shared";

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Fare in INR: `max(minFare, (base + perKm*km + perMin*min) * surge)`.
 * Pure function - the single place fare maths lives.
 */
export function computeFare(distanceKm: number, durationMin: number, surgeMultiplier = 1): number {
  const subtotal = FARE.base + FARE.perKm * distanceKm + FARE.perMin * durationMin;
  return round2(Math.max(FARE.minFare, subtotal * surgeMultiplier));
}

/** Pooled riders pay a fixed discount of the solo fare (Feature 3). */
export function computePooledFare(soloFare: number, fareDiscount: number): number {
  return round2(soloFare * fareDiscount);
}

/** Driver earnings are the fare minus a simple platform commission. */
export function computeDriverEarnings(fare: number, commissionRate = 0.2): number {
  return round2(fare * (1 - commissionRate));
}
