import { Role } from "@ps02/shared";
import express, { Router } from "express";
import * as controller from "../controllers/drivers";
import * as onboardingController from "../controllers/onboarding";
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
driversRouter.get("/demand", requireRole(Role.DRIVER), asyncHandler(controller.demand));

driversRouter.get(
  "/onboarding",
  requireRole(Role.DRIVER),
  asyncHandler(onboardingController.getMine),
);
driversRouter.put(
  "/onboarding",
  requireRole(Role.DRIVER),
  validate({ body: onboardingController.updateSchema }),
  asyncHandler(onboardingController.updateMine),
);
driversRouter.post(
  "/onboarding/submit",
  requireRole(Role.DRIVER),
  asyncHandler(onboardingController.submitMine),
);
driversRouter.post(
  "/onboarding/documents/:type",
  requireRole(Role.DRIVER),
  validate({
    params: onboardingController.uploadParamsSchema,
    query: onboardingController.uploadQuerySchema,
  }),
  express.raw({ type: ["application/pdf", "image/jpeg", "image/png"], limit: "5mb" }),
  asyncHandler(onboardingController.uploadMine),
);
driversRouter.get(
  "/onboarding/documents/:documentId",
  requireRole(Role.DRIVER),
  validate({ params: onboardingController.documentIdSchema }),
  asyncHandler(onboardingController.getMineDocument),
);

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
