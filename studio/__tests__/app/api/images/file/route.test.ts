import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/images/file/route";
import { formatImageFileEtag } from "@/lib/image-file-response";

describe("GET /api/images/file", () => {
  let tmpDir: string;
  let prevCwd: string;

  afterEach(async () => {
    process.chdir(prevCwd);
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns ETag and 304 for unchanged staging file", async () => {
    prevCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dx-img-file-"));
    const stagingDir = path.join(tmpDir, "images", "ai");
    await fs.mkdir(stagingDir, { recursive: true });
    const filePath = path.join(stagingDir, "test.png");
    await fs.writeFile(filePath, Buffer.from("png-bytes"));

    // getProjectRoot() は cwd の親を返すため、アプリ相当の studio/ サブディレクトリへ入る
    const appDir = path.join(tmpDir, "studio");
    await fs.mkdir(appDir, { recursive: true });
    process.chdir(appDir);

    const logicalPath = "images/ai/test.png";
    const stat = await fs.stat(filePath);
    const etag = formatImageFileEtag(stat.mtimeMs, stat.size);

    const first = await GET(
      new Request(`http://localhost/api/images/file?path=${logicalPath}`),
    );
    expect(first.status).toBe(200);
    expect(first.headers.get("ETag")).toBe(etag);

    const second = await GET(
      new Request(`http://localhost/api/images/file?path=${logicalPath}`, {
        headers: { "If-None-Match": etag },
      }),
    );
    expect(second.status).toBe(304);
    expect(second.headers.get("ETag")).toBe(etag);
  });
});
