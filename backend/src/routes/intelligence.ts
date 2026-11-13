import { Router } from "express";
import * as controller from "../controllers/intelligence";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";

export const intelligenceRouter = Router();

intelligenceRouter.use(requireAuth);
intelligenceRouter.get(
  "/zones",
  validate({ query: controller.zoneQuerySchema }),
  asyncHandler(controller.zones),
);

intelligenceRouter.get(
  "/areas",
  validate({ query: controller.areasQuerySchema }),
  asyncHandler(controller.areas),
);
