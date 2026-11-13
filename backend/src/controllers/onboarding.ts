import { DriverDocumentType, Role } from "@ps02/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import { currentAuth } from "../middleware/auth";
import * as onboarding from "../services/onboarding";
import * as onboardingDocuments from "../services/onboardingDocuments";
import { safeOriginalName } from "../services/privateDocumentStore";
import { ApiError } from "../utils/ApiError";

const checklistSchema = z.object({
  seatbelts: z.boolean(),
  brakes: z.boolean(),
  lights: z.boolean(),
  mirrors: z.boolean(),
  ac: z.boolean(),
  gps: z.boolean(),
  sos: z.boolean(),
  permitRequired: z.boolean().default(false),
  ownerNocRequired: z.boolean().default(false),
});

export const updateSchema = z.object({
  safetyChecklist: checklistSchema,
  safetyTrainingComplete: z.boolean(),
  bankAccountNumber: z.string().regex(/^\d{8,20}$/).optional(),
  bankIfsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).optional(),
});

export const uploadParamsSchema = z.object({
  type: z.nativeEnum(DriverDocumentType),
});

export const uploadQuerySchema = z.object({
  fileName: z.string().min(1).max(255),
  expiryDate: z.coerce.date().optional(),
});

export const documentIdSchema = z.object({
  documentId: z.string().min(1).max(64),
});

function driverPrincipal(req: Request) {
  const auth = currentAuth(req);
  if (auth.role !== Role.DRIVER || !auth.driverId) {
    throw ApiError.forbidden("A driver account is required");
  }
  return auth;
}

export async function getMine(req: Request, res: Response) {
  const auth = driverPrincipal(req);
  res.json({ application: await onboarding.getApplication(auth.driverId!) });
}

export async function updateMine(req: Request, res: Response) {
  const auth = driverPrincipal(req);
  const body = req.validated.body as z.infer<typeof updateSchema>;
  res.json({
    application: await onboarding.updateApplication({
      driverId: auth.driverId!,
      actorId: auth.sub,
      ...body,
    }),
  });
}

export async function uploadMine(req: Request, res: Response) {
  const auth = driverPrincipal(req);
  const { type } = req.validated.params as z.infer<typeof uploadParamsSchema>;
  const { fileName, expiryDate } = req.validated.query as z.infer<typeof uploadQuerySchema>;
  if (!Buffer.isBuffer(req.body)) {
    throw ApiError.badRequest("Upload a PDF, JPEG or PNG document");
  }
  const mimeType = req.headers["content-type"]?.split(";")[0]?.trim() ?? "";
  res.json({
    application: await onboardingDocuments.uploadDocument({
      driverId: auth.driverId!,
      actorId: auth.sub,
      type,
      originalName: safeOriginalName(fileName),
      mimeType,
      expiryDate,
      data: req.body,
    }),
  });
}

export async function submitMine(req: Request, res: Response) {
  const auth = driverPrincipal(req);
  res.json({
    application: await onboarding.submitApplication(auth.driverId!, auth.sub),
  });
}

export async function getMineDocument(req: Request, res: Response) {
  const auth = driverPrincipal(req);
  const { documentId } = req.validated.params as z.infer<typeof documentIdSchema>;
  await sendDocument(res, await onboardingDocuments.documentForViewer({
    documentId,
    driverId: auth.driverId,
    isAdmin: false,
  }));
}

export async function getAdminDocument(req: Request, res: Response) {
  const auth = currentAuth(req);
  const { documentId } = req.validated.params as z.infer<typeof documentIdSchema>;
  await sendDocument(res, await onboardingDocuments.documentForViewer({
    documentId,
    isAdmin: auth.role === Role.ADMIN,
  }));
}

async function sendDocument(
  res: Response,
  document: { data: Buffer; mimeType: string; originalName: string },
) {
  const name = safeOriginalName(document.originalName);
  res.setHeader("Content-Type", document.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${name}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(document.data);
}
