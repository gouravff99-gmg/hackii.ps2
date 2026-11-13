import { Role } from "@ps02/shared";
import { Router } from "express";
import * as controller from "../controllers/geocoding";
import { requireAuth, requireRole } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";

export const geocodingRouter = Router();

geocodingRouter.use(
  requireAuth,
  requireRole(Role.PASSENGER, Role.ADMIN),
  rateLimit({ name: "geocoding", windowMs: 60_000, max: 30 }),
);

geocodingRouter.get(
  "/search",
  validate({ query: controller.searchQuerySchema }),
  asyncHandler(controller.search),
);

geocodingRouter.get(
  "/reverse",
  validate({ query: controller.reverseQuerySchema }),
  asyncHandler(controller.reverse),
);
