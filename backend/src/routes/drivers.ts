import { Role } from "@ps02/shared";
import { Router } from "express";
import * as controller from "../controllers/drivers";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";

export const driversRouter = Router();

driversRouter.use(requireAuth);

driversRouter.get(
  "/nearby",
  validate({ query: controller.nearbyQuerySchema }),
  asyncHandler(controller.nearby),
);

driversRouter.get("/me", requireRole(Role.DRIVER), asyncHandler(controller.me));

driversRouter.post(
  "/status",
  requireRole(Role.DRIVER),
  validate({ body: controller.statusSchema }),
  asyncHandler(controller.setStatus),
);

driversRouter.post(
  "/location",
  requireRole(Role.DRIVER),
  validate({ body: controller.locationSchema }),
  asyncHandler(controller.updateLocation),
);
