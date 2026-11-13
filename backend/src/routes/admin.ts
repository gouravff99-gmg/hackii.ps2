import { Role } from "@ps02/shared";
import { Router } from "express";
import * as controller from "../controllers/admin";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(Role.ADMIN));

adminRouter.get("/overview", asyncHandler(controller.overview));
adminRouter.get("/metrics", asyncHandler(controller.metrics));

adminRouter.get("/drivers", asyncHandler(controller.drivers));
adminRouter.get("/rides", asyncHandler(controller.rides));
adminRouter.get("/events", asyncHandler(controller.events));

adminRouter.get(
  "/zones",
  validate({ query: controller.hourQuerySchema }),
  asyncHandler(controller.zones),
);
adminRouter.get(
  "/forecast",
  validate({ query: controller.hourQuerySchema }),
  asyncHandler(controller.forecast),
);
adminRouter.get(
  "/recommendations",
  validate({ query: controller.hourQuerySchema }),
  asyncHandler(controller.recommendations),
);

adminRouter.get("/pool-candidates", asyncHandler(controller.poolCandidates));
adminRouter.get("/allocations", asyncHandler(controller.allocations));

adminRouter.get("/sim", asyncHandler(controller.simStatus));
adminRouter.post(
  "/sim/start",
  validate({ body: controller.simStartSchema }),
  asyncHandler(controller.simStart),
);
adminRouter.post("/sim/stop", asyncHandler(controller.simStop));
adminRouter.post("/sim/reset", asyncHandler(controller.simReset));

adminRouter.post(
  "/chaos",
  validate({ body: controller.chaosSchema }),
  asyncHandler(controller.chaos),
);
adminRouter.post(
  "/evaluate",
  validate({ body: controller.evaluateSchema }),
  asyncHandler(controller.evaluate),
);
adminRouter.get("/sim-runs", asyncHandler(controller.simRuns));
