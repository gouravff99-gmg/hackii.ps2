import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

/**
 * One PrismaClient per process. In dev, `tsx watch` reloads the module graph,
 * so we stash the instance on globalThis to avoid exhausting DB connections.
 */
const globalForPrisma = globalThis as unknown as { ps02Prisma?: PrismaClient };

export const prisma =
  globalForPrisma.ps02Prisma ??
  new PrismaClient({
    log: env.isProduction ? ["error"] : ["error", "warn"],
  });

if (!env.isProduction) {
  globalForPrisma.ps02Prisma = prisma;
}
