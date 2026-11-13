import type { Server } from "socket.io";
import { ROOMS, SOCKET_EVENTS } from "@ps02/shared";

/**
 * Single place that owns the Socket.IO server reference so services can emit
 * without importing the HTTP layer (avoids circular imports).
 */
let server: Server | null = null;

export function setRealtimeServer(io: Server) {
  server = io;
}

export function getRealtimeServer(): Server | null {
  return server;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  server?.to(ROOMS.user(userId)).emit(event, payload);
}

export function emitToRide(rideId: string, event: string, payload: unknown) {
  server?.to(ROOMS.ride(rideId)).emit(event, payload);
}

export function emitToAdmins(event: string, payload: unknown) {
  server?.to(ROOMS.admin).emit(event, payload);
}

export function emitToRole(role: string, event: string, payload: unknown) {
  server?.to(`role:${role}`).emit(event, payload);
}

/** Notify one user with the standard notification payload shape. */
export function notifyUser(
  userId: string,
  kind: "info" | "success" | "warning" | "error",
  title: string,
  message: string,
  rideId?: string,
) {
  emitToUser(userId, SOCKET_EVENTS.NOTIFICATION, {
    kind,
    title,
    message,
    rideId,
    at: new Date().toISOString(),
  });
}

export function broadcast(event: string, payload: unknown) {
  server?.emit(event, payload);
}
