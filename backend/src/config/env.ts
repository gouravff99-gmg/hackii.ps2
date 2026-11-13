import path from "node:path";
import dotenv from "dotenv";

// Repo-root .env first (single source), then an optional backend/.env override.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
} as const;
