import { POOL, type LatLng, type PoolCandidate, type PoolPlan, type PoolStop } from "@ps02/shared";
import { haversineKm } from "./geo";
import { computePooledFare } from "./fare";

/**
 * Pooling planner (Feature 3). Pure: no DB, no network. Callers supply the
 * ride requests and a distance/duration matrix covering the stops in order
 * [p0, d0, p1, d1, ...].
 *
 * Node layout: rider i -> pickup node 2i, drop node 2i+1.
 */

export interface PoolMatrix {
  distancesKm: number[][];
  durationsMin: number[][];
}

export function buildStops(requests: PoolCandidate[]): PoolStop[] {
  const stops: PoolStop[] = [];
  requests.forEach((request, index) => {
    stops.push({ kind: "pickup", rideId: request.rideId, location: request.pickup, node: index * 2 });
    stops.push({ kind: "drop", rideId: request.rideId, location: request.drop, node: index * 2 + 1 });
  });
  return stops;
}

/** Stops in matrix order, which the planner and OSRM call both rely on. */
export function stopsForMatrix(requests: PoolCandidate[]): LatLng[] {
  return buildStops(requests).map((stop) => stop.location);
}

/**
 * Every ordering of the stops where each rider is picked up before being
 * dropped off. For 3 riders this yields 90 valid permutations of 720.
 */
export function validPermutations(stopCount: number): number[][] {
  const permutations: number[][] = [];
  const used = new Array<boolean>(stopCount).fill(false);
  const order: number[] = [];

  const backtrack = () => {
    if (order.length === stopCount) {
      permutations.push([...order]);
      return;
    }
    for (let node = 0; node < stopCount; node += 1) {
      if (used[node]) continue;
      // A drop (odd node) can only follow its own pickup (node - 1).
      if (node % 2 === 1 && !used[node - 1]) continue;
      used[node] = true;
      order.push(node);
      backtrack();
      order.pop();
      used[node] = false;
    }
  };

  backtrack();
  return permutations;
}

function routeLegTime(order: number[], matrix: PoolMatrix): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i += 1) {
    total += matrix.durationsMin[order[i]][order[i + 1]] ?? 0;
  }
  return total;
}

function routeLegDistance(order: number[], matrix: PoolMatrix): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i += 1) {
    total += matrix.distancesKm[order[i]][order[i + 1]] ?? 0;
  }
  return total;
}

function inVehicleTime(order: number[], riderIndex: number, matrix: PoolMatrix): number {
  const pickupNode = riderIndex * 2;
  const dropNode = riderIndex * 2 + 1;
  const pickupPos = order.indexOf(pickupNode);
  const dropPos = order.indexOf(dropNode);
  if (pickupPos < 0 || dropPos < 0 || dropPos <= pickupPos) return Number.POSITIVE_INFINITY;

  let total = 0;
  for (let i = pickupPos; i < dropPos; i += 1) {
    total += matrix.durationsMin[order[i]][order[i + 1]] ?? 0;
  }
  return total;
}

/**
 * Find the fastest feasible stop order for a pool group.
 * Feasible = every rider's pooled in-vehicle time within `POOL.maxDetour`
 * of their solo trip time.
 */
export function planPool(requests: PoolCandidate[], matrix: PoolMatrix): PoolPlan {
  const empty: PoolPlan = {
    ok: false,
    rideIds: [],
    stopOrder: [],
    totalDistanceKm: 0,
    totalDurationMin: 0,
    perRider: [],
    reason: "Not enough compatible rides to pool.",
  };

  if (requests.length < 2) return { ...empty, reason: "At least two rides are needed to pool." };
  if (requests.length > POOL.maxRiders) {
    return { ...empty, reason: `A pool can hold at most ${POOL.maxRiders} riders.` };
  }

  const stops = buildStops(requests);
  const stopCount = stops.length;
  if (
    matrix.distancesKm.length !== stopCount ||
    matrix.durationsMin.length !== stopCount
  ) {
    return { ...empty, reason: "Distance matrix does not match the stop list." };
  }

  let best: { order: number[]; duration: number; distance: number } | null = null;

  for (const order of validPermutations(stopCount)) {
    const duration = routeLegTime(order, matrix);
    if (best && duration >= best.duration) continue;

    let feasible = true;
    for (let rider = 0; rider < requests.length; rider += 1) {
      const solo = requests[rider].soloDurationMin;
      const pooled = inVehicleTime(order, rider, matrix);
      if (!Number.isFinite(pooled)) {
        feasible = false;
        break;
      }
      const detour = solo > 0 ? (pooled - solo) / solo : 0;
      if (detour > POOL.maxDetour + 1e-9) {
        feasible = false;
        break;
      }
    }

    if (!feasible) continue;
    best = { order, duration, distance: routeLegDistance(order, matrix) };
  }

  if (!best) {
    return { ...empty, reason: `No stop order keeps every rider within ${Math.round(POOL.maxDetour * 100)}% detour.` };
  }

  const perRider = requests.map((request, rider) => {
    const pooled = inVehicleTime(best!.order, rider, matrix);
    const detourRatio =
      request.soloDurationMin > 0
        ? Math.round(((pooled - request.soloDurationMin) / request.soloDurationMin) * 1000) / 1000
        : 0;
    return {
      rideId: request.rideId,
      detourRatio,
      soloFare: request.soloFare,
      pooledFare: computePooledFare(request.soloFare, POOL.fareDiscount),
    };
  });

  return {
    ok: true,
    rideIds: requests.map((request) => request.rideId),
    stopOrder: best.order.map((node) => stops[node]),
    totalDistanceKm: Math.round(best!.distance * 100) / 100,
    totalDurationMin: Math.round(best!.duration * 100) / 100,
    perRider,
  };
}

/**
 * Greedy grouping of pending rides: pickups within `POOL.pickupRadiusKm`,
 * drops within `POOL.dropRadiusKm`, max `POOL.maxRiders` per group.
 * Purely geometric; detour feasibility is decided by `planPool`.
 */
export function groupPoolCandidates(candidates: PoolCandidate[]): PoolCandidate[][] {
  const groups: PoolCandidate[][] = [];
  const remaining = [...candidates];

  while (remaining.length > 0) {
    const seed = remaining.shift() as PoolCandidate;
    const group = [seed];

    for (let i = remaining.length - 1; i >= 0 && group.length < POOL.maxRiders; i -= 1) {
      const candidate = remaining[i];
      const pickupClose = haversineKm(seed.pickup, candidate.pickup) <= POOL.pickupRadiusKm;
      const dropClose = haversineKm(seed.drop, candidate.drop) <= POOL.dropRadiusKm;
      if (pickupClose && dropClose) {
        group.push(candidate);
        remaining.splice(i, 1);
      }
    }

    if (group.length >= 2) groups.push(group);
  }

  return groups;
}

export { POOL };
