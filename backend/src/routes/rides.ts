import { Role } from "@ps02/shared";
import { Router } from "express";
import * as controller from "../controllers/rides";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";

export const ridesRouter = Router();

ridesRouter.use(requireAuth);

const rideParams = validate({ params: controller.idParamSchema });

ridesRouter.post(
  "/estimate",
  requireRole(Role.PASSENGER, Role.ADMIN),
  validate({ body: controller.placeSchema }),
  asyncHandler(controller.estimate),
);

ridesRouter.get("/history", requireRole(Role.PASSENGER), asyncHandler(controller.history));
ridesRouter.get("/driver/active", requireRole(Role.DRIVER), asyncHandler(controller.driverActive));
ridesRouter.get("/driver/offer", requireRole(Role.DRIVER), asyncHandler(controller.driverOffer));
ridesRouter.get("/driver/history", requireRole(Role.DRIVER), asyncHandler(controller.driverHistory));

ridesRouter.post(
  "/",
  requireRole(Role.PASSENGER),
  validate({ body: controller.placeSchema }),
  asyncHandler(controller.create),
);

ridesRouter.get("/:rideId", rideParams, asyncHandler(controller.getById));
ridesRouter.post("/:rideId/cancel", rideParams, asyncHandler(controller.cancel));

ridesRouter.post(
  "/:rideId/respond",
  requireRole(Role.DRIVER),
  validate({ params: controller.idParamSchema, body: controller.respondSchema }),
  asyncHandler(controller.respond),
);

ridesRouter.post(
  "/:rideId/advance",
  requireRole(Role.DRIVER),
  validate({ params: controller.idParamSchema, body: controller.advanceSchema }),
  asyncHandler(controller.advance),
);

ridesRouter.post(
  "/:rideId/driver-cancel",
  requireRole(Role.DRIVER),
  rideParams,
  asyncHandler(controller.driverCancel),
);
