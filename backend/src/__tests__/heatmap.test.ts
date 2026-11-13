import { describe, expect, it } from "vitest";
import {
  availabilityColor,
  coverageColor,
  gapColor,
  HEATMAP_COLORS,
  intensityColor,
  opportunityColor,
} from "@ps02/shared";

describe("shared heatmap scales", () => {
  it("uses a monotonic blue-to-red intensity scale and reserves grey for no data", () => {
    expect(intensityColor(0, 10)).toBe(HEATMAP_COLORS.noData);
    expect(intensityColor(1, 10)).toBe("#2563EB");
    expect(intensityColor(5, 10)).toBe("#22C55E");
    expect(intensityColor(10, 10)).toBe("#EF4444");
  });

  it("uses passenger availability colors for each service level", () => {
    expect(availabilityColor("GOOD")).toBe("#22C55E");
    expect(availabilityColor("HIGH_PRESSURE")).toBe("#EF4444");
    expect(availabilityColor("INSUFFICIENT_DATA")).toBe(HEATMAP_COLORS.noData);
  });

  it("maps driver opportunity scores to six distinct bands", () => {
    expect(opportunityColor(null)).toBe(HEATMAP_COLORS.noData);
    expect(opportunityColor(10)).toBe("#2563EB");
    expect(opportunityColor(30)).toBe("#06B6D4");
    expect(opportunityColor(50)).toBe("#22C55E");
    expect(opportunityColor(70)).toBe("#FACC15");
    expect(opportunityColor(85)).toBe("#F97316");
    expect(opportunityColor(95)).toBe("#EF4444");
  });

  it("distinguishes uncovered, covered and no-demand coverage zones", () => {
    expect(coverageColor(0, true)).toBe("#EF4444");
    expect(coverageColor(0.75, true)).toBe("#FACC15");
    expect(coverageColor(3, true)).toBe("#15803D");
    expect(coverageColor(0, false)).toBe(HEATMAP_COLORS.noData);
  });

  it("uses a diverging demand-gap scale", () => {
    expect(gapColor(-5, 5)).toBe("#2563EB");
    expect(gapColor(0, 5)).toBe(HEATMAP_COLORS.neutral);
    expect(gapColor(5, 5)).toBe("#EF4444");
  });
});
