import { RideStatus as DbRideStatus } from "@prisma/client";
import { RideStatus } from "@ps02/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import { currentAuth } from "../middleware/auth";
import { driverCancelRide, getDriverOffer, respondToOffer } from "../services/dispatch";
import * as ridesService from "../services/rides";
import { ApiError } from "../utils/ApiError";
import { viewerFrom } from "../utils/viewer";

const pointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export const placeSchema = z.object({
  pickup: pointSchema,
  drop: pointSchema,
});

export const respondSchema = z.object({
  accept: z.boolean(),
});

export const advanceSchema = z.object({
  status: z.enum([RideStatus.ARRIVING, RideStatus.ONGOING, RideStatus.COMPLETED]),
});

export const idParamSchema = z.object({ rideId: z.string().min(1).max(64) });

export async function estimate(req: Request, res: Response) {
  const body = req.validated.body as z.infer<typeof placeSchema>;
  res.json(await ridesService.estimateRide(body));
}

export async function create(req: Request, res: Response) {
  const auth = currentAuth(req);
  const body = req.validated.body as z.infer<typeof placeSchema>;
  const ride = await ridesService.createRide(auth.sub, body);
  res.status(201).json({ ride });
}

export async function getById(req: Request, res: Response) {
  const { rideId } = req.validated.params as z.infer<typeof idParamSchema>;
  res.json({ ride: await ridesService.getRideForViewer(rideId, viewerFrom(req)) });
}

export async function history(req: Request, res: Response) {
  const auth = currentAuth(req);
  const rides = await ridesService.listPassengerRides(auth.sub);
  res.json({ rides });
}

export async function driverActive(req: Request, res: Response) {
  const auth = currentAuth(req);
  if (!auth.driverId) throw ApiError.forbidden("No driver profile on this account");
  res.json({ ride: await ridesService.getDriverActiveRide(auth.driverId) });
}

export async function driverOffer(req: Request, res: Response) {
  const auth = currentAuth(req);
  if (!auth.driverId) throw ApiError.forbidden("No driver profile on this account");
  res.json({ offer: await getDriverOffer(auth.driverId) });
}

export async function driverHistory(req: Request, res: Response) {
  const auth = currentAuth(req);
  if (!auth.driverId) throw ApiError.forbidden("No driver profile on this account");
  res.json({ rides: await ridesService.listDriverRides(auth.driverId) });
}

export async function cancel(req: Request, res: Response) {
  const { rideId } = req.validated.params as z.infer<typeof idParamSchema>;
  res.json({ ride: await ridesService.cancelRide(rideId, viewerFrom(req)) });
}

export async function respond(req: Request, res: Response) {
  const auth = currentAuth(req);
  if (!auth.driverId) throw ApiError.forbidden("No driver profile on this account");
  const { rideId } = req.validated.params as z.infer<typeof idParamSchema>;
  const { accept } = req.validated.body as z.infer<typeof respondSchema>;

  const ride = await respondToOffer({ rideId, driverId: auth.driverId, accept });
  res.json({ ride, accepted: accept });
}

export async function advance(req: Request, res: Response) {
  const auth = currentAuth(req);
  if (!auth.driverId) throw ApiError.forbidden("No driver profile on this account");
  const { rideId } = req.validated.params as z.infer<typeof idParamSchema>;
  const { status } = req.validated.body as z.infer<typeof advanceSchema>;

  const ride = await ridesService.advanceRide(rideId, auth.driverId, status as DbRideStatus);
  res.json({ ride });
}

export async function driverCancel(req: Request, res: Response) {
  const auth = currentAuth(req);
  if (!auth.driverId) throw ApiError.forbidden("No driver profile on this account");
  const { rideId } = req.validated.params as z.infer<typeof idParamSchema>;

  await driverCancelRide(rideId, auth.driverId);
  res.json({ ok: true });
}
