import {
  DriverOnboardingStatus,
  DriverStatus,
} from "@prisma/client";
import type { DriverVerificationHistoryEntry } from "@ps02/shared";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import {
  applicationInclude,
  applicationView,
  ensureApplication,
  missingApprovalRequirements,
  recordHistory,
} from "./onboardingShared";

export async function listApplications() {
  const rows = await prisma.driverOnboarding.findMany({
    where: {
      status: {
        in: [
          DriverOnboardingStatus.UNDER_REVIEW,
          DriverOnboardingStatus.CHANGES_REQUESTED,
          DriverOnboardingStatus.APPROVED,
          DriverOnboardingStatus.REVOKED,
          DriverOnboardingStatus.REJECTED,
          DriverOnboardingStatus.EXPIRED,
        ],
      },
    },
    include: {
      ...applicationInclude,
      driver: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
  });
  const historyRows = await prisma.driverVerificationHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true } } },
  });
  return {
    applications: rows.map((row) => ({
      ...applicationView(row),
      driver: {
        id: row.driver.id,
        user: row.driver.user,
        vehicleType: row.driver.vehicleType,
      },
    })),
    history: historyRows.map((entry): DriverVerificationHistoryEntry => ({
      id: entry.id,
      action: entry.action,
      details:
        entry.details && typeof entry.details === "object" && !Array.isArray(entry.details)
          ? (entry.details as Record<string, unknown>)
          : null,
      createdAt: entry.createdAt.toISOString(),
      actorName: entry.actor.name,
    })),
  };
}

export async function reviewApplication(params: {
  driverId: string;
  adminId: string;
  action: "approve" | "request_changes" | "reject" | "revoke";
  reason?: string;
}) {
  const row = await ensureApplication(params.driverId);
  if (
    (params.action === "revoke" && row.status !== DriverOnboardingStatus.APPROVED) ||
    (params.action !== "revoke" && row.status !== DriverOnboardingStatus.UNDER_REVIEW)
  ) {
    throw ApiError.conflict("This review action is not valid for the application's current status");
  }
  if (params.action === "approve") {
    const missing = missingApprovalRequirements(row);
    if (missing.length) {
      throw ApiError.badRequest("Application does not meet approval requirements", missing);
    }
  } else if (!params.reason?.trim()) {
    throw ApiError.badRequest("A reason is required for this action");
  }
  const status =
    params.action === "approve"
      ? DriverOnboardingStatus.APPROVED
      : params.action === "request_changes"
        ? DriverOnboardingStatus.CHANGES_REQUESTED
        : params.action === "revoke"
          ? DriverOnboardingStatus.REVOKED
          : DriverOnboardingStatus.REJECTED;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.driverOnboarding.update({
      where: { id: row.id },
      data: {
        status,
        adminComments: params.action === "approve" ? null : params.reason?.trim(),
        approvedAt: params.action === "approve" ? new Date() : null,
      },
      include: applicationInclude,
    });
    if (params.action === "revoke") {
      await tx.driver.update({
        where: { id: params.driverId },
        data: { status: DriverStatus.OFFLINE },
      });
    }
    await recordHistory(tx, row.id, params.adminId, `APPLICATION_${params.action.toUpperCase()}`, {
      reason: params.reason?.trim() ?? null,
    });
    return applicationView(updated);
  });
}
