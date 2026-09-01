"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** 左スロット: AI が下書きを作る操作（「原文から翻訳」等）。無い面では省略する */
  aiSlot?: ReactNode;
  /** 右スロット: 人が正本に書く操作（保存）。自動保存の面では省略する */
  saveSlot?: ReactNode;
  /**
   * 追従のさせ方。
   * - `inline`（既定）: その場に置くだけ。メタビューの見出し行向け
   * - `overlay`: 本文の上に重ねる。CodeMirror のように内部が独自のスクロール
   *   コンテナになっていて、本文と一緒に流すと画面外へ出てしまう面
   *   （レッスン本文の英語ビュー）向け
   *
   * ⚠ `sticky`（スクロール追従）は廃止した。実機で「ついてくるのが違和感」と
   * 判明したため、メタビューは見出し行に固定する（workspace-meta-views spec）。
   * 戻さないこと。
   */
  variant?: "inline" | "overlay";
  className?: string;
};

/**
 * 操作ボタン列（studio-translation spec）。
 *
 * 並びは **左＝AI が下書きを作る / 右＝人が正本に書く** で固定する。
 * 「AI は正本に書かない」という規則を配置そのもので見せるための順序なので、
 * 面の都合で入れ替えないこと。
 *
 * 置き場は面の種類で決まる:
 * - メタ編集面（全体・シリーズ・コース）→ 本文冒頭の見出し行（`inline`）
 * - レッスン本文の英語ビュー → 本文に重ねる（`overlay`）
 */
export function PaneActionBar({
  aiSlot,
  saveSlot,
  variant = "inline",
  className,
}: Props) {
  if (!aiSlot && !saveSlot) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2",
        variant === "overlay" &&
          "pointer-events-none absolute top-2 right-4 z-10 [&>*]:pointer-events-auto",
        className,
      )}
    >
      {aiSlot}
      {saveSlot}
    </div>
  );
}
