import type http from "node:http";
import { Server as SocketServer } from "socket.io";
import { DriverStatus, Role, ROOMS, SOCKET_EVENTS } from "@ps02/shared";
import { z } from "zod";
import { env } from "../config/env";
import { readBearerToken, verifyToken, type AuthPrincipal } from "../lib/jwt";
import { applyChaos } from "../services/chaos";
import * as driversService from "../services/drivers";
import { respondToOffer } from "../services/dispatch";
import { emitToAdmins, setRealtimeServer } from "../services/realtime";
import { publishDriverLocation } from "../services/driverTracking";
import { ApiError } from "../utils/ApiError";

const locationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

const statusSchema = z.object({ status: z.nativeEnum(DriverStatus) });
const respondSchema = z.object({ rideId: z.string().min(1), accept: z.boolean() });
const chaosSchema = z.object({
  action: z.string().min(1),
  driverId: z.string().optional(),
  rideId: z.string().optional(),
});

export function attachSocket(server: http.Server) {
  const io = new SocketServer(server, {
    cors: { origin: env.webOrigin, credentials: true },
  });

  setRealtimeServer(io);

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      readBearerToken(socket.handshake.headers.authorization);

    if (!token) {
      next(new Error("unauthorized"));
      return;
    }

    try {
      (socket.data as { auth?: AuthPrincipal }).auth = verifyToken(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const auth = (socket.data as { auth?: AuthPrincipal }).auth;
    if (!auth) {
      socket.disconnect(true);
      return;
    }

    socket.join(ROOMS.user(auth.sub));
    socket.join(`role:${auth.role}`);
    if (auth.role === Role.ADMIN) socket.join(ROOMS.admin);

    const authorize = (handler: (payload: unknown) => Promise<void>) => (payload: unknown) => {
      handler(payload).catch((error) => {
        socket.emit(SOCKET_EVENTS.NOTIFICATION, {
          kind: "error",
          title: "Action failed",
          message: error instanceof Error ? error.message : "Unexpected error",
          at: new Date().toISOString(),
        });
      });
    };

    socket.on(
      SOCKET_EVENTS.DRIVER_UPDATE_LOCATION,
      authorize(async (payload) => {
        if (auth.role !== Role.DRIVER || !auth.driverId) {
          throw ApiError.forbidden("Only authenticated drivers can update driver location");
        }
        const parsed = locationSchema.safeParse(payload);
        if (!parsed.success) {
          throw ApiError.badRequest("Invalid driver location", parsed.error.flatten());
        }
        const driver = await driversService.updateDriverLocation(
          auth.driverId,
          parsed.data.lat,
          parsed.data.lng,
        );
        emitToAdmins(SOCKET_EVENTS.DRIVER_LOCATION, {
          driverId: auth.driverId,
          lat: driver.lat,
          lng: driver.lng,
          status: driver.status,
          at: new Date().toISOString(),
        });
        await publishDriverLocation(auth.driverId, { lat: driver.lat, lng: driver.lng });
      }),
    );

    socket.on(
      SOCKET_EVENTS.DRIVER_SET_STATUS,
      authorize(async (payload) => {
        if (!auth.driverId) return;
        const parsed = statusSchema.safeParse(payload);
        if (!parsed.success) return;
        await driversService.setDriverStatus(auth.driverId, parsed.data.status);
      }),
    );

    socket.on(
      SOCKET_EVENTS.RIDE_RESPOND,
      authorize(async (payload) => {
        if (!auth.driverId) return;
        const parsed = respondSchema.safeParse(payload);
        if (!parsed.success) return;
        await respondToOffer({
          rideId: parsed.data.rideId,
          driverId: auth.driverId,
          accept: parsed.data.accept,
        });
      }),
    );

    socket.on(
      SOCKET_EVENTS.ADMIN_CHAOS,
      authorize(async (payload) => {
        if (auth.role !== Role.ADMIN) return;
        const parsed = chaosSchema.safeParse(payload);
        if (!parsed.success) return;
        const result = await applyChaos(parsed.data as never);
        socket.emit(SOCKET_EVENTS.NOTIFICATION, {
          kind: "info",
          title: "Chaos applied",
          message: result.detail,
          at: new Date().toISOString(),
        });
      }),
    );
  });

  return io;
}
