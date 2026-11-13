import { describe, expect, it } from "vitest";
import { computeDriverEarnings, computeFare, computePooledFare, round2 } from "../services/fare";

describe("round2", () => {
  it("rounds to two decimals", () => {
    expect(round2(1.2345)).toBe(1.23);
    expect(round2(1.2355)).toBe(1.24);
  });
});

describe("computeFare", () => {
  it("applies base + per km + per minute", () => {
    // 40 + 12*5 + 1.5*10 = 115
    expect(computeFare(5, 10, 1)).toBe(115);
  });

  it("enforces the minimum fare", () => {
    expect(computeFare(0, 0, 1)).toBe(60);
    expect(computeFare(0.1, 1, 1)).toBe(60);
  });

  it("multiplies the whole subtotal by the surge multiplier", () => {
    expect(computeFare(5, 10, 2)).toBe(230);
  });

  it("applies surge before the minimum-fare floor", () => {
    // subtotal 60 * 0.9 = 54 -> floored back up to 60
    expect(computeFare(0.1, 1, 0.9)).toBe(60);
  });

  it("never returns a non-finite or negative fare for sane input", () => {
    const fare = computeFare(12.5, 22, 1.7);
    expect(Number.isFinite(fare)).toBe(true);
    expect(fare).toBeGreaterThanOrEqual(60);
  });
});

describe("computePooledFare", () => {
  it("charges the discounted fraction of the solo fare", () => {
    expect(computePooledFare(100, 0.75)).toBe(75);
    expect(computePooledFare(115, 0.75)).toBe(86.25);
  });
});

describe("computeDriverEarnings", () => {
  it("deducts the platform commission", () => {
    expect(computeDriverEarnings(100)).toBe(80);
    expect(computeDriverEarnings(100, 0.2)).toBe(80);
    expect(computeDriverEarnings(100, 0.25)).toBe(75);
  });
});
