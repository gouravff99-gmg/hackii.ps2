import { describe, expect, it } from "vitest";
import { CITY } from "@ps02/shared";
import { buildDemoAllocation } from "../services/allocation";

const designatedDriver = {
  id: "designated-demo-driver",
  name: "Demo Driver",
  lat: CITY.center.lat,
  lng: CITY.center.lng,
  busyMinutesToday: 0,
  completedToday: 0,
  acceptanceRate: 1,
  lastIdleSince: new Date("2026-01-01T00:00:00.000Z"),
};

describe("buildDemoAllocation", () => {
  it("always chooses the configured driver with the simulated ETA, independent of pickup distance", () => {
    const near = buildDemoAllocation(designatedDriver, CITY.center, 5);
    const far = buildDemoAllocation(
      designatedDriver,
      { lat: CITY.bounds.north - 0.001, lng: CITY.bounds.east - 0.001 },
      5,
    );

    expect(near.chosen?.driverId).toBe(designatedDriver.id);
    expect(far.chosen?.driverId).toBe(designatedDriver.id);
    expect(near.chosen?.raw.etaMin).toBe(5);
    expect(far.chosen?.raw.etaMin).toBe(5);
    expect(far.candidates[0].distanceKm).toBeGreaterThan(5);
  });
});
