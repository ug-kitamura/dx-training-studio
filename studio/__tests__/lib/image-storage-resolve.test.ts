import { afterEach, describe, expect, it } from "vitest";
import {
  STORAGE_CONNECTION_ERROR_MESSAGE,
  StorageConnectionError,
} from "@/lib/image-storage/types";
import {
  parseImageStorageMode,
  resolveCanonicalBackend,
} from "@/lib/image-storage/resolve";

describe("image-storage resolve", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    }
  });

  it("parseImageStorageMode defaults to storage", () => {
    expect(parseImageStorageMode(null)).toBe("storage");
    expect(parseImageStorageMode(undefined)).toBe("storage");
    expect(parseImageStorageMode("invalid")).toBe("storage");
  });

  it("parseImageStorageMode accepts storage", () => {
    expect(parseImageStorageMode("storage")).toBe("storage");
  });

  it("resolveCanonicalBackend returns local backend", () => {
    const backend = resolveCanonicalBackend(process.cwd(), "local");
    expect(backend).toBeDefined();
    expect(typeof backend.listCanonical).toBe("function");
  });

  it("resolveCanonicalBackend throws when storage token missing", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(() => resolveCanonicalBackend(process.cwd(), "storage")).toThrow(
      StorageConnectionError,
    );
    try {
      resolveCanonicalBackend(process.cwd(), "storage");
    } catch (error) {
      expect(error).toBeInstanceOf(StorageConnectionError);
      expect((error as StorageConnectionError).message).toBe(
        STORAGE_CONNECTION_ERROR_MESSAGE,
      );
      expect((error as StorageConnectionError).statusCode).toBe(503);
    }
  });

  it("resolveCanonicalBackend returns blob backend when token set", () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const backend = resolveCanonicalBackend(process.cwd(), "storage");
    expect(backend).toBeDefined();
  });
});
