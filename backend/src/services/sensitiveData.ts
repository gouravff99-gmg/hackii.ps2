import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ApiError } from "../utils/ApiError";

function encryptionKey(): Buffer {
  const raw = process.env.SENSITIVE_DATA_KEY?.trim() ?? "";
  if (!/^[\da-fA-F]{64}$/.test(raw)) {
    throw new ApiError(503, "Bank details storage is not configured", {
      code: "sensitive_storage_unavailable",
    });
  }
  return Buffer.from(raw, "hex");
}

export function encryptSensitiveValue(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSensitiveValue(value: string): string {
  const [version, ivText, tagText, encryptedText] = value.split(":");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) {
    throw new ApiError(500, "Stored bank detail has an invalid format", {
      code: "sensitive_data_invalid",
    });
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
