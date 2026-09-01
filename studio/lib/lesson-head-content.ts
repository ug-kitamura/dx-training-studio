import { execFileSync, execSync } from "child_process";
import path from "node:path";
import { resolveLessonMdPath } from "@/lib/lesson-md-path";

export type HeadSource = "git-md" | "empty";

export type ResolvedHeadContent = {
  content: string;
  headSource: HeadSource;
  path: string;
};

export type ResolveHeadError = {
  error: string;
};

/** git リポジトリ root からの相対パス（モノレポでは `dx-training-studio/...`） */
export function toRepoRelativePath(
  projectRoot: string,
  repoRoot: string,
  relativePath: string,
): string {
  const projectRel = path.relative(repoRoot, projectRoot).replace(/\\/g, "/");
  if (projectRel === "" || projectRel === ".") return relativePath;
  return `${projectRel}/${relativePath}`;
}

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

/**
 * レッスン .md の HEAD 上の正本を返す。
 * HEAD に無ければ空文字列（新規レッスン）——中間のフォールバックは持たない。
 */
export function resolveHeadContent(
  projectRoot: string,
  series: string,
  course: string,
  lesson: string,
): ResolvedHeadContent | ResolveHeadError {
  const mdPath = resolveLessonMdPath(series, course, lesson);
  const repoRoot = getGitRepoRoot(projectRoot);

  if (!repoRoot) {
    return { error: "git リポジトリが見つかりません" };
  }

  const mdRepoPath = toRepoRelativePath(projectRoot, repoRoot, mdPath);
  const mdContent = gitShowHead(repoRoot, mdRepoPath);
  if (mdContent !== null) {
    return {
      content: mdContent,
      headSource: "git-md",
      path: mdPath,
    };
  }

  // HEAD に md が無いのは新規レッスン。全行が追加として表示される
  return {
    content: "",
    headSource: "empty",
    path: mdPath,
  };
}
