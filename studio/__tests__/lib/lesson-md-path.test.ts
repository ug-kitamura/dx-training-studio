import { describe, expect, it } from "vitest";
import { resolveLessonMdPath } from "@/lib/lesson-md-path";

describe("resolveLessonMdPath", () => {
  it("returns fallback contents/ path when file does not exist", () => {
    expect(
      resolveLessonMdPath("Gitシリーズ", "環境構築", "インストール手順"),
    ).toBe("contents/Gitシリーズ/環境構築/インストール手順/contents.md");
  });
});
