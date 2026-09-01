import { describe, expect, it } from "vitest";
import {
  decodeImageMarkdownSrc,
  isAllowedUploadMime,
  isCanonicalImagePath,
  isMp4Path,
  isSafeImageLogicalPath,
  isStagingImagePath,
  MAX_MP4_BYTES,
  normalizeImageLogicalPath,
  promoteTargetPath,
  resolveImageLogicalPathFromMarkdown,
  resolveToAvailablePath,
  sanitizeUploadFileName,
} from "@/lib/image-path";

describe("isSafeImageLogicalPath", () => {
  it("accepts canonical paths", () => {
    expect(isSafeImageLogicalPath("images/foo.png")).toBe(true);
  });

  it("accepts staging paths", () => {
    expect(isSafeImageLogicalPath("images/uploaded/foo.png")).toBe(true);
    expect(isSafeImageLogicalPath("images/ai/foo.png")).toBe(true);
  });

  it("rejects legacy _staging paths", () => {
    expect(isSafeImageLogicalPath("images/uploaded/_staging/foo.png")).toBe(
      false,
    );
  });

  it("rejects traversal", () => {
    expect(isSafeImageLogicalPath("images/../secret.png")).toBe(false);
  });

  it("rejects paths outside images", () => {
    expect(isSafeImageLogicalPath("data/foo.png")).toBe(false);
  });
});

describe("isCanonicalImagePath", () => {
  it("rejects source-only segment", () => {
    expect(isCanonicalImagePath("images/uploaded")).toBe(false);
  });

  it("accepts mp4 canonical paths", () => {
    expect(isCanonicalImagePath("images/demo.mp4")).toBe(true);
  });
});

describe("isMp4Path", () => {
  it("detects mp4 paths", () => {
    expect(isMp4Path("images/uploaded/demo.mp4")).toBe(true);
    expect(isMp4Path("images/foo.png")).toBe(false);
  });
});

describe("isAllowedUploadMime", () => {
  it("accepts images and mp4", () => {
    expect(isAllowedUploadMime("image/png", "a.png")).toBe(true);
    expect(isAllowedUploadMime("video/mp4", "a.mp4")).toBe(true);
    expect(isAllowedUploadMime("", "a.mp4")).toBe(true);
    expect(isAllowedUploadMime("video/webm", "a.webm")).toBe(false);
  });
});

describe("MAX_MP4_BYTES", () => {
  it("is 3 MB", () => {
    expect(MAX_MP4_BYTES).toBe(3 * 1024 * 1024);
  });
});

describe("promoteTargetPath", () => {
  it("maps staging to canonical path", () => {
    expect(promoteTargetPath("images/uploaded/a.png")).toBe("images/a.png");
    expect(promoteTargetPath("images/ai/a.png")).toBe("images/a.png");
  });

  it("returns null for non-staging", () => {
    expect(promoteTargetPath("images/a.png")).toBeNull();
  });
});

describe("isStagingImagePath", () => {
  it("detects staging paths", () => {
    expect(isStagingImagePath("images/ai/x.webp")).toBe(true);
    expect(isStagingImagePath("images/x.webp")).toBe(false);
  });
});

describe("sanitizeUploadFileName", () => {
  it("uses basename only", () => {
    expect(sanitizeUploadFileName("../../evil.png")).toBe("evil.png");
  });

  it("replaces spaces and semicolons with underscores", () => {
    expect(sanitizeUploadFileName("DX Training Editor; 6月6日 14 31.mp4")).toBe(
      "DX_Training_Editor_6月6日_14_31.mp4",
    );
  });
});

describe("decodeImageMarkdownSrc", () => {
  it("decodes percent-encoded Japanese paths", () => {
    expect(
      decodeImageMarkdownSrc(
        "images/DX_Training_Editor_6%E6%9C%886%E6%97%A5_14_31.mp4",
      ),
    ).toBe("images/DX_Training_Editor_6月6日_14_31.mp4");
  });
});

describe("resolveImageLogicalPathFromMarkdown", () => {
  it("resolves encoded mp4 paths", () => {
    expect(
      resolveImageLogicalPathFromMarkdown(
        "images/DX_Training_Editor_6%E6%9C%886%E6%97%A5_14_31.mp4",
      ),
    ).toBe("images/DX_Training_Editor_6月6日_14_31.mp4");
  });
});

describe("resolveToAvailablePath", () => {
  it("maps unsanitized markdown paths to sanitized files", () => {
    const available = new Set([
      "images/DX_Training_Editor_6月6日_14_31.mp4",
    ]);
    expect(
      resolveToAvailablePath(
        "images/DX Training Editor; 6月6日 14 31.mp4",
        available,
      ),
    ).toBe("images/DX_Training_Editor_6月6日_14_31.mp4");
  });
});

describe("normalizeImageLogicalPath", () => {
  it("normalizes backslashes", () => {
    expect(normalizeImageLogicalPath("images\\foo.png")).toBe("images/foo.png");
  });
});
