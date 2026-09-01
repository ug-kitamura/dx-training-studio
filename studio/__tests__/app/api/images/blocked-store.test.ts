import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCanonicalCache } from "@/lib/image-storage/canonical-cache";

const uploadedAt = new Date("2026-08-01T00:00:00.000Z");
const blobUrl = "https://store.private.blob.vercel-storage.com/images/a.png";

/** コントロールプレーン（list / head）は生きているが、データプレーンがブロック中の状態 */
const listMock = vi.fn(async () => ({
  blobs: [{ pathname: "images/a.png", size: 9, uploadedAt }],
}));
const getMock = vi.fn(async () => {
  throw new Error("Failed to fetch blob: 403 Forbidden");
});
const headMock = vi.fn(async () => ({ url: blobUrl, size: 9, uploadedAt }));

vi.mock("@vercel/blob", () => ({
  list: (...args: unknown[]) => listMock(...(args as [])),
  get: (...args: unknown[]) => getMock(...(args as [])),
  head: (...args: unknown[]) => headMock(...(args as [])),
  put: vi.fn(),
  del: vi.fn(),
}));

const { GET: fileRoute } = await import("@/app/api/images/file/route");
const { GET: listRoute } = await import("@/app/api/images/list/route");
const { GET: storageCheckRoute } = await import(
  "@/app/api/images/storage-check/route"
);

describe("ブロックされたストアの応答", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    resetCanonicalCache();
    listMock.mockClear();
    getMock.mockClear();
    // ブロック判別用の素の fetch
    global.fetch = vi.fn(async () => new Response("Your store is blocked")) as never;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  });

  it("実在する画像を 404「存在しません」にしない", async () => {
    const res = await fileRoute(
      new Request(
        "http://localhost/api/images/file?path=images/a.png&storageMode=storage",
      ),
    );

    expect(res.status).not.toBe(404);
    const json = (await res.json()) as { kind: string; error: string };
    expect(json.kind).toBe("blocked");
    expect(json.error).not.toContain("見つかりません");
  });

  it("一覧はコントロールプレーンなので成功したままにする", async () => {
    const res = await listRoute(
      new Request(
        "http://localhost/api/images/list?scope=used&storageMode=storage",
      ),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { files: unknown[] };
    expect(json.files).toHaveLength(1);
  });

  it("storage-check は一覧が通ってもブロックを検知して失敗する", async () => {
    const res = await storageCheckRoute();

    expect(res.ok).toBe(false);
    const json = (await res.json()) as { kind: string; error: string };
    expect(json.kind).toBe("blocked");
    expect(json.error).toContain("ブロック");
  });
});

describe("実体が無いときは従来どおり 404", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    resetCanonicalCache();
    listMock.mockClear();
    getMock.mockClear();
    headMock.mockClear();
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  });

  it("SDK が null（404）を返すパスは 404 とする", async () => {
    getMock.mockResolvedValueOnce(null as never);

    const res = await fileRoute(
      new Request(
        "http://localhost/api/images/file?path=images/a.png&storageMode=storage",
      ),
    );

    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toContain(
      "見つかりません",
    );
  });
});
