import { Router } from "express";
import { CITY, SIM_SPEED } from "@ps02/shared";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ps02-backend",
    city: CITY.name,
    simSpeed: SIM_SPEED,
    time: new Date().toISOString(),
  });
});
