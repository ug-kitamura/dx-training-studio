import { cookies } from "next/headers";
import { Workspace } from "@/components/workspace/Workspace";
import {
  getContentsDir,
  loadContentsFolder,
  readMetaJson,
  reconcileOrderFiles,
} from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";
import {
  TREE_COLLAPSE_COOKIE_NAME,
  allCollapsed,
  parseTreeCollapseCookie,
  pruneTreeCollapse,
  type StoredTreeCollapse,
} from "@/lib/tree-collapse-cookie";
import {
  SELECTION_COOKIE_NAME,
  focusHome,
  parseSelectionCookie,
  resolveStoredSelection,
  type WorkspaceSelection,
} from "@/lib/workspace-selection";
import { WORKSPACE_META } from "@/lib/workspace-meta";
import type { Series } from "@/lib/schema";

/**
 * 保存値が無いときの選択。先頭シリーズ → 先頭コース → 先頭レッスン。
 * ⚠ `Workspace` のフォールバックと同じ規則にすること——ずれるとサーバーと
 * クライアントで初期選択が食い違い、hydration 後に選択が移る
 */
function firstLessonSelection(seriesList: Series[]): WorkspaceSelection {
  return {
    seriesId: seriesList[0]?.id ?? "",
    courseId: seriesList[0]?.courses[0]?.id ?? "",
    lessonId: seriesList[0]?.courses[0]?.lessons[0]?.id ?? "",
  };
}

/**
 * ツリーの畳み状態と選択を cookie から読む。**サーバーの初期描画で使う**——クライアント
 * 側の復元では「全展開／先頭レッスンが一瞬見えてから切り替わる」を消せない
 * （`lib/tree-collapse-cookie.ts` / `lib/workspace-selection.ts` を参照）。
 *
 * ⚠ Vercel では読まない。`cookies()` を呼ぶと route が dynamic rendering になり、
 * 正本をビルド時に静的焼き込みする前提（spec `studio-demo-deployment`）が崩れて、
 * ランタイムの fs に無い正本を読みに行く＝中身が空のデモになる。デモは読み取り専用
 * なので、開閉・選択が保持されないのは許容。分岐の前例は `next.config.ts` の
 * `outputFileTracingRoot`。
 */
async function loadInitialUiState(seriesList: Series[]): Promise<{
  treeCollapse: StoredTreeCollapse;
  /** 開閉が保存された記憶から来たか。false は「記憶なしなので全折りたたみで描いた」 */
  restoredFromMemory: boolean;
  selection: WorkspaceSelection;
}> {
  const fallback = firstLessonSelection(seriesList);
  // Vercel は cookie を読まないので、常に「記憶なし」＝全折りたたみで描く。
  // ⚠ `EMPTY_TREE_COLLAPSE` を返すと全展開になる（0件の記憶＝すべて展開の意味）
  if (process.env.VERCEL) {
    return {
      treeCollapse: allCollapsed(seriesList),
      restoredFromMemory: false,
      selection: focusHome(),
    };
  }
  const store = await cookies();
  const stored = parseTreeCollapseCookie(
    store.get(TREE_COLLAPSE_COOKIE_NAME)?.value,
  );

  // ⚠ **記憶が無いときは全折りたたみ、かつ選択はホーム。**
  // 選択を先頭レッスンのフォールバックに落とすと、「復元時は選択中のアイテムの祖先を
  // 展開する」が働いてその1本だけ枝が開き、「全部閉じた状態で始まる」を満たせない。
  // 開閉の記憶が無いときは選択の cookie も無いので、ここで揃えて倒す
  if (stored === null) {
    return {
      treeCollapse: allCollapsed(seriesList),
      restoredFromMemory: false,
      selection: focusHome(),
    };
  }

  return {
    treeCollapse: pruneTreeCollapse(stored, seriesList),
    restoredFromMemory: true,
    selection: resolveStoredSelection(
      seriesList,
      parseSelectionCookie(store.get(SELECTION_COOKIE_NAME)?.value),
      fallback,
    ),
  };
}

export default async function Page() {
  reconcileOrderFiles(getProjectRoot());
  const seriesList = loadContentsFolder(getProjectRoot());
  const githubUrl = readMetaJson(getContentsDir(getProjectRoot())).github_url;
  const { treeCollapse, restoredFromMemory, selection } =
    await loadInitialUiState(seriesList);

  return (
    <Workspace
      initialSeries={seriesList}
      contentsEmpty={seriesList.length === 0}
      workspace={WORKSPACE_META}
      initialGithubUrl={typeof githubUrl === "string" ? githubUrl : ""}
      initialTreeCollapse={treeCollapse}
      treeRestoredFromMemory={restoredFromMemory}
      initialSelection={selection}
    />
  );
}
