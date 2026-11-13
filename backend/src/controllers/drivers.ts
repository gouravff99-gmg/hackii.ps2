import { DriverStatus } from "@ps02/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import { currentAuth } from "../middleware/auth";
import { SOCKET_EVENTS } from "@ps02/shared";
import * as driversService from "../services/drivers";
import { getDriverDemandInsights } from "../services/zones";
import { emitToAdmins } from "../services/realtime";
import { ApiError } from "../utils/ApiError";

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  radiusKm: z.coerce.number().finite().min(0.1).max(20).default(5),
});

export const statusSchema = z.object({
  status: z.nativeEnum(DriverStatus),
});

export const locationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export const driverIdParamSchema = z.object({ driverId: z.string().min(1).max(64) });

function driverIdOf(req: Request): string {
  const auth = currentAuth(req);
  if (!auth.driverId) throw ApiError.forbidden("No driver profile on this account");
  return auth.driverId;
}

export async function nearby(req: Request, res: Response) {
  const query = req.validated.query as z.infer<typeof nearbyQuerySchema>;
  const drivers = await driversService.findNearbyDrivers(query.lat, query.lng, query.radiusKm);
  res.json({ drivers });
}

export async function me(req: Request, res: Response) {
  const driverId = driverIdOf(req);
  res.json({ driver: await driversService.getDriverProfile(driverId) });
}

export async function demand(req: Request, res: Response) {
  res.json(await getDriverDemandInsights(driverIdOf(req)));
}

export async function setStatus(req: Request, res: Response) {
  const driverId = driverIdOf(req);
  const { status } = req.validated.body as z.infer<typeof statusSchema>;
  const driver = await driversService.setDriverStatus(driverId, status);
  emitToAdmins(SOCKET_EVENTS.NOTIFICATION, {
    kind: "info",
    title: "Driver availability changed",
    message: `Driver ${driverId} is now ${status}`,
    at: new Date().toISOString(),
  });
  res.json({ driver });
}

export async function updateLocation(req: Request, res: Response) {
  const driverId = driverIdOf(req);
  const { lat, lng } = req.validated.body as z.infer<typeof locationSchema>;
  const driver = await driversService.updateDriverLocation(driverId, lat, lng);

  emitToAdmins(SOCKET_EVENTS.DRIVER_LOCATION, {
    driverId,
    lat: driver.lat,
    lng: driver.lng,
    status: driver.status,
    at: new Date().toISOString(),
  });

  res.json({ driver });
}
