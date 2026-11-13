import type { Request, Response } from "express";
import { z } from "zod";
import { reverseGeocode, searchPlaces } from "../services/geocoding";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(3).max(120),
});

export const reverseQuerySchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
});

export async function search(req: Request, res: Response) {
  const { q } = req.validated.query as z.infer<typeof searchQuerySchema>;
  res.json({ suggestions: await searchPlaces(q) });
}

export async function reverse(req: Request, res: Response) {
  const point = req.validated.query as z.infer<typeof reverseQuerySchema>;
  res.json({ displayName: await reverseGeocode(point) });
}
