import {
  DocumentReviewStatus,
  DriverDocumentType,
  DriverOnboardingStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import {
  MAX_DOCUMENT_BYTES,
  readPrivateDocument,
  removePrivateDocument,
  safeOriginalName,
  storePrivateDocument,
} from "./privateDocumentStore";
import { applicationInclude, applicationView, ensureApplication, recordHistory } from "./onboardingShared";

export async function uploadDocument(params: {
  driverId: string;
  actorId: string;
  type: DriverDocumentType;
  originalName: string;
  mimeType: string;
  expiryDate?: Date;
  data: Buffer;
}) {
  if (params.data.length > MAX_DOCUMENT_BYTES) throw ApiError.badRequest("Document exceeds 5 MB");
  if (EXPIRY_REQUIRED.has(params.type) && !params.expiryDate) {
    throw ApiError.badRequest("An expiry date is required for this document");
  }
  if (params.expiryDate && params.expiryDate.getTime() <= Date.now()) {
    throw ApiError.badRequest("Document expiry date must be in the future");
  }
  const current = await ensureApplication(params.driverId);
  if (
    current.status === DriverOnboardingStatus.UNDER_REVIEW ||
    current.status === DriverOnboardingStatus.APPROVED
  ) {
    throw ApiError.conflict("Documents cannot be changed while under review or after approval");
  }

  const existing = current.documents.find((document) => document.type === params.type);
  if (
    existing?.status === DocumentReviewStatus.APPROVED &&
    current.status !== DriverOnboardingStatus.CHANGES_REQUESTED &&
    current.status !== DriverOnboardingStatus.REJECTED
  ) {
    throw ApiError.conflict("An approved document cannot be replaced without admin review");
  }

  const storageKey = await storePrivateDocument(params.data, params.mimeType);
  let row: Awaited<ReturnType<typeof ensureApplication>>;
  try {
    row = await prisma.$transaction(async (tx) => {
      await tx.driverOnboardingDocument.upsert({
        where: {
          onboardingId_type: { onboardingId: current.id, type: params.type },
        },
        create: {
          onboardingId: current.id,
          type: params.type,
          storageKey,
          originalName: safeOriginalName(params.originalName),
          mimeType: params.mimeType,
          sizeBytes: params.data.length,
          expiryDate: params.expiryDate,
        },
        update: {
          storageKey,
          originalName: safeOriginalName(params.originalName),
          mimeType: params.mimeType,
          sizeBytes: params.data.length,
          expiryDate: params.expiryDate,
          status: DocumentReviewStatus.PENDING,
          rejectionReason: null,
          reviewedById: null,
          reviewedAt: null,
        },
      });
      await tx.driverOnboarding.update({
        where: { id: current.id },
        data: {
          status:
            current.status === DriverOnboardingStatus.CHANGES_REQUESTED ||
            current.status === DriverOnboardingStatus.REJECTED
              ? DriverOnboardingStatus.IN_PROGRESS
              : current.status,
        },
      });
      await recordHistory(tx, current.id, params.actorId, "DOCUMENT_UPLOADED", {
        type: params.type,
        originalName: safeOriginalName(params.originalName),
      });
      return tx.driverOnboarding.findUniqueOrThrow({
        where: { id: current.id },
        include: applicationInclude,
      });
    });
  } catch (error) {
    await removePrivateDocument(storageKey);
    throw error;
  }
  if (existing) await removePrivateDocument(existing.storageKey);
  return applicationView(row);
}

const EXPIRY_REQUIRED = new Set<DriverDocumentType>([
  DriverDocumentType.DRIVING_LICENSE,
  DriverDocumentType.TRANSPORT_BADGE,
  DriverDocumentType.POLICE_VERIFICATION,
  DriverDocumentType.INSURANCE,
  DriverDocumentType.FITNESS_CERTIFICATE,
  DriverDocumentType.PUC_CERTIFICATE,
  DriverDocumentType.PERMIT,
]);

export async function reviewDocument(params: {
  documentId: string;
  adminId: string;
  approve: boolean;
  reason?: string;
}) {
  const document = await prisma.driverOnboardingDocument.findUnique({
    where: { id: params.documentId },
    include: { onboarding: true },
  });
  if (!document) throw ApiError.notFound("Driver document not found");
  if (document.expiryDate && document.expiryDate.getTime() <= Date.now() && params.approve) {
    throw ApiError.badRequest("An expired document cannot be approved");
  }
  if (!params.approve && !params.reason?.trim()) {
    throw ApiError.badRequest("A rejection reason is required");
  }
  if (document.onboarding.status !== DriverOnboardingStatus.UNDER_REVIEW) {
    throw ApiError.conflict("Documents can only be reviewed while an application is under review");
  }
  return prisma.$transaction(async (tx) => {
    const status = params.approve ? DocumentReviewStatus.APPROVED : DocumentReviewStatus.REJECTED;
    await tx.driverOnboardingDocument.update({
      where: { id: document.id },
      data: {
        status,
        rejectionReason: params.approve ? null : params.reason?.trim(),
        reviewedById: params.adminId,
        reviewedAt: new Date(),
      },
    });
    if (!params.approve) {
      await tx.driverOnboarding.update({
        where: { id: document.onboardingId },
        data: {
          status: DriverOnboardingStatus.CHANGES_REQUESTED,
          adminComments: params.reason?.trim(),
        },
      });
    }
    await recordHistory(tx, document.onboardingId, params.adminId, "DOCUMENT_REVIEWED", {
      documentId: document.id,
      type: document.type,
      status,
      reason: params.reason?.trim() ?? null,
    });
    return { ok: true, status };
  });
}

export async function documentForViewer(params: {
  documentId: string;
  driverId?: string;
  isAdmin: boolean;
}) {
  const document = await prisma.driverOnboardingDocument.findUnique({
    where: { id: params.documentId },
    include: { onboarding: { select: { driverId: true } } },
  });
  if (!document) throw ApiError.notFound("Driver document not found");
  if (!params.isAdmin && document.onboarding.driverId !== params.driverId) {
    throw ApiError.forbidden("You cannot access this driver document");
  }
  return {
    data: await readPrivateDocument(document.storageKey),
    mimeType: document.mimeType,
    originalName: document.originalName,
  };
}
