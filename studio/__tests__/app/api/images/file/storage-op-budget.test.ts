import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatImageFileEtag } from "@/lib/image-file-response";
import { resetCanonicalCache } from "@/lib/image-storage/canonical-cache";

const uploadedAt = new Date("2026-08-01T00:00:00.000Z");
const blobSize = 9;

const listMock = vi.fn(async () => ({
  blobs: [{ pathname: "images/a.png", size: blobSize, uploadedAt }],
}));
const headMock = vi.fn(async () => ({ size: blobSize, uploadedAt }));
const getMock = vi.fn(async () => ({
  statusCode: 200,
  stream: new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(Buffer.from("png-bytes")));
      controller.close();
    },
  }),
}));

vi.mock("@vercel/blob", () => ({
  list: (...args: unknown[]) => listMock(...(args as [])),
  head: (...args: unknown[]) => headMock(...(args as [])),
  get: (...args: unknown[]) => getMock(...(args as [])),
  put: vi.fn(),
  del: vi.fn(),
}));

const { GET } = await import("@/app/api/images/file/route");

const etag = formatImageFileEtag(uploadedAt.getTime(), blobSize);
const url = "http://localhost/api/images/file?path=images/a.png&storageMode=storage";

describe("GET /api/images/file（storage）の操作数", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    resetCanonicalCache();
    listMock.mockClear();
    headMock.mockClear();
    getMock.mockClear();
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  });

  it("ETag は一覧のメタデータから作り、head() を発行しない", async () => {
    const res = await GET(new Request(url));

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe(etag);
    expect(headMock).not.toHaveBeenCalled();
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("304 応答はバックエンド操作ゼロで返る", async () => {
    // 1 回目でキャッシュを温める
    await GET(new Request(url));
    listMock.mockClear();
    getMock.mockClear();

    const res = await GET(
      new Request(url, { headers: { "If-None-Match": etag } }),
    );

    expect(res.status).toBe(304);
    expect(listMock).not.toHaveBeenCalled();
    expect(headMock).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("サムネイル多数でも list は 1 回だけ（TTL 内）", async () => {
    for (let i = 0; i < 20; i += 1) {
      await GET(new Request(url, { headers: { "If-None-Match": etag } }));
    }

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(headMock).not.toHaveBeenCalled();
  });

  it("一覧に無いパスは head() にフォールバックする", async () => {
    const res = await GET(
      new Request(
        "http://localhost/api/images/file?path=images/unknown.png&storageMode=storage",
      ),
    );

    expect(headMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
