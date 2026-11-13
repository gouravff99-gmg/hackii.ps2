import { POOL, type PoolCandidate } from "@ps02/shared";
import { describe, expect, it } from "vitest";
import {
  buildStops,
  groupPoolCandidates,
  planPool,
  stopsForMatrix,
  validPermutations,
  type PoolMatrix,
} from "../services/pooling";

function poolCandidate(
  rideId: string,
  pickup: { lat: number; lng: number },
  drop: { lat: number; lng: number },
): PoolCandidate {
  return {
    rideId,
    pickup,
    drop,
    soloDistanceKm: 4,
    soloDurationMin: 5,
    soloFare: 100,
  };
}

const riderA = poolCandidate("ride-a", { lat: 12.9716, lng: 77.5946 }, { lat: 12.98, lng: 77.6 });
const riderB = poolCandidate("ride-b", { lat: 12.972, lng: 77.595 }, { lat: 12.981, lng: 77.601 });

/**
 * Node order is [a-pickup, a-drop, b-pickup, b-drop].
 * The direct trips cost 10 min, so a 5-minute pooled ride is zero detour.
 */
const matrix: PoolMatrix = {
  durationsMin: [
    [0, 10, 2, 13],
    [10, 0, 3, 2],
    [2, 3, 0, 10],
    [13, 2, 10, 0],
  ],
  distancesKm: [
    [0, 10, 2, 13],
    [10, 0, 3, 2],
    [2, 3, 0, 10],
    [13, 2, 10, 0],
  ],
};

describe("buildStops", () => {
  it("lays out pickup before drop for every rider", () => {
    const stops = buildStops([riderA, riderB]);
    expect(stops.map((stop) => stop.kind)).toEqual(["pickup", "drop", "pickup", "drop"]);
    expect(stops.map((stop) => stop.node)).toEqual([0, 1, 2, 3]);
    expect(stops[0].location).toEqual(riderA.pickup);
    expect(stops[3].location).toEqual(riderB.drop);
  });
});

describe("stopsForMatrix", () => {
  it("returns the same order used by the matrix", () => {
    expect(stopsForMatrix([riderA, riderB])).toEqual([
      riderA.pickup,
      riderA.drop,
      riderB.pickup,
      riderB.drop,
    ]);
  });
});

describe("validPermutations", () => {
  it("keeps pickup before drop for two riders", () => {
    const permutations = validPermutations(4);
    // (2n)! / 2^n = 24 / 4 = 6
    expect(permutations).toHaveLength(6);
    for (const order of permutations) {
      expect(order.indexOf(0)).toBeLessThan(order.indexOf(1));
      expect(order.indexOf(2)).toBeLessThan(order.indexOf(3));
    }
  });

  it("yields 90 orderings for three riders", () => {
    // (2n)! / 2^n = 720 / 8 = 90
    expect(validPermutations(6)).toHaveLength(90);
  });
});

describe("planPool", () => {
  it("rejects fewer than two riders", () => {
    const plan = planPool([riderA], matrix);
    expect(plan.ok).toBe(false);
    expect(plan.reason).toMatch(/At least two/);
  });

  it("rejects more than the maximum riders", () => {
    const extra = Array.from({ length: POOL.maxRiders + 1 }, (_, index) =>
      poolCandidate(`ride-${index}`, { lat: 12.97, lng: 77.59 }, { lat: 12.98, lng: 77.6 }),
    );
    const plan = planPool(extra, matrix);
    expect(plan.ok).toBe(false);
    expect(plan.reason).toMatch(/at most/);
  });

  it("rejects a matrix that does not match the stop list", () => {
    const plan = planPool([riderA, riderB], { distancesKm: [[0]], durationsMin: [[0]] });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toMatch(/does not match/);
  });

  it("plans the fastest feasible stop order", () => {
    const plan = planPool([riderA, riderB], matrix);

    expect(plan.ok).toBe(true);
    expect(plan.rideIds).toEqual(["ride-a", "ride-b"]);
    expect(plan.stopOrder).toHaveLength(4);
    expect(plan.totalDurationMin).toBe(7);
    expect(plan.totalDistanceKm).toBe(7);
  });

  it("charges every rider the pooled fare and reports their detour", () => {
    const plan = planPool([riderA, riderB], matrix);

    expect(plan.perRider).toHaveLength(2);
    for (const rider of plan.perRider) {
      expect(rider.soloFare).toBe(100);
      expect(rider.pooledFare).toBe(75);
      expect(rider.detourRatio).toBeLessThanOrEqual(POOL.maxDetour);
    }
  });

  it("refuses a group that cannot meet the detour limit", () => {
    // Every leg costs 20 min against a 5 min solo trip, so no ordering can
    // keep either rider within the 30% detour limit.
    const tightMatrix: PoolMatrix = {
      durationsMin: [
        [0, 20, 20, 20],
        [20, 0, 20, 20],
        [20, 20, 0, 20],
        [20, 20, 20, 0],
      ],
      distancesKm: [
        [0, 20, 20, 20],
        [20, 0, 20, 20],
        [20, 20, 0, 20],
        [20, 20, 20, 0],
      ],
    };

    const plan = planPool([riderA, riderB], tightMatrix);
    expect(plan.ok).toBe(false);
    expect(plan.reason).toMatch(/detour/);
  });
});

describe("groupPoolCandidates", () => {
  it("groups rides with nearby pickups and drops", () => {
    const groups = groupPoolCandidates([riderA, riderB]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("keeps far-apart rides in separate groups", () => {
    const far = poolCandidate(
      "ride-far",
      { lat: 13.05, lng: 77.68 },
      { lat: 13.04, lng: 77.67 },
    );
    expect(groupPoolCandidates([riderA, far])).toEqual([]);
  });

  it("never exceeds the maximum riders per group", () => {
    const cluster = Array.from({ length: POOL.maxRiders + 2 }, (_, index) =>
      poolCandidate(
        `ride-${index}`,
        { lat: 12.9716 + index * 0.0001, lng: 77.5946 },
        { lat: 12.98, lng: 77.6 + index * 0.0001 },
      ),
    );
    const groups = groupPoolCandidates(cluster);
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.length).toBeLessThanOrEqual(POOL.maxRiders);
    }
  });
});
