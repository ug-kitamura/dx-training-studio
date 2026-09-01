"use client";

import { Upload, Sparkles, Search, SquareCheckBig } from "lucide-react";
import type { ImageManagerTab } from "@/components/workspace/image-manager/types";

export const FILTER_ALL = "all";
export const FILTER_UNUSED = "unused";

/** Pane4 タブ本文の左右インセット（プロンプト・ボタン・グリッドで共有） */
export const PANE4_TAB_INSET = "px-3";

/** UP D&D・AI/Web プロンプト欄で共有する高さ（AI の生成ボタン上端に UP 下線を揃える） */
export const PANE4_PROMPT_BLOCK_CLASS = "flex flex-col gap-2";
export const PANE4_BUTTON_ROW_CLASS = "flex h-8 items-center justify-start gap-2";
export const PANE4_TOP_BOX_CLASS =
  "flex h-[calc(96px+0.5rem)] flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center";
export const PANE4_PROMPT_TEXTAREA_CLASS =
  "workspace-scrollbar h-[96px] min-h-[96px] w-full resize-y overflow-y-auto rounded-lg border border-border bg-background px-3 pt-2 pb-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

// キー未設定文言の正本は lib/api-keys.ts（サーバー 401 と同一文字列での一致判定に使う）
export { AI_KEY_ERROR } from "@/lib/api-keys";
export const AI_PIXABAY_KEY_ERROR =
  "AI / Pixabay API キーを設定（歯車）するか、サーバー環境変数を設定してください";
export const MP4_SIZE_ERROR =
  "MP4 は 3 MB 以下にしてください（10 秒以内の録画を推奨）";

export const IMAGE_MANAGER_TABS: Array<{
  value: ImageManagerTab;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "used", label: "Used", icon: <SquareCheckBig className="h-3 w-3" /> },
  { value: "upload", label: "UP", icon: <Upload className="h-3 w-3" /> },
  { value: "ai", label: "AI", icon: <Sparkles className="h-3 w-3" /> },
  { value: "web", label: "Web", icon: <Search className="h-3 w-3" /> },
];
