import http from "node:http";
import { env } from "./config/env"; // must stay first: loads .env
import { createApp } from "./app";
import { prisma } from "./lib/prisma";
import { attachSocket } from "./socket";

const app = createApp();
const server = http.createServer(app);
const io = attachSocket(server);

server.listen(env.port, () => {
  console.log(`[backend] listening on http://localhost:${env.port}`);
  console.log(`[backend] health:    http://localhost:${env.port}/api/health`);
  console.log(`[backend] database:  ${env.databaseUrl ? "configured" : "NOT configured"}`);
});

async function shutdown(signal: string) {
  console.log(`[backend] ${signal} received, shutting down`);
  io.close();
  await prisma.$disconnect().catch(() => undefined);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
