import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ApiError } from "../utils/ApiError";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const STORAGE_DIRECTORY = path.resolve(__dirname, "../../private-documents");
const ALLOWED_TYPES = {
  "application/pdf": { extension: ".pdf", signature: (data: Buffer) => data.subarray(0, 5).toString() === "%PDF-" },
  "image/jpeg": { extension: ".jpg", signature: (data: Buffer) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  "image/png": { extension: ".png", signature: (data: Buffer) => data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
} as const;

export function storePrivateDocument(data: Buffer, mimeType: string): Promise<string> {
  const type = ALLOWED_TYPES[mimeType as keyof typeof ALLOWED_TYPES];
  if (!type) throw ApiError.badRequest("Only PDF, JPEG and PNG documents are accepted");
  if (data.length === 0 || data.length > MAX_DOCUMENT_BYTES) {
    throw ApiError.badRequest("Document must be between 1 byte and 5 MB");
  }
  if (!type.signature(data)) {
    throw ApiError.badRequest("File contents do not match the declared document type");
  }
  const key = `${randomUUID()}${type.extension}`;
  return mkdir(STORAGE_DIRECTORY, { recursive: true, mode: 0o700 })
    .then(() => writeFile(path.join(STORAGE_DIRECTORY, key), data, { mode: 0o600, flag: "wx" }))
    .then(() => key);
}

export async function readPrivateDocument(storageKey: string): Promise<Buffer> {
  if (!/^[\da-f-]{36}\.(pdf|jpg|png)$/.test(storageKey)) {
    throw ApiError.notFound("Document not found");
  }
  try {
    return await readFile(path.join(STORAGE_DIRECTORY, storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw ApiError.notFound("Document file not found");
    }
    throw error;
  }
}

export async function removePrivateDocument(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(STORAGE_DIRECTORY, storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function safeOriginalName(name: string): string {
  const normalized = path.basename(name).replace(/[^\w.-]/g, "_").slice(0, 120);
  return normalized || "driver-document";
}
