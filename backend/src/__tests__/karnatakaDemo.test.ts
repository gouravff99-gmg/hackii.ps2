import { describe, expect, it } from "vitest";
import {
  generateKarnatakaDistrictDemo,
  KARNATAKA_DEMO_DISTRICTS,
} from "@ps02/shared";

describe("Karnataka statewide demo heatmap data", () => {
  it("provides unique, positioned demo data for all 31 configured districts", () => {
    const districts = generateKarnatakaDistrictDemo(12, false, "normal");
    expect(KARNATAKA_DEMO_DISTRICTS).toHaveLength(31);
    expect(districts).toHaveLength(31);
    expect(new Set(districts.map((district) => district.id)).size).toBe(31);
    expect(districts.every((district) =>
      district.center.lat >= 11.5 &&
      district.center.lat <= 18.5 &&
      district.center.lng >= 73.5 &&
      district.center.lng <= 78.5 &&
      district.demandScore >= 0 &&
      district.demandScore <= 100,
    )).toBe(true);
    expect(new Set(districts.map((district) => district.demandScore)).size).toBeGreaterThan(1);
  });

  it("is deterministic and responds to time and scenario selection", () => {
    const base = generateKarnatakaDistrictDemo(12, false, "normal");
    expect(generateKarnatakaDistrictDemo(12, false, "normal")).toEqual(base);
    expect(generateKarnatakaDistrictDemo(18, false, "normal")).not.toEqual(base);
    expect(generateKarnatakaDistrictDemo(12, true, "event")).not.toEqual(base);
  });
});
