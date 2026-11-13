import path from "node:path";
import dotenv from "dotenv";

// Repo-root .env first, then a local apps/api/.env may override.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import http from "node:http";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { Server as SocketServer } from "socket.io";
import { CITY, SOCKET_EVENTS, SIM_SPEED } from "@ps02/shared";

const PORT = Number(process.env.PORT ?? 4000);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ps02-api",
    city: CITY.name,
    simSpeed: SIM_SPEED,
    time: new Date().toISOString(),
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: WEB_ORIGIN, credentials: true },
});

io.on("connection", (socket) => {
  socket.emit("hello", { ok: true, at: new Date().toISOString() });

  socket.on(SOCKET_EVENTS.ADMIN_CHAOS, () => {
    socket.emit(SOCKET_EVENTS.NOTIFICATION, {
      kind: "info",
      title: "Phase 0",
      message: "Chaos handlers arrive in Phase 5b.",
      at: new Date().toISOString(),
    });
  });
});

server.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  console.log(`[api] health: http://localhost:${PORT}/api/health`);
});

function shutdown(signal: string) {
  console.log(`[api] ${signal} received, shutting down`);
  io.close();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { app, io, server };
