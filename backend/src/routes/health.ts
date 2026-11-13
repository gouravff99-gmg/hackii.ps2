import { Router } from "express";
import { CITY, SIM_SPEED } from "@ps02/shared";
import { prisma } from "../lib/prisma";

export const healthRouter = Router();

/** Liveness + database reachability. Never fails: reports status instead. */
healthRouter.get("/health", async (_req, res) => {
  let database = false;
  let databaseError: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch (error) {
    database = false;
    const raw = error instanceof Error ? error.message : "unreachable";
    databaseError =
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)[0] ?? "unreachable";
  }

  res.json({
    ok: true,
    service: "ps02-backend",
    city: CITY.name,
    simSpeed: SIM_SPEED,
    database,
    databaseError,
    time: new Date().toISOString(),
  });
});
