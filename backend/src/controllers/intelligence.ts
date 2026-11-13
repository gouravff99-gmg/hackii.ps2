import { DemoScenario, VehicleCategory } from "@ps02/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import { getAreaDemand } from "../services/areaDemand";
import { getMobilityIntelligence } from "../services/intelligence";

export const zoneQuerySchema = z.object({
  hour: z.coerce.number().int().min(0).max(23).optional(),
});

const windowIds = [
  "LATE_NIGHT",
  "MORNING_COMMUTE",
  "MORNING_ACTIVITY",
  "AFTERNOON",
  "EVENING_TRANSITION",
  "EVENING_PEAK",
  "NIGHT",
] as const;

export const areasQuerySchema = z.object({
  scenario: z.nativeEnum(DemoScenario).optional(),
  day: z.coerce.number().int().min(0).max(6).optional(),
  window: z.enum(windowIds).optional(),
  hour: z.coerce.number().int().min(0).max(23).optional(),
  source: z.enum(["auto", "demo", "live"]).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  category: z.nativeEnum(VehicleCategory).optional(),
  lat: z.coerce.number().finite().min(-90).max(90).optional(),
  lng: z.coerce.number().finite().min(-180).max(180).optional(),
});

export async function zones(_req: Request, res: Response) {
  const query = _req.validated.query as z.infer<typeof zoneQuerySchema>;
  res.json(await getMobilityIntelligence(new Date(), query.hour));
}

export async function areas(req: Request, res: Response) {
  const query = req.validated.query as z.infer<typeof areasQuerySchema>;
  const origin =
    query.lat !== undefined && query.lng !== undefined
      ? { lat: query.lat, lng: query.lng }
      : undefined;
  res.json(
    await getAreaDemand({
      scenario: query.scenario,
      dayOfWeek: query.day,
      windowId: query.window,
      hour: query.hour,
      source: query.source,
      date: query.date,
      category: query.category,
      origin,
    }),
  );
}
