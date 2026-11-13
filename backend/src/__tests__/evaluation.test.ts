import { Strategy } from "@ps02/shared";
import { describe, expect, it } from "vitest";
import {
  buildRequestStream,
  runHeadless,
  standardDeviation,
} from "../services/evaluation";

describe("standardDeviation", () => {
  it("computes the population standard deviation", () => {
    // mean 5 -> variance 4 -> sd 2
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });

  it("is zero for a single value or identical values", () => {
    expect(standardDeviation([42])).toBe(0);
    expect(standardDeviation([3, 3, 3, 3])).toBe(0);
  });

  it("is zero for the empty set", () => {
    expect(standardDeviation([])).toBe(0);
  });
});

describe("buildRequestStream", () => {
  it("is deterministic for a seed", () => {
    const first = buildRequestStream(1234, 10, 10);
    const second = buildRequestStream(1234, 10, 10);
    expect(second).toEqual(first);
  });

  it("changes with the seed", () => {
    const a = buildRequestStream(1, 10, 10);
    const b = buildRequestStream(2, 10, 10);
    expect(a).not.toEqual(b);
  });

  it("produces monotonically increasing request times inside the window", () => {
    const requests = buildRequestStream(99, 15, 10);
    expect(requests.length).toBeGreaterThan(0);

    let previous = 0;
    for (const request of requests) {
      expect(request.atSec).toBeGreaterThan(previous);
      expect(request.atSec).toBeLessThanOrEqual(15 * 60);
      previous = request.atSec;
    }
  });
});

describe("runHeadless", () => {
  it("produces a consistent metric set for both strategies", () => {
    for (const strategy of [Strategy.NEAREST, Strategy.SMART]) {
      const metrics = runHeadless(2026, strategy, 10, 12);

      expect(metrics.strategy).toBe(strategy);
      expect(metrics.seed).toBe(2026);
      expect(metrics.simulatedMinutes).toBe(10);
      expect(metrics.ridesRequested).toBeGreaterThan(0);
      expect(metrics.ridesCompleted + metrics.ridesCancelled).toBe(metrics.ridesRequested);
      expect(metrics.completionRate).toBeGreaterThanOrEqual(0);
      expect(metrics.completionRate).toBeLessThanOrEqual(1);
      expect(metrics.avgPassengerWaitSec).toBeGreaterThanOrEqual(0);
      expect(metrics.avgPickupEtaMin).toBeGreaterThanOrEqual(0);
      expect(metrics.driverUtilization).toBeGreaterThanOrEqual(0);
      expect(metrics.fairnessStdDev).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(metrics.fairnessStdDev)).toBe(true);
    }
  });

  it("is reproducible for the same seed and strategy", () => {
    const first = runHeadless(7, Strategy.SMART, 8, 10);
    const second = runHeadless(7, Strategy.SMART, 8, 10);
    expect(second).toEqual(first);
  });

  it("reviews the same request stream under both strategies", () => {
    const nearest = runHeadless(555, Strategy.NEAREST, 12, 15);
    const smart = runHeadless(555, Strategy.SMART, 12, 15);
    expect(smart.ridesRequested).toBe(nearest.ridesRequested);
  });
});
