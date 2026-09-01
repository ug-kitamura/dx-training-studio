import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCanonicalCache } from "@/lib/image-storage/canonical-cache";

const uploadedAt = new Date("2026-08-01T00:00:00.000Z");

/** put されたものが以後の list に現れる、簡易なインメモリ blob ストア */
const stored = new Map<string, number>();

const listMock = vi.fn(async () => ({
  blobs: [...stored.entries()].map(([pathname, size]) => ({
    pathname,
    size,
    uploadedAt,
  })),
}));
const putMock = vi.fn(async (pathname: string, data: Buffer) => {
  stored.set(pathname, data.length);
  return { pathname };
});

vi.mock("@vercel/blob", () => ({
  list: (...args: unknown[]) => listMock(...(args as [])),
  put: (...args: unknown[]) => putMock(...(args as [string, Buffer])),
  head: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
}));

const { POST } = await import("@/app/api/images/promote/route");
const { GET: listRoute } = await import("@/app/api/images/list/route");

async function usedPaths(): Promise<string[]> {
  const res = await listRoute(
    new Request("http://localhost/api/images/list?scope=used&storageMode=storage"),
  );
  const json = (await res.json()) as { files: Array<{ path: string }> };
  return json.files.map((f) => f.path);
}

describe("promote は正本一覧キャッシュを無効化する", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  let tmpDir: string;
  let prevCwd: string;

  beforeEach(async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    stored.clear();
    resetCanonicalCache();
    listMock.mockClear();
    putMock.mockClear();

    prevCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dx-promote-cache-"));
    const stagingDir = path.join(tmpDir, "images", "ai");
    await fs.mkdir(stagingDir, { recursive: true });
    await fs.writeFile(path.join(stagingDir, "new.png"), Buffer.from("png-bytes"));
    // getProjectRoot() は cwd の親を返す
    const appDir = path.join(tmpDir, "studio");
    await fs.mkdir(appDir, { recursive: true });
    process.chdir(appDir);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  });

  it("promote 直後の一覧に、TTL 残に関わらず新しい画像が現れる", async () => {
    // キャッシュを温める（この時点では空）
    expect(await usedPaths()).toEqual([]);

    const res = await POST(
      new Request("http://localhost/api/images/promote", {
        method: "POST",
        body: JSON.stringify({
          stagingPath: "images/ai/new.png",
          storageMode: "storage",
        }),
      }),
    );
    expect(res.status).toBe(200);

    expect(await usedPaths()).toEqual(["images/new.png"]);
  });
});
