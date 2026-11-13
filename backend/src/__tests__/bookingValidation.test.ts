import { describe, expect, it } from "vitest";
import { CITY } from "@ps02/shared";
import { validateRidePoints } from "../services/bookingValidation";

describe("validateRidePoints", () => {
  it("accepts distinct points in different Indian cities", () => {
    expect(() =>
      validateRidePoints(CITY.center, { lat: 17.385, lng: 78.4867 }),
    ).not.toThrow();
  });

  it("rejects identical pickup and destination coordinates", () => {
    expect(() => validateRidePoints(CITY.center, CITY.center)).toThrow(
      "Pickup and destination must be different locations",
    );
  });

  it("rejects locations outside India", () => {
    expect(() => validateRidePoints({ lat: 0, lng: 0 }, CITY.center)).toThrow(
      "Pickup must be within India",
    );
  });
});
