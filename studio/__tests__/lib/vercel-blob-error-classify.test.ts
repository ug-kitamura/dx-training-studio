import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  StorageBlockedError,
  StorageReadError,
} from "@/lib/image-storage/types";

const uploadedAt = new Date("2026-08-01T00:00:00.000Z");
const blobUrl = "https://store.private.blob.vercel-storage.com/images/a.png";

const getMock = vi.fn();
const headMock = vi.fn(async () => ({ url: blobUrl, size: 1, uploadedAt }));
const listMock = vi.fn(async () => ({ blobs: [] }));

vi.mock("@vercel/blob", () => ({
  get: (...args: unknown[]) => getMock(...(args as [])),
  head: (...args: unknown[]) => headMock(...(args as [])),
  list: (...args: unknown[]) => listMock(...(args as [])),
  put: vi.fn(),
  del: vi.fn(),
}));

const { createVercelBlobCanonicalBackend } = await import(
  "@/lib/image-storage/vercel-blob"
);

const backend = createVercelBlobCanonicalBackend("test-token");
const originalFetch = global.fetch;

describe("Blob 読み出し失敗の分類", () => {
  beforeEach(() => {
    getMock.mockReset();
    headMock.mockClear();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("SDK が null を返す（404）＝実体なしとして null を返す", async () => {
    getMock.mockResolvedValue(null);
    await expect(backend.readCanonical("images/a.png")).resolves.toBeNull();
  });

  it("403 かつ本文が Your store is blocked → StorageBlockedError", async () => {
    getMock.mockRejectedValue(new Error("Failed to fetch blob: 403 Forbidden"));
    global.fetch = vi.fn(async () => new Response("Your store is blocked")) as never;

    await expect(backend.readCanonical("images/a.png")).rejects.toBeInstanceOf(
      StorageBlockedError,
    );
  });

  it("403 でも本文がブロック文言でなければ StorageReadError", async () => {
    getMock.mockRejectedValue(new Error("Failed to fetch blob: 403 Forbidden"));
    global.fetch = vi.fn(async () => new Response("Forbidden")) as never;

    await expect(backend.readCanonical("images/a.png")).rejects.toBeInstanceOf(
      StorageReadError,
    );
  });

  it("判別用の fetch 自体が失敗しても StorageReadError へ落ちる（フェイルセーフ）", async () => {
    getMock.mockRejectedValue(new Error("Failed to fetch blob: 403 Forbidden"));
    global.fetch = vi.fn(async () => {
      throw new Error("network");
    }) as never;

    await expect(backend.readCanonical("images/a.png")).rejects.toBeInstanceOf(
      StorageReadError,
    );
  });

  it("403 以外の失敗は StorageReadError（判別 fetch を撃たない）", async () => {
    getMock.mockRejectedValue(new Error("Failed to fetch blob: 500 Server Error"));
    const fetchMock = vi.fn();
    global.fetch = fetchMock as never;

    await expect(backend.readCanonical("images/a.png")).rejects.toBeInstanceOf(
      StorageReadError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("失敗を null に潰さない（実体なしと読み出し失敗を混同しない）", async () => {
    getMock.mockRejectedValue(new Error("Failed to fetch blob: 500 Server Error"));
    await expect(backend.readCanonical("images/a.png")).rejects.toBeTruthy();
  });

  it("list の失敗も StorageReadError にする", async () => {
    listMock.mockRejectedValueOnce(new Error("boom"));
    await expect(backend.listCanonical()).rejects.toBeInstanceOf(StorageReadError);
  });
});
