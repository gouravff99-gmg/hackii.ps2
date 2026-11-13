import type { Request, Response } from "express";
import { Role, VehicleType } from "@ps02/shared";
import { z } from "zod";
import { currentAuth } from "../middleware/auth";
import * as authService from "../services/auth";

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    role: z.nativeEnum(Role).refine((role) => role !== Role.ADMIN, {
      message: "Administrator accounts cannot be self-registered",
    }),
    vehicleType: z.nativeEnum(VehicleType).optional(),
  })
  .refine((data) => data.role !== Role.DRIVER || Boolean(data.vehicleType), {
    message: "Choose a vehicle type for driver accounts",
    path: ["vehicleType"],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function register(req: Request, res: Response) {
  const body = req.validated.body as z.infer<typeof registerSchema>;
  const result = await authService.register(body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const body = req.validated.body as z.infer<typeof loginSchema>;
  const result = await authService.login(body);
  res.json(result);
}

export async function me(req: Request, res: Response) {
  const { sub } = currentAuth(req);
  res.json({ user: await authService.getCurrentUser(sub) });
}
