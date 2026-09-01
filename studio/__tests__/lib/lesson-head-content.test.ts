import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  resolveHeadContent,
  toRepoRelativePath,
} from "@/lib/lesson-head-content";

describe("toRepoRelativePath", () => {
  const lessonMd = "contents/Series/Course/Lesson/contents.md";

  it("returns path unchanged when project root is repo root", () => {
    const root = path.resolve("/repo/dx-training-studio");
    expect(toRepoRelativePath(root, root, lessonMd)).toBe(lessonMd);
  });

  it("prefixes project directory in monorepo", () => {
    const repo = path.resolve("/repo");
    const project = path.resolve("/repo/dx-training-studio");
    expect(toRepoRelativePath(project, repo, lessonMd)).toBe(
      `dx-training-studio/${lessonMd}`,
    );
  });
});

describe("resolveHeadContent integration", () => {
  it("resolves git-md for course names containing spaces", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-head-content-"));
    try {
      execFileSync("git", ["init"], { cwd: root, stdio: "pipe" });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root, stdio: "pipe" });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: root, stdio: "pipe" });

      const rel = "contents/はじめにシリーズ/DX piyopiyo コース/トレーニングの進め方/contents.md";
      const absolute = path.join(root, rel);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, "# training\n", "utf-8");
      execFileSync("git", ["add", "."], { cwd: root, stdio: "pipe" });
      execFileSync("git", ["commit", "-m", "init"], { cwd: root, stdio: "pipe" });

      const result = resolveHeadContent(
        root,
        "はじめにシリーズ",
        "DX piyopiyo コース",
        "トレーニングの進め方",
      );
      if ("error" in result) {
        expect.fail(`git error: ${result.error}`);
      }
      expect(result.headSource).toBe("git-md");
      expect(result.content.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("HEAD に md が無いレッスンは空を返す（新規レッスン）", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-head-content-"));
    try {
      execFileSync("git", ["init"], { cwd: root, stdio: "pipe" });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root, stdio: "pipe" });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: root, stdio: "pipe" });
      fs.writeFileSync(path.join(root, "README.md"), "init\n", "utf-8");
      execFileSync("git", ["add", "."], { cwd: root, stdio: "pipe" });
      execFileSync("git", ["commit", "-m", "init"], { cwd: root, stdio: "pipe" });

      const result = resolveHeadContent(root, "S", "C", "新規レッスン");
      if ("error" in result) {
        expect.fail(`git error: ${result.error}`);
      }
      expect(result.headSource).toBe("empty");
      expect(result.content).toBe("");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
