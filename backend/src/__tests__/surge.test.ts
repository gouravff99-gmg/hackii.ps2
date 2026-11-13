import { SURGE } from "@ps02/shared";
import { describe, expect, it } from "vitest";
import { computeSurge, demandSupplyRatio } from "../services/surge";

describe("computeSurge", () => {
  it("returns the floor when there is no demand", () => {
    expect(computeSurge(0, 5)).toBe(SURGE.min);
  });

  it("returns 1 when demand equals supply", () => {
    expect(computeSurge(10, 10)).toBe(1);
  });

  it("rises with the demand/supply ratio", () => {
    // 1 + 0.5 * (20/10 - 1) = 1.5
    expect(computeSurge(20, 10)).toBe(1.5);
    // 1 + 0.5 * (15/10 - 1) = 1.25
    expect(computeSurge(15, 10)).toBe(1.25);
  });

  it("clamps at the maximum", () => {
    expect(computeSurge(1000, 10)).toBe(SURGE.max);
  });

  it("applies the supply floor instead of dividing by zero", () => {
    expect(computeSurge(1, 0)).toBe(computeSurge(1, SURGE.supplyFloor));
    expect(Number.isFinite(computeSurge(10, 0))).toBe(true);
  });

  it("treats negative demand as zero", () => {
    expect(computeSurge(-5, 10)).toBe(SURGE.min);
  });
});

describe("demandSupplyRatio", () => {
  it("divides demand by supply", () => {
    expect(demandSupplyRatio(20, 10)).toBe(2);
    expect(demandSupplyRatio(5, 10)).toBe(0.5);
  });

  it("uses the supply floor", () => {
    expect(demandSupplyRatio(10, 0)).toBe(10);
  });

  it("clamps negative demand to zero", () => {
    expect(demandSupplyRatio(-10, 5)).toBe(0);
  });
});
