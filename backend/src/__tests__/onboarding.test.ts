import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DocumentReviewStatus,
  DriverDocumentType,
} from "@prisma/client";
import {
  missingApprovalRequirements,
  REQUIRED_DOCUMENTS,
} from "../services/onboardingShared";

const NOW = new Date("2026-04-15T12:00:00.000Z");
const SAFETY_CHECKLIST = {
  seatbelts: true,
  brakes: true,
  lights: true,
  mirrors: true,
  ac: true,
  gps: true,
  sos: true,
  permitRequired: false,
  ownerNocRequired: false,
};

function application(
  status: DocumentReviewStatus = DocumentReviewStatus.APPROVED,
  expiryDate = new Date("2027-01-01T00:00:00.000Z"),
) {
  const safetyChecklist: Record<string, boolean> = { ...SAFETY_CHECKLIST };
  return {
    documents: REQUIRED_DOCUMENTS.map((type) => ({ type, status, expiryDate })),
    safetyChecklist,
    safetyTrainingComplete: true,
    bankAccountEncrypted: "encrypted",
    bankIfsc: "ABCD0123456",
  };
}

describe("driver onboarding requirements", () => {
  it("allows submission with complete but not yet reviewed documents", () => {
    expect(
      missingApprovalRequirements(application(DocumentReviewStatus.PENDING), false, NOW),
    ).toEqual([]);
  });

  it("requires every required document to be approved before driver approval", () => {
    const missing = missingApprovalRequirements(
      application(DocumentReviewStatus.PENDING),
      true,
      NOW,
    );
    expect(missing).toContain(`${DriverDocumentType.DRIVING_LICENSE} must be uploaded and approved`);
    expect(missing).toContain(`${DriverDocumentType.BANK_PROOF} must be approved`);
  });

  it("rejects expired documents and missing conditional permit documents", () => {
    const row = application();
    row.safetyChecklist = { ...SAFETY_CHECKLIST, permitRequired: true };
    row.documents = row.documents.filter((document) => document.type !== DriverDocumentType.PERMIT);
    row.documents[0] = {
      ...row.documents[0],
      expiryDate: new Date("2026-04-14T00:00:00.000Z"),
    };
    const missing = missingApprovalRequirements(row, true, NOW);
    expect(missing).toContain("Required contract carriage permit must be uploaded");
    expect(missing).toContain(`${row.documents[0].type} has expired`);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
