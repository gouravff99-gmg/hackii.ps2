import { describe, expect, it } from "vitest";
import {
  explainTopPick,
  idleMinutes,
  minMaxNormalize,
  rankDrivers,
  rankNearestOnly,
  workloadOf,
  WORKLOAD_COMPLETED_RIDE_MINUTES,
  type RankCandidate,
} from "../services/matching";

function candidate(overrides: Partial<RankCandidate> & { driverId: string }): RankCandidate {
  return {
    etaMin: 5,
    distanceKm: 2,
    workload: 0,
    acceptanceRate: 1,
    idleMin: 10,
    ...overrides,
  };
}

describe("minMaxNormalize", () => {
  it("maps the candidate set onto 0..1", () => {
    expect(minMaxNormalize([1, 2, 3])).toEqual([0, 0.5, 1]);
  });

  it("returns zeros when every value is equal", () => {
    expect(minMaxNormalize([7, 7, 7])).toEqual([0, 0, 0]);
  });

  it("handles the empty set", () => {
    expect(minMaxNormalize([])).toEqual([]);
  });
});

describe("workloadOf", () => {
  it("blends busy minutes with completed rides", () => {
    expect(workloadOf({ busyMinutesToday: 30, completedToday: 2 })).toBe(
      30 + 2 * WORKLOAD_COMPLETED_RIDE_MINUTES,
    );
  });

  it("clamps negative inputs to zero", () => {
    expect(workloadOf({ busyMinutesToday: -10, completedToday: -1 })).toBe(0);
  });
});

describe("idleMinutes", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");

  it("returns 0 without a timestamp", () => {
    expect(idleMinutes(null, now)).toBe(0);
    expect(idleMinutes(undefined, now)).toBe(0);
  });

  it("measures minutes since the timestamp", () => {
    expect(idleMinutes(new Date("2026-01-01T11:50:00.000Z"), now)).toBe(10);
  });

  it("clamps future timestamps (clock skew) to zero", () => {
    expect(idleMinutes(new Date("2026-01-01T12:05:00.000Z"), now)).toBe(0);
  });

  it("accepts ISO strings", () => {
    expect(idleMinutes("2026-01-01T11:45:00.000Z", now)).toBe(15);
  });
});

describe("rankDrivers", () => {
  it("returns an empty list when there are no candidates", () => {
    expect(rankDrivers([])).toEqual([]);
  });

  it("prefers the closer, less busy, reliable driver", () => {
    const close = candidate({ driverId: "close", etaMin: 2, workload: 5, idleMin: 20 });
    const far = candidate({
      driverId: "far",
      etaMin: 12,
      distanceKm: 6,
      workload: 120,
      acceptanceRate: 0.5,
      idleMin: 0,
    });

    const ranked = rankDrivers([far, close]);

    expect(ranked[0].driverId).toBe("close");
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(ranked[0].score).toBeLessThan(ranked[1].score);
  });

  it("gives a single candidate a zero score because nothing differentiates", () => {
    const [only] = rankDrivers([candidate({ driverId: "solo" })]);
    expect(only.score).toBe(0);
    expect(only.rank).toBe(1);
  });

  it("inverts acceptance so a higher rate lowers the score", () => {
    const reliable = candidate({ driverId: "reliable", etaMin: 5, acceptanceRate: 1 });
    const flaky = candidate({ driverId: "flaky", etaMin: 5, acceptanceRate: 0 });

    const ranked = rankDrivers([flaky, reliable]);

    expect(ranked[0].driverId).toBe("reliable");
    expect(ranked[0].normalized.acceptance).toBe(0);
    expect(ranked[1].normalized.acceptance).toBe(1);
  });

  it("persists the full breakdown for explainability", () => {
    const [entry] = rankDrivers([candidate({ driverId: "a", etaMin: 4, workload: 12 })]);
    expect(entry.raw.etaMin).toBe(4);
    expect(entry.raw.workload).toBe(12);
    expect(entry.normalized).toEqual({ eta: 0, workload: 0, acceptance: 0, idle: 0 });
    expect(entry.contributions.eta).toBe(0);
    expect(entry.contributions.workload).toBe(0);
    expect(entry.contributions.acceptance).toBe(0);
    expect(entry.contributions.idle).toBeLessThanOrEqual(0);
  });
});

describe("rankNearestOnly", () => {
  it("sorts purely by pickup ETA", () => {
    const ranked = rankNearestOnly([
      candidate({ driverId: "c", etaMin: 9 }),
      candidate({ driverId: "a", etaMin: 2 }),
      candidate({ driverId: "b", etaMin: 5 }),
    ]);

    expect(ranked.map((entry) => entry.driverId)).toEqual(["a", "b", "c"]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(ranked[0].score).toBe(2);
  });
});

describe("explainTopPick", () => {
  it("explains the top pick in plain language", () => {
    const ranked = rankDrivers([
      candidate({ driverId: "a", etaMin: 1, workload: 0, idleMin: 60 }),
      candidate({ driverId: "b", etaMin: 10, workload: 100, idleMin: 0 }),
    ]);
    expect(explainTopPick(ranked)).toMatch(/Chosen for/);
  });

  it("handles an empty breakdown", () => {
    expect(explainTopPick([])).toMatch(/No available drivers/);
  });
});
