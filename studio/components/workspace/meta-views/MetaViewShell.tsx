"use client";

import type { ReactNode } from "react";
import {
  META_HEADING_TEXT,
  PaneKindBadge,
} from "@/components/workspace/metaDialogLayout";
import { cn } from "@/lib/utils";

type Props = {
  /** ヘッダーに出す階層名（例: シリーズ名）。英語モードでは name_en */
  title: string;
  /** タイトル横の階層種別ラベル（例: 全体 / シリーズ / Home / Series） */
  kindLabel: string;
  /**
   * 本文冒頭の見出し行に出す文言（例: `シリーズメタを編集（英語）`）。
   * ⚠ **UI 文言なので英語モードでも日本語**（studio-translation の射程規則）
   */
  heading: string;
  /**
   * 見出し行の右に置く操作ボタン列（`PaneActionBar`）。
   * ⚠ スクロールに追従させない（workspace-meta-views spec）——本文と一緒に流れる。
   * 追従が要るのは CodeMirror が独自スクロールを持つレッスン本文だけで、
   * そちらは `PaneActionBar` の `overlay` が担う。
   */
  actionBar?: ReactNode;
  children: ReactNode;
};

/**
 * ペイン2 のメタビュー共通シェル。
 * MarkdownEditorPane と同じ h-12 ヘッダー＋スクロール本文の構成。
 *
 * 配置の規則（workspace-meta-views / studio-translation spec）:
 * - ヘッダー = 階層種別ラベルとタイトル（＝いまどこにいるか）だけ
 * - 本文冒頭の見出し行 = 左に「何を編集しているか」・右に操作ボタン列
 *   （左＝AI が下書き / 右＝人が確定）
 *
 * ⚠ 保存ボタンをヘッダーに戻さないこと。⚠ 言語切替もヘッダーに置かない
 * （GlobalHeader に1つだけ）。日英で配置が変わるのを避けるため、言語による
 * 分岐もここには置かない。
 */
export function MetaViewShell({
  title,
  kindLabel,
  heading,
  actionBar,
  children,
}: Props) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 py-0">
        <PaneKindBadge>{kindLabel}</PaneKindBadge>
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {title}
        </h2>
      </div>
      <div className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {/* 見出し行。左＝何を編集しているか / 右＝操作。⚠ sticky にしない */}
          <div className="flex min-h-8 items-center justify-between gap-2">
            {/* 体裁は LessonMetaDialog の DialogTitle と共有する（META_HEADING_TEXT）。
                ⚠ クラスをここに書き写さないこと——片方だけ動く事故になる */}
            <h3
              className={cn(
                "min-w-0 truncate text-foreground",
                META_HEADING_TEXT,
              )}
            >
              {heading}
            </h3>
            {actionBar}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
