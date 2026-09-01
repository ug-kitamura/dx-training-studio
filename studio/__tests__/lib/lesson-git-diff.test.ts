import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "child_process";
import { afterEach, describe, expect, it } from "vitest";
import { resolveLessonGitDiff } from "@/lib/lesson-git-diff";

describe("resolveLessonGitDiff", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  function initGitRepo(root: string): void {
    execFileSync("git", ["init"], { cwd: root, stdio: "pipe" });
    execFileSync("git", ["config", "user.email", "test@example.com"], {
      cwd: root,
      stdio: "pipe",
    });
    execFileSync("git", ["config", "user.name", "Test"], {
      cwd: root,
      stdio: "pipe",
    });
  }

  function tempGitRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-git-diff-"));
    roots.push(root);
    initGitRepo(root);
    return root;
  }

  it("returns empty diff when working tree matches HEAD", () => {
    const root = tempGitRoot();
    const rel = "contents/Series/Course/Lesson/contents.md";
    const absolute = path.join(root, rel);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "---\nlesson: Lesson\n---\n\nbody\n", "utf-8");
    execFileSync("git", ["add", "."], { cwd: root, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "init"], { cwd: root, stdio: "pipe" });

    const result = resolveLessonGitDiff(root, "Series", "Course", "Lesson");
    if ("error" in result) {
      expect.fail(result.error);
    }
    expect(result.diff.trim()).toBe("");
    expect(result.headSource).toBe("git-md");
  });

  it("returns git diff output when file is modified on disk", () => {
    const root = tempGitRoot();
    const rel = "contents/Series/Course/Lesson/contents.md";
    const absolute = path.join(root, rel);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "before\n", "utf-8");
    execFileSync("git", ["add", "."], { cwd: root, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "init"], { cwd: root, stdio: "pipe" });
    fs.writeFileSync(absolute, "after\n", "utf-8");

    const result = resolveLessonGitDiff(root, "Series", "Course", "Lesson");
    if ("error" in result) {
      expect.fail(result.error);
    }
    expect(result.diff).toContain("-before");
    expect(result.diff).toContain("+after");
  });

  it("returns full addition diff for untracked new file", () => {
    const root = tempGitRoot();
    const rel = "contents/Series/Course/New/contents.md";
    const absolute = path.join(root, rel);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "new lesson\n", "utf-8");

    const result = resolveLessonGitDiff(root, "Series", "Course", "New");
    if ("error" in result) {
      expect.fail(result.error);
    }
    expect(result.headSource).toBe("empty");
    expect(result.diff).toContain("+new lesson");
  });

  it("handles course names containing spaces without quotepath escapes", () => {
    const root = tempGitRoot();
    const rel =
      "contents/はじめにシリーズ/DX piyopiyo コース/トレーニングの進め方/contents.md";
    const absolute = path.join(root, rel);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "# training\n", "utf-8");
    execFileSync("git", ["add", "."], { cwd: root, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "init"], { cwd: root, stdio: "pipe" });

    const result = resolveLessonGitDiff(
      root,
      "はじめにシリーズ",
      "DX piyopiyo コース",
      "トレーニングの進め方",
    );
    if ("error" in result) {
      expect.fail(result.error);
    }
    expect(result.headSource).toBe("git-md");
    expect(result.path).toContain("はじめにシリーズ");
    expect(result.diff).not.toMatch(/\\343\\201/);
    if (result.diff.trim() !== "") {
      expect(result.diff).toContain("はじめにシリーズ");
    }
  });
});
