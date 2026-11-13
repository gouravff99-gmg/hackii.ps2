import { Router } from "express";
import { CITY, SIM_SPEED } from "@ps02/shared";
<<<<<<< HEAD
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

=======

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a
  res.json({
    ok: true,
    service: "ps02-backend",
    city: CITY.name,
    simSpeed: SIM_SPEED,
<<<<<<< HEAD
    database,
    databaseError,
=======
>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a
    time: new Date().toISOString(),
  });
});
