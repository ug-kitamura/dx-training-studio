import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  extractAttachmentTokens,
  isAllowedAttachmentPath,
  isAllowedContentMdPath,
  listContentMarkdownFiles,
  listPlanFiles,
  listRecentRunFiles,
  orderContentFilesForPicker,
  readAttachmentContents,
  resolveAllowedContentPath,
} from "@/lib/agent/file-attachments";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

describe("file-attachments", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-attachments-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("extracts @path tokens from message text", () => {
    const tokens = extractAttachmentTokens(
      "Please review @contents/series/course/lesson/contents.md and improve it.",
    );
    expect(tokens).toEqual(["contents/series/course/lesson/contents.md"]);
  });

  it("rejects path traversal", () => {
    expect(isAllowedContentMdPath("contents/../secret/contents.md")).toBe(false);
    const resolved = resolveAllowedContentPath(tmpDir, "contents/../secret/contents.md");
    expect(resolved).toEqual({ error: "許可されていないパスです: contents/../secret/contents.md" });
  });

  it("rejects paths outside contents/", () => {
    expect(isAllowedContentMdPath(".claude/skills/create-draft/SKILL.md")).toBe(false);
    const resolved = resolveAllowedContentPath(
      tmpDir,
      ".claude/skills/create-draft/SKILL.md",
    );
    expect("error" in resolved).toBe(true);
    if ("error" in resolved) {
      expect(resolved.error).toContain("許可されていないパス");
    }
  });

  it("reads allowed markdown files", () => {
    const relative = "contents/series/course/lesson/contents.md";
    writeFile(path.join(tmpDir, relative), "# Lesson");
    const result = readAttachmentContents(tmpDir, relative);
    expect(result).toEqual({ path: relative, content: "# Lesson" });
  });

  it("lists all contents.md files under contents/", () => {
    writeFile(path.join(tmpDir, "contents/b/second", LESSON_CONTENTS_FILENAME), "# B");
    writeFile(path.join(tmpDir, "contents/a/first", LESSON_CONTENTS_FILENAME), "# A");
    const files = listContentMarkdownFiles(tmpDir);
    expect(files.map((file) => file.path)).toEqual([
      "contents/a/first/contents.md",
      "contents/b/second/contents.md",
    ]);
    expect(files.map((file) => file.name)).toEqual(["first", "second"]);
  });

  it("extracts @contents-work tokens too", () => {
    const tokens = extractAttachmentTokens(
      "@contents-work/plans/20260811-onenote.md と @contents-work/runs/20260811-x/design-note.md を見て",
    );
    expect(tokens).toEqual([
      "contents-work/plans/20260811-onenote.md",
      "contents-work/runs/20260811-x/design-note.md",
    ]);
  });

  it("allows the plan tree but not other repo paths", () => {
    expect(isAllowedAttachmentPath("contents-work/plans/a.md")).toBe(true);
    expect(
      isAllowedAttachmentPath("contents-work/runs/20260811-x/note.md"),
    ).toBe(true);
    expect(isAllowedAttachmentPath("contents-work/other/a.md")).toBe(false);
    expect(isAllowedAttachmentPath("docs/handoff.md")).toBe(false);
    expect(isAllowedAttachmentPath("contents/a/b/c/draft.md")).toBe(false);
  });

  it("reads plan tree files", () => {
    const relative = "contents-work/plans/20260811-onenote.md";
    writeFile(path.join(tmpDir, relative), "# Plan");
    expect(readAttachmentContents(tmpDir, relative)).toEqual({
      path: relative,
      content: "# Plan",
    });
  });

  it("lists plan files", () => {
    writeFile(path.join(tmpDir, "contents-work/plans/b.md"), "b");
    writeFile(path.join(tmpDir, "contents-work/plans/a.md"), "a");
    expect(listPlanFiles(tmpDir).map((f) => f.path)).toEqual([
      "contents-work/plans/a.md",
      "contents-work/plans/b.md",
    ]);
  });

  it("lists only the newest run directories, by mtime", () => {
    const runs = ["old", "mid", "new", "newest"];
    runs.forEach((name, index) => {
      const dir = path.join(tmpDir, "contents-work/runs", name);
      writeFile(path.join(dir, "design-note.md"), name);
      const stamp = new Date(2026, 0, 1 + index);
      fs.utimesSync(dir, stamp, stamp);
    });
    const files = listRecentRunFiles(tmpDir, 3).map((f) => f.path);
    expect(files).toHaveLength(3);
    expect(files.some((p) => p.includes("/old/"))).toBe(false);
    expect(files.some((p) => p.includes("/newest/"))).toBe(true);
  });

  it("puts current lesson first and keeps path order for the rest", () => {
    const files = [
      { path: "contents/a/one/contents.md", name: "one" },
      { path: "contents/b/two/contents.md", name: "two" },
      { path: "contents/c/three/contents.md", name: "three" },
    ];
    expect(orderContentFilesForPicker(files, "contents/b/two/contents.md")).toEqual([
      { path: "contents/b/two/contents.md", name: "two" },
      { path: "contents/a/one/contents.md", name: "one" },
      { path: "contents/c/three/contents.md", name: "three" },
    ]);
  });
});
