import fs from "node:fs";
import path from "node:path";
import { parseWorkScope, workScopeBaseDir } from "@/lib/work-scope";

export const AGENT_WORK_SCOPE_MISSING_ERROR =
  "作業フォルダが見つかりません（リネームまたは削除された可能性があります）。実行を停止しました。";

export function resolveWorkScopeAbsolutePath(
  projectRoot: string,
  workScopeKey: string,
): string | null {
  const scope = parseWorkScope(workScopeKey);
  if (!scope) return null;
  return path.join(projectRoot, workScopeBaseDir(scope));
}

/** 作業フォルダが存在しなければエラーメッセージ、存在すれば null */
export function checkWorkScopeExists(
  projectRoot: string,
  workScopeKey: string,
): string | null {
  const absolutePath = resolveWorkScopeAbsolutePath(projectRoot, workScopeKey);
  if (!absolutePath) {
    return `${AGENT_WORK_SCOPE_MISSING_ERROR} (不正なスコープ: ${workScopeKey})`;
  }
  const display = workScopeBaseDir(parseWorkScope(workScopeKey) ?? {});
  try {
    if (
      !fs.existsSync(absolutePath) ||
      !fs.statSync(absolutePath).isDirectory()
    ) {
      return `${AGENT_WORK_SCOPE_MISSING_ERROR} (${display})`;
    }
  } catch {
    return `${AGENT_WORK_SCOPE_MISSING_ERROR} (${display})`;
  }
  return null;
}
