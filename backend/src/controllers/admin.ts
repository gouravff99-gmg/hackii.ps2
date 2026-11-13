import { ChaosAction, Strategy } from "@ps02/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import * as analytics from "../services/analytics";
import { applyChaos } from "../services/chaos";
import { evaluateStrategies } from "../services/evaluation";
import { notifyUser } from "../services/realtime";
import {
  getSimulationStatus,
  resetSimulation,
  startSimulation,
  stopSimulation,
} from "../services/simulator";
import { buildRecommendations, getZoneMetrics } from "../services/zones";
import { currentAuth } from "../middleware/auth";

export const hourQuerySchema = z.object({
  hour: z.coerce.number().int().min(0).max(23).optional(),
});

export const simStartSchema = z.object({
  seed: z.number().int().min(0).max(2 ** 31 - 1).optional(),
  strategy: z.nativeEnum(Strategy).optional(),
  speed: z.number().min(1).max(60).optional(),
  numDrivers: z.number().int().min(1).max(60).optional(),
});

export const chaosSchema = z.object({
  action: z.nativeEnum(ChaosAction),
  driverId: z.string().min(1).optional(),
  rideId: z.string().min(1).optional(),
});

export const evaluateSchema = z.object({
  seed: z.number().int().min(0).max(2 ** 31 - 1).optional(),
  simulatedMinutes: z.number().int().min(5).max(120).optional(),
  numDrivers: z.number().int().min(5).max(60).optional(),
});

export async function overview(_req: Request, res: Response) {
  res.json(await analytics.getOverview());
}

export async function drivers(_req: Request, res: Response) {
  res.json({ drivers: await analytics.listDriversForAdmin() });
}

export async function rides(req: Request, res: Response) {
  const limit = Number(req.query.limit ?? 50);
  res.json({ rides: await analytics.listRidesForAdmin(Number.isFinite(limit) ? limit : 50) });
}

export async function events(req: Request, res: Response) {
  const limit = Number(req.query.limit ?? 60);
  res.json({ events: await analytics.listRecentEvents(Number.isFinite(limit) ? limit : 60) });
}

export async function zones(req: Request, res: Response) {
  const query = req.validated.query as z.infer<typeof hourQuerySchema>;
  const metrics = await getZoneMetrics({ hourOfDay: query.hour });
  res.json({ ...metrics, recommendations: buildRecommendations(metrics.zones) });
}

export async function forecast(req: Request, res: Response) {
  const query = req.validated.query as z.infer<typeof hourQuerySchema>;
  const hour = query.hour ?? new Date().getHours();
  res.json(await analytics.getForecastComparison(hour));
}

export async function recommendations(req: Request, res: Response) {
  const query = req.validated.query as z.infer<typeof hourQuerySchema>;
  const metrics = await getZoneMetrics({ hourOfDay: query.hour });
  res.json({ recommendations: buildRecommendations(metrics.zones) });
}

export async function poolCandidates(_req: Request, res: Response) {
  res.json(await analytics.getPoolCandidates());
}

export async function allocations(_req: Request, res: Response) {
  res.json({ allocations: await analytics.getAllocationSnapshots() });
}

export async function metrics(_req: Request, res: Response) {
  res.json(await analytics.getOverview());
}

export async function simStatus(_req: Request, res: Response) {
  res.json(getSimulationStatus());
}

export async function simStart(req: Request, res: Response) {
  const body = req.validated.body as z.infer<typeof simStartSchema>;
  res.json(await startSimulation(body));
}

export async function simStop(_req: Request, res: Response) {
  res.json(stopSimulation());
}

export async function simReset(_req: Request, res: Response) {
  res.json(await resetSimulation());
}

export async function chaos(req: Request, res: Response) {
  const body = req.validated.body as z.infer<typeof chaosSchema>;
  const result = await applyChaos(body);

  const auth = currentAuth(req);
  notifyUser(auth.sub, "info", "Chaos applied", result.detail);
  res.json(result);
}

export async function evaluate(req: Request, res: Response) {
  const body = req.validated.body as z.infer<typeof evaluateSchema>;
  const seed = body.seed ?? Math.floor(Math.random() * 1_000_000);
  const result = await evaluateStrategies({
    seed,
    simulatedMinutes: body.simulatedMinutes,
    numDrivers: body.numDrivers,
  });
  res.json(result);
}

export async function simRuns(_req: Request, res: Response) {
  res.json({ runs: await analytics.getEvaluationHistory() });
}
