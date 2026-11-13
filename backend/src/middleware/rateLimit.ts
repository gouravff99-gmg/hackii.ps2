import type { RequestHandler } from "express";
import { ApiError } from "../utils/ApiError";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small in-memory fixed-window rate limiter. Enough for a single-instance
 * prototype; a shared store would be required for horizontal scaling.
 */
export function rateLimit(options: { windowMs: number; max: number; name: string }): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req, _res, next) => {
    const now = Date.now();
    const key = `${options.name}:${req.ip ?? "unknown"}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      pruneIfLarge(buckets, now);
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      next(ApiError.tooManyRequests("Too many attempts, please try again shortly"));
      return;
    }
    next();
  };
}

function pruneIfLarge(buckets: Map<string, Bucket>, now: number) {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
