import fs from "node:fs";
import path from "node:path";
import { execFileSync, execSync } from "child_process";
import { createLessonContentDiff } from "@/lib/lesson-content-diff";
import { toRepoRelativePath, type HeadSource } from "@/lib/lesson-head-content";
import { resolveLessonMdPath } from "@/lib/lesson-md-path";

export type LessonGitDiffResult = {
  diff: string;
  headSource: HeadSource;
  path: string;
};

export type LessonGitDiffError = {
  error: string;
};

function getGitRepoRoot(projectRoot: string): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

/** 日本語パスの octal エスケープ（core.quotepath）を避ける */
const GIT_UTF8_CONFIG = [
  "-c",
  "core.quotepath=false",
  "-c",
  "i18n.logOutputEncoding=utf-8",
] as const;

function gitDiffHead(repoRoot: string, pathFromRepoRoot: string): string {
  try {
    return execFileSync(
      "git",
      [...GIT_UTF8_CONFIG, "diff", "HEAD", "--", pathFromRepoRoot],
      {
        cwd: repoRoot,
        encoding: "utf-8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  } catch {
    return "";
  }
}

function gitShowHead(repoRoot: string, pathFromRepoRoot: string): string | null {
  try {
    return execFileSync("git", ["show", `HEAD:${pathFromRepoRoot}`], {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

function readWorkingTreeFile(
  projectRoot: string,
  mdRelativePath: string,
): string | null {
  const absolute = path.join(projectRoot, mdRelativePath);
  try {
    if (!fs.existsSync(absolute)) return null;
    return fs.readFileSync(absolute, "utf-8");
  } catch {
    return null;
  }
}

/**
 * CLI の `git diff HEAD -- <path>` と同じ基準でレッスン .md の差分を返す。
 * ワーキングツリー上のファイル vs HEAD のみを比較し、エディタ buffer は使わない。
 */
export function resolveLessonGitDiff(
  projectRoot: string,
  series: string,
  course: string,
  lesson: string,
  language: "ja" | "en" = "ja",
): LessonGitDiffResult | LessonGitDiffError {
  const mdPath = resolveLessonMdPath(series, course, lesson, language);
  const repoRoot = getGitRepoRoot(projectRoot);

  if (!repoRoot) {
    return { error: "git リポジトリが見つかりません" };
  }

  const mdRepoPath = toRepoRelativePath(projectRoot, repoRoot, mdPath);
  const diff = gitDiffHead(repoRoot, mdRepoPath);

  if (diff.trim() !== "") {
    return { diff, headSource: "git-md", path: mdPath };
  }

  const headContent = gitShowHead(repoRoot, mdRepoPath);
  if (headContent !== null) {
    return { diff: "", headSource: "git-md", path: mdPath };
  }

  const disk = readWorkingTreeFile(projectRoot, mdPath);
  if (!disk) {
    return { diff: "", headSource: "empty", path: mdPath };
  }

  return {
    diff: createLessonContentDiff(mdPath, "", disk),
    headSource: "empty",
    path: mdPath,
  };
}
