import { Router } from "express";
import { login, loginSchema, me, register, registerSchema } from "../controllers/auth";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";

export const authRouter = Router();

const authLimiter = rateLimit({ name: "auth", windowMs: 60_000, max: 20 });

authRouter.post("/register", authLimiter, validate({ body: registerSchema }), asyncHandler(register));
authRouter.post("/login", authLimiter, validate({ body: loginSchema }), asyncHandler(login));
authRouter.get("/me", requireAuth, asyncHandler(me));
