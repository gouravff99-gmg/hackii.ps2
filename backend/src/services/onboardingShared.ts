import {
  DocumentReviewStatus,
  DriverDocumentType,
  DriverOnboardingStatus,
  Prisma,
} from "@prisma/client";
import {
  DocumentReviewStatus as SharedDocumentReviewStatus,
  DriverDocumentType as SharedDriverDocumentType,
  DriverOnboardingStatus as SharedDriverOnboardingStatus,
} from "@ps02/shared";
import type {
  DriverOnboardingApplication,
  DriverOnboardingDocument,
} from "@ps02/shared";
import { prisma } from "../lib/prisma";

export const REQUIRED_DOCUMENTS: DriverDocumentType[] = [
  DriverDocumentType.DRIVING_LICENSE,
  DriverDocumentType.TRANSPORT_BADGE,
  DriverDocumentType.AADHAAR,
  DriverDocumentType.PAN,
  DriverDocumentType.PROFILE_PHOTO,
  DriverDocumentType.POLICE_VERIFICATION,
  DriverDocumentType.VEHICLE_RC,
  DriverDocumentType.INSURANCE,
  DriverDocumentType.FITNESS_CERTIFICATE,
  DriverDocumentType.PUC_CERTIFICATE,
  DriverDocumentType.BANK_PROOF,
  DriverDocumentType.LIVE_SELFIE,
];

export const EXPIRY_REQUIRED = new Set<DriverDocumentType>([
  DriverDocumentType.DRIVING_LICENSE,
  DriverDocumentType.TRANSPORT_BADGE,
  DriverDocumentType.POLICE_VERIFICATION,
  DriverDocumentType.INSURANCE,
  DriverDocumentType.FITNESS_CERTIFICATE,
  DriverDocumentType.PUC_CERTIFICATE,
  DriverDocumentType.PERMIT,
]);

const SHARED_DOCUMENT_TYPES: Record<DriverDocumentType, SharedDriverDocumentType> = {
  [DriverDocumentType.DRIVING_LICENSE]: SharedDriverDocumentType.DRIVING_LICENSE,
  [DriverDocumentType.TRANSPORT_BADGE]: SharedDriverDocumentType.TRANSPORT_BADGE,
  [DriverDocumentType.AADHAAR]: SharedDriverDocumentType.AADHAAR,
  [DriverDocumentType.PAN]: SharedDriverDocumentType.PAN,
  [DriverDocumentType.PROFILE_PHOTO]: SharedDriverDocumentType.PROFILE_PHOTO,
  [DriverDocumentType.POLICE_VERIFICATION]: SharedDriverDocumentType.POLICE_VERIFICATION,
  [DriverDocumentType.VEHICLE_RC]: SharedDriverDocumentType.VEHICLE_RC,
  [DriverDocumentType.INSURANCE]: SharedDriverDocumentType.INSURANCE,
  [DriverDocumentType.PERMIT]: SharedDriverDocumentType.PERMIT,
  [DriverDocumentType.FITNESS_CERTIFICATE]: SharedDriverDocumentType.FITNESS_CERTIFICATE,
  [DriverDocumentType.PUC_CERTIFICATE]: SharedDriverDocumentType.PUC_CERTIFICATE,
  [DriverDocumentType.OWNER_NOC]: SharedDriverDocumentType.OWNER_NOC,
  [DriverDocumentType.BANK_PROOF]: SharedDriverDocumentType.BANK_PROOF,
  [DriverDocumentType.LIVE_SELFIE]: SharedDriverDocumentType.LIVE_SELFIE,
};
const SHARED_DOCUMENT_STATUSES: Record<DocumentReviewStatus, SharedDocumentReviewStatus> = {
  [DocumentReviewStatus.PENDING]: SharedDocumentReviewStatus.PENDING,
  [DocumentReviewStatus.APPROVED]: SharedDocumentReviewStatus.APPROVED,
  [DocumentReviewStatus.REJECTED]: SharedDocumentReviewStatus.REJECTED,
};
const SHARED_APPLICATION_STATUSES: Record<DriverOnboardingStatus, SharedDriverOnboardingStatus> = {
  [DriverOnboardingStatus.NOT_STARTED]: SharedDriverOnboardingStatus.NOT_STARTED,
  [DriverOnboardingStatus.IN_PROGRESS]: SharedDriverOnboardingStatus.IN_PROGRESS,
  [DriverOnboardingStatus.DOCUMENTS_SUBMITTED]: SharedDriverOnboardingStatus.DOCUMENTS_SUBMITTED,
  [DriverOnboardingStatus.UNDER_REVIEW]: SharedDriverOnboardingStatus.UNDER_REVIEW,
  [DriverOnboardingStatus.CHANGES_REQUESTED]: SharedDriverOnboardingStatus.CHANGES_REQUESTED,
  [DriverOnboardingStatus.APPROVED]: SharedDriverOnboardingStatus.APPROVED,
  [DriverOnboardingStatus.REVOKED]: SharedDriverOnboardingStatus.REVOKED,
  [DriverOnboardingStatus.REJECTED]: SharedDriverOnboardingStatus.REJECTED,
  [DriverOnboardingStatus.EXPIRED]: SharedDriverOnboardingStatus.EXPIRED,
};
const SAFETY_CHECKS = ["seatbelts", "brakes", "lights", "mirrors", "ac", "gps", "sos"] as const;
export type SafetyChecklist = Record<
  (typeof SAFETY_CHECKS)[number] | "permitRequired" | "ownerNocRequired",
  boolean
>;

export const applicationInclude = {
  documents: { orderBy: { uploadedAt: "asc" as const } },
} satisfies Prisma.DriverOnboardingInclude;

export type OnboardingRow = Prisma.DriverOnboardingGetPayload<{ include: typeof applicationInclude }>;

function documentView(document: OnboardingRow["documents"][number]): DriverOnboardingDocument {
  return {
    id: document.id,
    type: SHARED_DOCUMENT_TYPES[document.type],
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    status: SHARED_DOCUMENT_STATUSES[document.status],
    expiryDate: document.expiryDate?.toISOString() ?? null,
    rejectionReason: document.rejectionReason,
    uploadedAt: document.uploadedAt.toISOString(),
  };
}

function safeChecklist(value: Prisma.JsonValue): SafetyChecklist {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as SafetyChecklist;
  return value as SafetyChecklist;
}

export function applicationView(row: OnboardingRow): DriverOnboardingApplication {
  const uploaded = new Set(row.documents.map((document) => document.type));
  const requiredUploaded = REQUIRED_DOCUMENTS.filter((type) => uploaded.has(type)).length;
  const checks = safeChecklist(row.safetyChecklist);
  const docsPercent = (requiredUploaded / REQUIRED_DOCUMENTS.length) * 55;
  const safetyPercent =
    (SAFETY_CHECKS.filter((key) => checks[key] === true).length / SAFETY_CHECKS.length) * 25;
  const trainingPercent = row.safetyTrainingComplete ? 10 : 0;
  const bankPercent = row.bankAccountEncrypted && row.bankIfsc ? 10 : 0;
  return {
    driverId: row.driverId,
    status: SHARED_APPLICATION_STATUSES[row.status],
    adminComments: row.adminComments,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    documents: row.documents.map(documentView),
    safetyChecklist: checks,
    safetyTrainingComplete: row.safetyTrainingComplete,
    bankAccountLast4: row.bankAccountLast4,
    bankIfsc: row.bankIfsc,
    completionPercent: Math.min(100, Math.round(docsPercent + safetyPercent + trainingPercent + bankPercent)),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function ensureApplication(driverId: string) {
  return prisma.driverOnboarding.upsert({
    where: { driverId },
    create: { driverId },
    update: {},
    include: applicationInclude,
  });
}

export async function recordHistory(
  tx: Prisma.TransactionClient,
  onboardingId: string,
  actorId: string,
  action: string,
  details?: Prisma.InputJsonValue,
) {
  await tx.driverVerificationHistory.create({
    data: { onboardingId, actorId, action, details },
  });
}

export function missingApprovalRequirements(
  row: {
    documents: Pick<OnboardingRow["documents"][number], "type" | "status" | "expiryDate">[];
    safetyChecklist: Prisma.JsonValue;
    safetyTrainingComplete: boolean;
    bankAccountEncrypted: string | null;
    bankIfsc: string | null;
  },
  requireApproval = true,
  now = new Date(),
): string[] {
  const docs = new Map(row.documents.map((document) => [document.type, document]));
  const missing = REQUIRED_DOCUMENTS.filter((type) => {
    const document = docs.get(type);
    return !document || (requireApproval && document.status !== DocumentReviewStatus.APPROVED);
  }).map((type) =>
    requireApproval ? `${type} must be uploaded and approved` : `${type} must be uploaded`,
  );
  const checks = safeChecklist(row.safetyChecklist);
  for (const key of SAFETY_CHECKS) {
    if (checks[key] !== true) missing.push(`Vehicle safety check "${key}" must pass`);
  }
  if (checks.permitRequired && !docs.has(DriverDocumentType.PERMIT)) {
    missing.push("Required contract carriage permit must be uploaded");
  }
  if (checks.ownerNocRequired && !docs.has(DriverDocumentType.OWNER_NOC)) {
    missing.push("Required owner NOC or lease agreement must be uploaded");
  }
  if (!row.safetyTrainingComplete) missing.push("Safety training must be completed");
  if (!row.bankAccountEncrypted || !row.bankIfsc) missing.push("Bank details must be provided");
  for (const document of row.documents) {
    if (requireApproval && document.status !== DocumentReviewStatus.APPROVED) {
      missing.push(`${document.type} must be approved`);
    }
    if (document.expiryDate && document.expiryDate.getTime() <= now.getTime()) {
      missing.push(`${document.type} has expired`);
    }
  }
  for (const type of EXPIRY_REQUIRED) {
    if (docs.has(type) && !docs.get(type)?.expiryDate) {
      missing.push(`${type} needs an expiry date`);
    }
  }
  return [...new Set(missing)];
}
