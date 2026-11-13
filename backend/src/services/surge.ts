import { SURGE } from "@ps02/shared";
import { round2 } from "./fare";

/**
 * Dynamic pricing: `clamp(1 + 0.5*(demand/supply - 1), 1.0, 2.5)` with a supply
 * floor so an empty zone does not divide by zero (Feature 2).
 */
export function computeSurge(demand: number, supply: number): number {
  const effectiveSupply = Math.max(supply, SURGE.supplyFloor);
  const ratio = Math.max(0, demand) / effectiveSupply;
  const raw = 1 + SURGE.factor * (ratio - 1);
  return round2(Math.min(SURGE.max, Math.max(SURGE.min, raw)));
}

/** Demand / supply ratio, using the same supply floor. */
export function demandSupplyRatio(demand: number, supply: number): number {
  return round2(Math.max(0, demand) / Math.max(supply, SURGE.supplyFloor));
}
