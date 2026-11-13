import http from "node:http";
import { env } from "./config/env"; // must stay first: loads .env
import { createApp } from "./app";
import { attachSocket } from "./socket";

const app = createApp();
const server = http.createServer(app);
const io = attachSocket(server);

server.listen(env.port, () => {
  console.log(`[backend] listening on http://localhost:${env.port}`);
  console.log(`[backend] health:    http://localhost:${env.port}/api/health`);
});

function shutdown(signal: string) {
  console.log(`[backend] ${signal} received, shutting down`);
  io.close();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
