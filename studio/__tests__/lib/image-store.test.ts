import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  moveImageToTrash,
  promoteStagingImage,
  resolveAbsoluteImagePath,
  saveStagingImage,
} from "@/lib/image-store";

describe("image-store", () => {
  let tmpRoot: string | null = null;

  afterEach(async () => {
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
      tmpRoot = null;
    }
  });

  it("rejects path traversal", () => {
    expect(
      resolveAbsoluteImagePath(os.tmpdir(), "images/uploaded/../package.json"),
    ).toBeNull();
  });

  it("promote copies staging without removing source", async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "img-store-"));
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const staging = await saveStagingImage(tmpRoot, "uploaded", "test.png", png);
    const promoted = await promoteStagingImage(tmpRoot, staging.path);

    expect(promoted.path).toBe("images/test.png");
    await expect(
      fs.access(resolveAbsoluteImagePath(tmpRoot, staging.path)!),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(resolveAbsoluteImagePath(tmpRoot, promoted.path)!),
    ).resolves.toBeUndefined();
  });

  it("moveImageToTrash moves canonical and staging files", async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "img-store-"));
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const staging = await saveStagingImage(tmpRoot, "ai", "trash-me.png", png);
    await moveImageToTrash(tmpRoot, staging.path);

    const trashAbsolute = path.join(tmpRoot, "images", "trash", "trash-me.png");
    await expect(fs.access(trashAbsolute)).resolves.toBeUndefined();
    await expect(
      fs.access(resolveAbsoluteImagePath(tmpRoot, staging.path)!),
    ).rejects.toThrow();
  });
});
