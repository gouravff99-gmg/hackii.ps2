import { DriverStatus, RideStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { pointInBounds, zoneCenter, zoneIdFor } from "../services/geo";
import {
  classifyAvailability,
  getMobilityIntelligence,
} from "../services/intelligence";
import { getZoneMetrics } from "../services/zones";
import { zoneQuerySchema } from "../controllers/intelligence";

vi.mock("../lib/prisma", () => ({
  prisma: {
    ride: { findMany: vi.fn() },
    driver: { findMany: vi.fn() },
    demandForecast: { findMany: vi.fn() },
  },
}));

vi.mock("../services/zones", () => ({
  DEMAND_WINDOW_MINUTES: 15,
  getZoneMetrics: vi.fn(),
}));

describe("unified mobility intelligence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("aggregates measured and simulated activity without exposing driver positions", async () => {
    const now = new Date("2026-11-14T01:00:00.000Z");
    const center = zoneCenter("r0c0");
    expect(center).not.toBeNull();
    const driverPoint = { lat: center!.lat + 0.0001, lng: center!.lng + 0.0001 };

    vi.mocked(getZoneMetrics).mockResolvedValue({
      zones: [{
        zoneId: "r0c0",
        row: 0,
        col: 0,
        center: center!,
        demand: 2,
        supply: 0,
        ratio: 2,
        surge: 1.5,
        predictedDemand: 3,
      }],
      hourOfDay: now.getHours(),
      windowMinutes: 15,
    });
    vi.mocked(prisma.ride.findMany).mockResolvedValue([
      {
        pickupLat: center!.lat,
        pickupLng: center!.lng,
        dropLat: center!.lat,
        dropLng: center!.lng,
        status: RideStatus.ACCEPTED,
        simRunId: null,
        requestedAt: new Date(now.getTime() - 60_000),
        acceptedAt: new Date(now.getTime() - 30_000),
      },
      {
        pickupLat: center!.lat,
        pickupLng: center!.lng,
        dropLat: center!.lat,
        dropLng: center!.lng,
        status: RideStatus.ACCEPTED,
        simRunId: "sim-1",
        requestedAt: new Date(now.getTime() - 30_000),
        acceptedAt: new Date(now.getTime() - 20_000),
      },
      {
        pickupLat: center!.lat,
        pickupLng: center!.lng,
        dropLat: center!.lat,
        dropLng: center!.lng,
        status: RideStatus.REQUESTED,
        simRunId: null,
        requestedAt: new Date(now.getTime() - 20 * 60_000),
        acceptedAt: null,
      },
      {
        pickupLat: 28.6139,
        pickupLng: 77.209,
        dropLat: 28.6139,
        dropLng: 77.209,
        status: RideStatus.REQUESTED,
        simRunId: null,
        requestedAt: now,
        acceptedAt: null,
      },
    ] as never);
    vi.mocked(prisma.driver.findMany).mockResolvedValue([
      {
        ...driverPoint,
        status: DriverStatus.AVAILABLE,
        isSimulated: false,
        user: { email: "verified.driver@example.test" },
      },
      {
        ...center!,
        status: DriverStatus.BUSY,
        isSimulated: true,
        user: { email: "simulated.driver@example.test" },
      },
    ] as never);

    const response = await getMobilityIntelligence(now, 6);
    const zone = response.zones[0];

    expect(response).toMatchObject({
      city: expect.any(String),
      generatedAt: now.toISOString(),
      windowMinutes: 15,
      staleLocationThresholdSeconds: 120,
    });
    expect(zone).toMatchObject({
      currentRequests15m: 2,
      requestedDropoffs15m: 2,
      measuredRequests15m: 1,
      simulatedRequests15m: 1,
      pendingRequests: 1,
      availableDrivers: 1,
      busyDrivers: 1,
      demandSupplyGap: 0,
      averageAssignmentWaitSeconds: 30,
      assignmentSamples7d: 1,
      availability: "MODERATE",
      dataSources: ["LIVE", "SIMULATION", "FORECAST"],
    });
    expect(getZoneMetrics).toHaveBeenCalledWith({ now, hourOfDay: 6 });
    expect(JSON.stringify(response)).not.toContain(JSON.stringify(driverPoint));
    expect(response.zones).toHaveLength(1);
  });

  it("classifies empty data honestly and high demand as pressure rather than acceptance", () => {
    expect(classifyAvailability(0, 0, false)).toBe("INSUFFICIENT_DATA");
    expect(classifyAvailability(5, 0, true)).toBe("HIGH_PRESSURE");
    expect(classifyAvailability(2, 3, true)).toBe("GOOD");
    expect(pointInBounds(28.6139, 77.209)).toBe(false);
    expect(zoneIdFor(28.6139, 77.209)).toBe("r0c0");
  });

  it("accepts only valid hourly forecast filters", () => {
    expect(zoneQuerySchema.parse({ hour: "18" })).toEqual({ hour: 18 });
    expect(zoneQuerySchema.safeParse({ hour: "24" }).success).toBe(false);
    expect(zoneQuerySchema.safeParse({ hour: "-1" }).success).toBe(false);
  });
});
