import { DriverStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { parseZoneId, zoneCenter, zoneIdFor, ZONE_GRID } from "../services/geo";
import { getDriverDemandInsights } from "../services/zones";

vi.mock("../lib/prisma", () => ({
  prisma: {
    ride: { findMany: vi.fn() },
    driver: { findMany: vi.fn(), findUnique: vi.fn() },
    demandForecast: { findMany: vi.fn() },
  },
}));

describe("driver demand insights", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("separates measured and simulated requests and recommends a nearby deficit zone", async () => {
    const now = new Date("2026-04-15T12:00:00.000Z");
    const position = { lat: 12.9716, lng: 77.5946 };
    const currentZone = zoneIdFor(position.lat, position.lng);
    const currentCell = parseZoneId(currentZone);
    expect(currentCell).not.toBeNull();
    const targetCol = currentCell!.col + 1 < ZONE_GRID.cols
      ? currentCell!.col + 1
      : currentCell!.col - 1;
    const targetZone = `r${currentCell!.row}c${targetCol}`;
    const targetCenter = zoneCenter(targetZone);
    expect(targetCenter).not.toBeNull();

    vi.mocked(prisma.ride.findMany).mockResolvedValue([
      { pickupLat: targetCenter!.lat, pickupLng: targetCenter!.lng, simRunId: null },
      { pickupLat: targetCenter!.lat, pickupLng: targetCenter!.lng, simRunId: "run-1" },
    ] as never);
    vi.mocked(prisma.driver.findMany).mockResolvedValue([position] as never);
    vi.mocked(prisma.demandForecast.findMany).mockResolvedValue([
      { zoneId: targetZone, predictedDemand: 3 },
    ] as never);
    vi.mocked(prisma.driver.findUnique).mockResolvedValue({
      ...position,
      status: DriverStatus.AVAILABLE,
      isSimulated: false,
    } as never);

    const result = await getDriverDemandInsights("driver-1", now);

    expect(result.currentZone.zoneId).toBe(currentZone);
    expect(result.recommendation?.targetZone).toBe(targetZone);
    const target = result.nearbyZones.find((zone) => zone.zoneId === targetZone);
    expect(target).toMatchObject({
      measuredRequests15m: 1,
      simulatedRequests15m: 1,
      predictedDemand: 3,
    });
    expect(result.peakPeriods).toEqual([
      { startHour: 8, endHour: 10 },
      { startHour: 17, endHour: 20 },
    ]);
  });
});
