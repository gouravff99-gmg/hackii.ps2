import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readPrivateDocument,
  removePrivateDocument,
  safeOriginalName,
  storePrivateDocument,
} from "../services/privateDocumentStore";
import { decryptSensitiveValue, encryptSensitiveValue } from "../services/sensitiveData";

let storedKey: string | undefined;

afterEach(async () => {
  if (storedKey) await removePrivateDocument(storedKey);
  storedKey = undefined;
  vi.unstubAllEnvs();
});

describe("private onboarding storage", () => {
  it("stores and reads signature-checked documents by opaque keys", async () => {
    const data = Buffer.from("%PDF-1.7 private driver document");
    storedKey = await storePrivateDocument(data, "application/pdf");
    expect(storedKey).toMatch(/^[\da-f-]{36}\.pdf$/);
    expect(await readPrivateDocument(storedKey)).toEqual(data);
    expect(safeOriginalName("../../license.pdf")).toBe("license.pdf");
  });

  it("rejects a MIME type that does not match the file signature", async () => {
    expect(() => storePrivateDocument(Buffer.from("not a PNG"), "image/png")).toThrow(
      "File contents do not match",
    );
  });

  it("encrypts bank details with the configured key and never stores plaintext", () => {
    vi.stubEnv("SENSITIVE_DATA_KEY", "a".repeat(64));
    const account = "123456789012";
    const encrypted = encryptSensitiveValue(account);
    expect(encrypted).not.toContain(account);
    expect(decryptSensitiveValue(encrypted)).toBe(account);
  });

  it("fails explicitly when bank-detail encryption is not configured", () => {
    vi.stubEnv("SENSITIVE_DATA_KEY", "replace-with-64-hex-characters");
    expect(() => encryptSensitiveValue("123456789012")).toThrow(
      "Bank details storage is not configured",
    );
  });
});
