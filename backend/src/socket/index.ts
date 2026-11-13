import type http from "node:http";
import { Server as SocketServer } from "socket.io";
import { SOCKET_EVENTS } from "@ps02/shared";
import { env } from "../config/env";

/** Attaches Socket.IO to the HTTP server. Event handlers get added per phase. */
export function attachSocket(server: http.Server) {
  const io = new SocketServer(server, {
    cors: { origin: env.webOrigin, credentials: true },
  });

  io.on("connection", (socket) => {
    socket.on(SOCKET_EVENTS.ADMIN_CHAOS, () => {
      socket.emit(SOCKET_EVENTS.NOTIFICATION, {
        kind: "info",
        title: "Not available yet",
        message: "Chaos handlers arrive in Phase 5b.",
        at: new Date().toISOString(),
      });
    });
  });

  return io;
}
