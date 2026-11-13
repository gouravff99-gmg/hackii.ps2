import { describe, expect, it } from "vitest";
import { scoreDriverOpportunity } from "@ps02/shared";
import type { MobilityZoneInsight } from "@ps02/shared";

const zone: MobilityZoneInsight = {
  zoneId: "r1c1",
  row: 1,
  col: 1,
  center: { lat: 12.97, lng: 77.59 },
  demand: 5,
  supply: 1,
  ratio: 5,
  surge: 2,
  predictedDemand: 10,
  currentRequests15m: 4,
  requestedDropoffs15m: 4,
  measuredRequests15m: 3,
  simulatedRequests15m: 1,
  pendingRequests: 2,
  averageAssignmentWaitSeconds: 30,
  assignmentSamples7d: 2,
  availableDrivers: 1,
  busyDrivers: 1,
  demandSupplyGap: 1,
  availability: "HIGH_PRESSURE",
  confidence: "MEDIUM",
  dataSources: ["LIVE", "SIMULATION", "FORECAST"],
};

describe("driver opportunity score", () => {
  it("normalizes the transparent score and ranks stronger pressure above weak pressure", () => {
    const strong = scoreDriverOpportunity(zone, 1, 4, 10);
    const weak = scoreDriverOpportunity({
      ...zone,
      measuredRequests15m: 0,
      simulatedRequests15m: 0,
      currentRequests15m: 0,
      pendingRequests: 0,
      availableDrivers: 4,
      predictedDemand: 1,
    }, 8, 4, 10);

    expect(strong.score).not.toBeNull();
    expect(strong.score).toBeGreaterThan(weak.score ?? 0);
    expect(strong.score).toBeGreaterThanOrEqual(0);
    expect(strong.score).toBeLessThanOrEqual(100);
    expect(strong.basis).toContain("approximate");
  });

  it("does not create an opportunity score without demand evidence", () => {
    const empty = scoreDriverOpportunity({
      ...zone,
      measuredRequests15m: 0,
      simulatedRequests15m: 0,
      currentRequests15m: 0,
      pendingRequests: 0,
      predictedDemand: undefined,
    }, 2, 0, 0);

    expect(empty).toEqual({ score: null, basis: "Insufficient demand evidence" });
  });
});
