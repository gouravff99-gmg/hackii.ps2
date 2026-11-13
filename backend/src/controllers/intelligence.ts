import type { Request, Response } from "express";
import { z } from "zod";
import { getMobilityIntelligence } from "../services/intelligence";

export const zoneQuerySchema = z.object({
  hour: z.coerce.number().int().min(0).max(23).optional(),
});

export async function zones(_req: Request, res: Response) {
  const query = _req.validated.query as z.infer<typeof zoneQuerySchema>;
  res.json(await getMobilityIntelligence(new Date(), query.hour));
}
