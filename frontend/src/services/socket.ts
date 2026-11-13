import { io, type Socket } from "socket.io-client";
import { getToken } from "./api";

let socket: Socket | null = null;

/** Lazily create the authenticated socket. Safe to call from many components. */
export function connectSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;

  if (socket?.connected && socket.auth && (socket.auth as { token?: string }).token === token) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io("/", {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionAttempts: 10,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
