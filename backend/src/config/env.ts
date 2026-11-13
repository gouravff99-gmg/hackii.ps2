import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV ?? "development";

export const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: readInt("PORT", 4000),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  databaseUrl: process.env.DATABASE_URL ?? "",
  osrmBaseUrl: process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org",
  nominatimBaseUrl: process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org",
  httpTimeoutMs: readInt("HTTP_TIMEOUT_MS", 3000),
} as const;

if (env.isProduction && env.jwtSecret === "dev-secret-change-me") {
  throw new Error("[env] JWT_SECRET must be set to a strong value in production");
}

if (!env.databaseUrl) {
  console.warn(
    "[env] DATABASE_URL is not set. Database-backed endpoints will fail until it is configured in .env.",
  );
}
