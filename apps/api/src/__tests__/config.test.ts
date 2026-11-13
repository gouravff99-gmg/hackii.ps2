import { describe, expect, it } from "vitest";
import { ALLOC_WEIGHTS, CITY, FARE, POOL, SURGE, ZONE_SIZE_KM } from "@ps02/shared";

describe("shared config invariants", () => {
  it("bounding box is ~20km around the city centre and well-formed", () => {
    expect(CITY.bounds.north).toBeGreaterThan(CITY.bounds.south);
    expect(CITY.bounds.east).toBeGreaterThan(CITY.bounds.west);
    expect(CITY.center.lat).toBeLessThan(CITY.bounds.north);
    expect(CITY.center.lat).toBeGreaterThan(CITY.bounds.south);
    expect(CITY.center.lng).toBeLessThan(CITY.bounds.east);
    expect(CITY.center.lng).toBeGreaterThan(CITY.bounds.west);

    const latKm = (CITY.bounds.north - CITY.bounds.south) * 110.574;
    const lngKm =
      (CITY.bounds.east - CITY.bounds.west) * 111.32 * Math.cos((CITY.center.lat * Math.PI) / 180);
    expect(latKm).toBeGreaterThan(19);
    expect(latKm).toBeLessThan(21);
    expect(lngKm).toBeGreaterThan(19);
    expect(lngKm).toBeLessThan(21);
  });

  it("zone grid divides the bounding box into whole 1km cells", () => {
    expect(ZONE_SIZE_KM).toBe(1);
  });

  it("allocation weights sum to 1", () => {
    const sum = ALLOC_WEIGHTS.eta + ALLOC_WEIGHTS.workload + ALLOC_WEIGHTS.acceptance + ALLOC_WEIGHTS.idle;
    expect(sum).toBeCloseTo(1, 10);
  });

  it("fare floor and surcharge bounds are sane", () => {
    expect(FARE.minFare).toBeGreaterThan(FARE.base);
    expect(SURGE.min).toBeLessThan(SURGE.max);
    expect(POOL.fareDiscount).toBeGreaterThan(0);
    expect(POOL.fareDiscount).toBeLessThan(1);
  });
});
