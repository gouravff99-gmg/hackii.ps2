import {
  DocumentReviewStatus,
  DriverOnboardingStatus,
  DriverStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { encryptSensitiveValue } from "./sensitiveData";
import {
  applicationInclude,
  applicationView,
  ensureApplication,
  missingApprovalRequirements,
  recordHistory,
  type SafetyChecklist,
} from "./onboardingShared";

export async function getApplication(driverId: string) {
  let row = await ensureApplication(driverId);
  if (
    row.status === DriverOnboardingStatus.APPROVED &&
    row.documents.some((document) => document.expiryDate && document.expiryDate <= new Date())
  ) {
    const driver = await prisma.driver.findUniqueOrThrow({
      where: { id: driverId },
      select: { userId: true },
    });
    row = await prisma.$transaction(async (tx) => {
      const expired = await tx.driverOnboarding.update({
        where: { id: row.id },
        data: { status: DriverOnboardingStatus.EXPIRED },
        include: applicationInclude,
      });
      await tx.driver.update({
        where: { id: driverId },
        data: { status: DriverStatus.OFFLINE },
      });
      await recordHistory(tx, row.id, driver.userId, "APPLICATION_EXPIRED", {
        reason: "An approved document has expired",
      });
      return expired;
    });
  }
  return applicationView(row);
}

export async function updateApplication(params: {
  driverId: string;
  actorId: string;
  safetyChecklist: SafetyChecklist;
  safetyTrainingComplete: boolean;
  bankAccountNumber?: string;
  bankIfsc?: string;
}) {
  const current = await ensureApplication(params.driverId);
  if (
    current.status === DriverOnboardingStatus.UNDER_REVIEW ||
    current.status === DriverOnboardingStatus.APPROVED
  ) {
    throw ApiError.conflict("The application cannot be edited while under review or after approval");
  }
  const updateData: Prisma.DriverOnboardingUpdateInput = {
    safetyChecklist: params.safetyChecklist as Prisma.InputJsonValue,
    safetyTrainingComplete: params.safetyTrainingComplete,
    status:
      current.status === DriverOnboardingStatus.NOT_STARTED
        ? DriverOnboardingStatus.IN_PROGRESS
        : current.status,
  };
  if (params.bankAccountNumber) {
    updateData.bankAccountEncrypted = encryptSensitiveValue(params.bankAccountNumber);
    updateData.bankAccountLast4 = params.bankAccountNumber.slice(-4);
    updateData.bankIfsc = params.bankIfsc;
  } else if (params.bankIfsc) {
    updateData.bankIfsc = params.bankIfsc;
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.driverOnboarding.update({
      where: { id: current.id },
      data: updateData,
      include: applicationInclude,
    });
    await recordHistory(tx, current.id, params.actorId, "APPLICATION_UPDATED", {
      safetyTrainingComplete: params.safetyTrainingComplete,
      bankDetailsUpdated: Boolean(params.bankAccountNumber),
    });
    return updated;
  });
  return applicationView(row);
}

export async function submitApplication(driverId: string, actorId: string) {
  const row = await ensureApplication(driverId);
  if (
    row.status === DriverOnboardingStatus.UNDER_REVIEW ||
    row.status === DriverOnboardingStatus.APPROVED
  ) {
    throw ApiError.conflict("The application is already under review or approved");
  }
  const missing = missingApprovalRequirements(row, false);
  if (missing.length) {
    throw ApiError.badRequest("Complete required onboarding information before submitting", missing);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const application = await tx.driverOnboarding.update({
      where: { id: row.id },
      data: {
        status: DriverOnboardingStatus.UNDER_REVIEW,
        submittedAt: new Date(),
        adminComments: null,
      },
      include: applicationInclude,
    });
    await tx.driverOnboardingDocument.updateMany({
      where: { onboardingId: row.id, status: DocumentReviewStatus.REJECTED },
      data: { status: DocumentReviewStatus.PENDING, rejectionReason: null },
    });
    await recordHistory(tx, row.id, actorId, "APPLICATION_SUBMITTED");
    return tx.driverOnboarding.findUniqueOrThrow({
      where: { id: application.id },
      include: applicationInclude,
    });
  });
  return applicationView(updated);
}
