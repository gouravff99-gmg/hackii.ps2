import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { getOverview } from "../services/analytics";

vi.mock("../lib/prisma", () => ({
  prisma: {
    driver: {
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    ride: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      count: vi.fn(),
    },
  },
}));

describe("admin overview metrics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.driver.count).mockResolvedValue(0);
    vi.mocked(prisma.driver.aggregate).mockResolvedValue({
      _sum: { busyMinutesToday: 0 },
      _avg: {},
      _count: {},
      _max: {},
      _min: {},
    });
    vi.mocked(prisma.ride.count).mockResolvedValue(0);
    vi.mocked(prisma.user.count).mockResolvedValue(0);
  });

  it("reports wait as unavailable when there are no accepted rides", async () => {
    vi.mocked(prisma.ride.findMany).mockResolvedValue([]);

    const metrics = await getOverview();

    expect(metrics.acceptedRidesToday).toBe(0);
    expect(metrics.averagePassengerWaitSec).toBeNull();
  });

  it("averages only valid measured acceptance waits", async () => {
    const requestedAt = new Date("2026-01-01T10:00:00.000Z");
    vi.mocked(prisma.ride.findMany).mockResolvedValue([
      { requestedAt, acceptedAt: new Date(requestedAt.getTime() + 30_000) },
      { requestedAt, acceptedAt: new Date(requestedAt.getTime() + 90_000) },
      { requestedAt, acceptedAt: new Date(requestedAt.getTime() - 10_000) },
    ] as never);

    const metrics = await getOverview();

    expect(metrics.acceptedRidesToday).toBe(2);
    expect(metrics.averagePassengerWaitSec).toBe(60);
  });
});
