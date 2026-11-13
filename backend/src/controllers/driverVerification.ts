import type { Request, Response } from "express";
import { z } from "zod";
import { currentAuth } from "../middleware/auth";
import * as onboardingAdmin from "../services/onboardingAdmin";
import * as onboardingDocuments from "../services/onboardingDocuments";
import { safeOriginalName } from "../services/privateDocumentStore";

export const documentReviewSchema = z.object({
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const applicationReviewSchema = z.object({
  driverId: z.string().min(1).max(64),
});

export const applicationActionSchema = z.object({
  action: z.enum(["approve", "request_changes", "reject", "revoke"]),
  reason: z.string().trim().max(500).optional(),
});

export const documentIdSchema = z.object({
  documentId: z.string().min(1).max(64),
});

export async function list(_req: Request, res: Response) {
  res.json(await onboardingAdmin.listApplications());
}

export async function reviewDocument(req: Request, res: Response) {
  const { documentId } = req.validated.params as z.infer<typeof documentIdSchema>;
  const body = req.validated.body as z.infer<typeof documentReviewSchema>;
  res.json({
    result: await onboardingDocuments.reviewDocument({
      documentId,
      adminId: currentAuth(req).sub,
      ...body,
    }),
  });
}

export async function reviewApplication(req: Request, res: Response) {
  const { driverId } = req.validated.params as z.infer<typeof applicationReviewSchema>;
  const body = req.validated.body as z.infer<typeof applicationActionSchema>;
  res.json({
    application: await onboardingAdmin.reviewApplication({
      driverId,
      adminId: currentAuth(req).sub,
      ...body,
    }),
  });
}

export async function getDocument(req: Request, res: Response) {
  const { documentId } = req.validated.params as z.infer<typeof documentIdSchema>;
  const document = await onboardingDocuments.documentForViewer({
    documentId,
    isAdmin: true,
  });
  res.setHeader("Content-Type", document.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${safeOriginalName(document.originalName)}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(document.data);
}
