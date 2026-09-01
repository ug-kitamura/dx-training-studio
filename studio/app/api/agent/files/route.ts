import {
  listContentMarkdownFiles,
  listPlanFiles,
  listRecentRunFiles,
  orderContentFilesForPicker,
} from "@/lib/agent/file-attachments";
import { getProjectRoot } from "@/lib/project-root";
import { parseWorkScope, workScopeLevel } from "@/lib/work-scope";

/**
 * @ 参照ピッカー用のファイル一覧。並ぶのは 3 種。
 * - 正本ツリーのレッスン本文（`contents/**\/contents.md`）
 * - 計画置き場（`contents-work/plans/`）
 * - 更新日時の新しい run ディレクトリ 3 件分
 *
 * `scope` は作業スコープ（`serializeWorkScope` の出力。空文字は `contents/` 直下）。
 * レッスンにフォーカスしているときだけ、開いている本文を先頭に固定する。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scopeRaw = url.searchParams.get("scope") ?? "";
  const current = url.searchParams.get("current")?.trim() || null;
  const projectRoot = getProjectRoot();

  const scope = parseWorkScope(scopeRaw);
  const focusedOnLesson = scope !== null && workScopeLevel(scope) === "lesson";

  const files = [
    ...orderContentFilesForPicker(
      listContentMarkdownFiles(projectRoot),
      focusedOnLesson ? current : null,
    ),
    ...listPlanFiles(projectRoot),
    ...listRecentRunFiles(projectRoot),
  ];

  return Response.json({ files });
}
