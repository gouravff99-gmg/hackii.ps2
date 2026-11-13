import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { documentForViewer } from "../services/onboardingDocuments";
import { removePrivateDocument, storePrivateDocument } from "../services/privateDocumentStore";

vi.mock("../lib/prisma", () => ({
  prisma: {
    driverOnboardingDocument: { findUnique: vi.fn() },
  },
}));

describe("private onboarding document access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("denies a driver access to another driver's document before reading the file", async () => {
    vi.mocked(prisma.driverOnboardingDocument.findUnique).mockResolvedValue({
      id: "document-id",
      storageKey: "00000000-0000-0000-0000-000000000000.pdf",
      mimeType: "application/pdf",
      originalName: "license.pdf",
      onboarding: { driverId: "owner-driver" },
    } as never);

    await expect(documentForViewer({
      documentId: "document-id",
      driverId: "different-driver",
      isAdmin: false,
    })).rejects.toMatchObject({ status: 403 });
  });

  it("allows an administrator to view another driver's document", async () => {
    const data = Buffer.from("%PDF-1.7 reviewed document");
    const storageKey = await storePrivateDocument(data, "application/pdf");
    try {
      vi.mocked(prisma.driverOnboardingDocument.findUnique).mockResolvedValue({
        id: "document-id",
        storageKey,
        mimeType: "application/pdf",
        originalName: "license.pdf",
        onboarding: { driverId: "owner-driver" },
      } as never);
      const document = await documentForViewer({
        documentId: "document-id",
        isAdmin: true,
      });
      expect(document.data).toEqual(data);
    } finally {
      await removePrivateDocument(storageKey);
    }
  });
});
