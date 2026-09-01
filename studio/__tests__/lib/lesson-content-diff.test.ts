import { describe, expect, it } from "vitest";
import { createLessonContentDiff } from "@/lib/lesson-content-diff";

describe("createLessonContentDiff", () => {
  it("returns empty patch when contents match", () => {
    const content = "---\nlesson: A\n---\n\nbody";
    const diff = createLessonContentDiff("src/A/B/C.md", content, content);
    expect(diff.trim()).toBe("");
  });

  it("includes added lines for new content against empty head", () => {
    const diff = createLessonContentDiff("src/A/B/C.md", "", "line one\n");
    expect(diff).toContain("+line one");
  });

  it("includes frontmatter changes", () => {
    const head = "---\nstatus: open\n---\n";
    const current = "---\nstatus: done\n---\n";
    const diff = createLessonContentDiff("src/A/B/C.md", head, current);
    expect(diff).toMatch(/-status: open/);
    expect(diff).toMatch(/\+status: done/);
  });
});
