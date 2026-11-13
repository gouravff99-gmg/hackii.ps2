import type { MobilityZoneInsight } from "./types";

export interface DriverOpportunityScore {
  score: number | null;
  basis: string;
}

/**
 * Transparent demo-grade score: 40% observed pressure, 30% hourly forecast,
 * 20% recent request activity, 10% accessibility. Unavailable factors are
 * excluded and the remaining weights are renormalized. This is not a booking
 * probability or earnings prediction.
 */
export function scoreDriverOpportunity(
  zone: MobilityZoneInsight,
  distanceKm: number,
  maxObservedRequests: number,
  maxForecastDemand: number,
): DriverOpportunityScore {
  const observed = zone.measuredRequests15m + zone.simulatedRequests15m;
  const hasObserved = observed > 0;
  const hasForecast = zone.predictedDemand !== undefined && maxForecastDemand > 0;
  const hasPressure = hasObserved || zone.pendingRequests > 0;
  if (!hasObserved && !hasForecast && !hasPressure) {
    return { score: null, basis: "Insufficient demand evidence" };
  }

  const factors: { value: number; weight: number }[] = [];
  if (hasPressure) {
    const pressure = Math.max(observed, zone.pendingRequests);
    factors.push({
      value: Math.min(1, Math.max(0, pressure - zone.availableDrivers) / Math.max(1, pressure)),
      weight: 0.4,
    });
  }
  if (hasForecast) {
    factors.push({
      value: Math.min(1, Math.max(0, zone.predictedDemand ?? 0) / maxForecastDemand),
      weight: 0.3,
    });
  }
  if (hasObserved) {
    factors.push({
      value: Math.min(1, observed / Math.max(1, maxObservedRequests)),
      weight: 0.2,
    });
  }
  if (Number.isFinite(distanceKm)) {
    factors.push({ value: Math.max(0, 1 - distanceKm / 10), weight: 0.1 });
  }

  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const score = Math.round(
    (factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0) / totalWeight) * 100,
  );
  return {
    score,
    basis: "Observed demand pressure, requests and hourly forecast; distance is approximate",
  };
}
