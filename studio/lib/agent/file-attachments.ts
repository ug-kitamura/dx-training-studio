import fs from "node:fs";
import path from "node:path";
import { CONTENTS_DIR_NAME, getContentsDir } from "@/lib/contents-loader";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";

export const ALLOWED_PREFIX = `${CONTENTS_DIR_NAME}/`;

/** 作業ツリー（計画書・run）。書込契約の 2 ルート目 */
export const CONTENTS_PLAN_DIR_NAME = "contents-work";
export const PLANS_PREFIX = `${CONTENTS_PLAN_DIR_NAME}/plans/`;
export const RUNS_PREFIX = `${CONTENTS_PLAN_DIR_NAME}/runs/`;

/** ピッカーに並べる run ディレクトリの数（更新日時の新しい順） */
export const RECENT_RUN_LIMIT = 3;

const ATTACHMENT_TOKEN_RE = /@((?:contents|contents-work)\/[^\s@]+)/g;

export type ContentFileRef = {
  path: string;
  name: string;
};

export function extractAttachmentTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const match of text.matchAll(ATTACHMENT_TOKEN_RE)) {
    tokens.add(match[1]);
  }
  return [...tokens];
}

/**
 * @ 参照できるパスは 3 種。
 * - 正本ツリーのレッスン本文（`contents/**\/contents.md`）
 * - 計画置き場（`contents-work/plans/...`）
 * - run ディレクトリ（`contents-work/runs/...`）
 *
 * ピッカーに並ぶ run は最新 3 件だけだが、読取は run 全体を許す。
 * 一覧は更新日時で変わるため、過去に貼った参照が時間経過で読めなくなるのを避ける。
 */
export function isAllowedAttachmentPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("..")) return false;
  if (normalized.startsWith(PLANS_PREFIX) || normalized.startsWith(RUNS_PREFIX)) {
    return normalized.split("/").every((part) => part.length > 0);
  }
  return isAllowedContentMdPath(normalized);
}

export function isAllowedContentMdPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!normalized.startsWith(ALLOWED_PREFIX)) return false;
  if (!normalized.endsWith(`/${LESSON_CONTENTS_FILENAME}`)) return false;
  if (normalized.includes("..")) return false;
  return true;
}

export function resolveAllowedContentPath(
  projectRoot: string,
  relativePath: string,
): { absolutePath: string; relativePath: string } | { error: string } {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!isAllowedAttachmentPath(normalized)) {
    return { error: `許可されていないパスです: ${relativePath}` };
  }

  const absolutePath = path.resolve(projectRoot, normalized);
  const rootDir = normalized.startsWith(ALLOWED_PREFIX)
    ? path.resolve(getContentsDir(projectRoot))
    : path.resolve(projectRoot, CONTENTS_PLAN_DIR_NAME);
  if (
    !absolutePath.startsWith(rootDir + path.sep) &&
    absolutePath !== rootDir
  ) {
    return { error: `許可されていないパスです: ${relativePath}` };
  }
  if (!fs.existsSync(absolutePath)) {
    return { error: `ファイルが見つかりません: ${relativePath}` };
  }

  return {
    absolutePath,
    relativePath: path.relative(projectRoot, absolutePath).replace(/\\/g, "/"),
  };
}

export function readAttachmentContents(
  projectRoot: string,
  relativePath: string,
): { path: string; content: string } | { error: string } {
  const resolved = resolveAllowedContentPath(projectRoot, relativePath);
  if ("error" in resolved) return resolved;
  const content = fs.readFileSync(resolved.absolutePath, "utf-8");
  return { path: resolved.relativePath, content };
}

export function resolveAttachmentsForMessage(
  projectRoot: string,
  message: string,
  structuredPaths?: ReadonlyArray<string>,
):
  | { attachments: Array<{ path: string; content: string }> }
  | { error: string } {
  const paths =
    structuredPaths && structuredPaths.length > 0
      ? [...new Set(structuredPaths.map((p) => p.replace(/\\/g, "/")))]
      : extractAttachmentTokens(message);
  const attachments: Array<{ path: string; content: string }> = [];
  for (const relativePath of paths) {
    const result = readAttachmentContents(projectRoot, relativePath);
    if ("error" in result) return { error: result.error };
    attachments.push(result);
  }
  return { attachments };
}

export function enrichUserMessageWithAttachments(
  message: string,
  attachments: Array<{ path: string; content: string }>,
): string {
  if (attachments.length === 0) return message;
  const blocks = attachments.map(
    (file) => `--- File: ${file.path} ---\n${file.content}\n--- End File ---`,
  );
  return `${message}\n\n${blocks.join("\n\n")}`;
}

export function listContentMarkdownFiles(projectRoot: string): ContentFileRef[] {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return [];

  const results: ContentFileRef[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile() || entry.name !== LESSON_CONTENTS_FILENAME) continue;
      const relativePath = path.relative(projectRoot, absolute).replace(/\\/g, "/");
      if (!isAllowedContentMdPath(relativePath)) continue;
      const lessonName = path.basename(path.dirname(relativePath));
      results.push({ path: relativePath, name: lessonName });
    }
  }

  walk(contentsDir);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

function listFilesUnder(
  projectRoot: string,
  absoluteDir: string,
): ContentFileRef[] {
  if (!fs.existsSync(absoluteDir)) return [];
  const results: ContentFileRef[] = [];
  const stack = [absoluteDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      results.push({
        path: path.relative(projectRoot, absolute).replace(/\\/g, "/"),
        name: entry.name,
      });
    }
  }
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

/** 計画置き場のファイル */
export function listPlanFiles(projectRoot: string): ContentFileRef[] {
  return listFilesUnder(
    projectRoot,
    path.join(projectRoot, CONTENTS_PLAN_DIR_NAME, "plans"),
  );
}

/** 更新日時の新しい run ディレクトリ上位 `limit` 件のファイル */
export function listRecentRunFiles(
  projectRoot: string,
  limit = RECENT_RUN_LIMIT,
): ContentFileRef[] {
  const runsDir = path.join(projectRoot, CONTENTS_PLAN_DIR_NAME, "runs");
  if (!fs.existsSync(runsDir)) return [];

  const runDirs = fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => {
      const absolute = path.join(runsDir, entry.name);
      return { absolute, mtimeMs: fs.statSync(absolute).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit);

  return runDirs.flatMap((run) => listFilesUnder(projectRoot, run.absolute));
}

/**
 * @ 参照ピッカーの並び。
 *
 * `currentPath`（ペイン3 で開いているレッスン本文）は、**レッスンにフォーカス
 * している場合だけ**先頭に置く。コース・シリーズにフォーカスしているときは
 * 開いているファイルが作業対象とは限らないため、先頭固定はかえって外れる。
 */
export function orderContentFilesForPicker(
  files: ContentFileRef[],
  currentPath?: string | null,
): ContentFileRef[] {
  const normalizedCurrent = currentPath?.replace(/\\/g, "/");
  if (!normalizedCurrent) return files;
  const current = files.find((file) => file.path === normalizedCurrent);
  if (!current) return files;
  return [current, ...files.filter((file) => file.path !== normalizedCurrent)];
}
