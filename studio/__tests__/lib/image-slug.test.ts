import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolveUniquePngFileName,
  resolveUniqueWebFileName,
  sanitizeImageSlug,
} from "@/lib/image-slug";

describe("image-slug", () => {
  it("sanitizes slug", () => {
    expect(sanitizeImageSlug("Git Push Flow!!!")).toBe("git-push-flow");
    expect(sanitizeImageSlug("")).toBe("diagram");
  });

  describe("resolveUniquePngFileName", () => {
    let tmpDir: string;

    afterEach(async () => {
      if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it("uses base name when free", async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dx-slug-"));
      await fs.mkdir(path.join(tmpDir, "images"), { recursive: true });
      const name = await resolveUniquePngFileName(tmpDir, "git-flow");
      expect(name).toBe("git-flow.png");
    });

    it("appends -2 when taken", async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dx-slug-"));
      const images = path.join(tmpDir, "images");
      await fs.mkdir(path.join(images, "ai"), { recursive: true });
      await fs.writeFile(path.join(images, "git-flow.png"), "x");
      const name = await resolveUniquePngFileName(tmpDir, "git-flow");
      expect(name).toBe("git-flow-2.png");
    });
  });

  describe("resolveUniqueWebFileName", () => {
    let tmpDir: string;

    afterEach(async () => {
      if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it("uses web id with extension", async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dx-slug-"));
      await fs.mkdir(path.join(tmpDir, "images", "web"), { recursive: true });
      const name = await resolveUniqueWebFileName(tmpDir, 12345, ".jpg");
      expect(name).toBe("web-12345.jpg");
    });
  });
});
