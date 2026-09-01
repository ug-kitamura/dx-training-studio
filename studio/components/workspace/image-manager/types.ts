import type { ImageGridItem } from "@/components/workspace/ImageGrid";
import type { EditLanguage } from "@/lib/display-name";
import type { Lesson, Series } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/pane-layout";

export type ImageManagerTab = "used" | "upload" | "ai" | "web";

export type TabNotice = {
  message: string;
  tone: "error" | "success" | "warning";
};

export type PendingDelete = ImageGridItem & {
  referenceCount: number;
  kind: "referenced" | "simple";
  tab: ImageManagerTab;
};

export type ImageManagerPaneProps = {
  series: Series[];
  lesson: Lesson | undefined;
  pane3Mode: Pane3Mode;
  activeTab: ImageManagerTab;
  onActiveTabChange: (tab: ImageManagerTab) => void;
  onInsertImage: (markdown: string) => boolean;
  /** null = コメント外（プロンプト上書きしない）、string = コメント内テキスト */
  editorCommentPrompt: string | null;
  editorCursorOffset: number | null;
  /** 編集言語。AI モードの生成・自動入力の出力言語を決める */
  editLanguage: EditLanguage;
  /**
   * AI への文脈に渡すレッスン。`content` は**編集言語の本文**（英語ビューでは
   * `contents.en.md`、未保存の編集を含む）。英語版が未読込なら undefined——
   * レッスン未選択と同じく著者プロンプトだけで生成する。
   * ⚠ `lesson`（上）とは別物: あちらは Used タブのフィルタ・パス解決に使う正本側
   */
  contextLesson: Lesson | undefined;
  pane4Open: boolean;
  onImageAssetsChanged?: (removedPaths?: string | string[]) => void;
};
