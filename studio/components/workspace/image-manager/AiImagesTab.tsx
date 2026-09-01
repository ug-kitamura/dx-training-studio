"use client";

import { useEffect } from "react";
import { Pen, RotateCcw, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BusySpinner } from "@/components/workspace/BusySpinner";
import { ImageGrid, type ImageGridItem } from "@/components/workspace/ImageGrid";
import { Button } from "@/components/ui/button";
import {
  PANE4_BUTTON_ROW_CLASS,
  PANE4_PROMPT_BLOCK_CLASS,
  PANE4_PROMPT_TEXTAREA_CLASS,
  PANE4_TAB_INSET,
} from "@/components/workspace/image-manager/image-manager-constants";
import { TabNoticeBanner } from "@/components/workspace/image-manager/TabNoticeBanner";
import type { TabNotice } from "@/components/workspace/image-manager/types";
import { useAiImageTab } from "@/components/workspace/image-manager/use-ai-image-tab";
import type { EditLanguage } from "@/lib/display-name";
import type { Lesson } from "@/lib/schema";

type Props = {
  /** AI へ渡す文脈。`content` は編集言語の本文（英語ビューでは訳文） */
  lesson: Lesson | undefined;
  /** 生成する図解と alt の言語 */
  language: EditLanguage;
  editorCommentPrompt: string | null;
  editorCursorOffset: number | null;
  refreshScope: (
    scope: "ai",
    options?: { silent?: boolean },
  ) => Promise<void>;
  showNotice: (
    tab: "ai",
    message: string,
    tone: "error" | "success" | "warning",
  ) => void;
  clearNotice: (tab: "ai") => void;
  onHighlightPaths: (paths: string | string[]) => void;
  gridItems: ImageGridItem[];
  /** 挿入操作が今この場で実行できるか（レッスン選択中かつ編集モード） */
  canInsert: boolean;
  notice?: TabNotice;
  onResolveAltReady: (
    resolveAlt: ((item: ImageGridItem) => string | undefined) | null,
  ) => void;
  onPreview: (item: ImageGridItem) => void;
  onInsert: (item: ImageGridItem) => void;
  onDelete: (item: ImageGridItem) => void;
};

export function AiImagesTab({
  lesson,
  language,
  editorCommentPrompt,
  editorCursorOffset,
  refreshScope,
  showNotice,
  clearNotice,
  onHighlightPaths,
  gridItems,
  canInsert,
  notice,
  onResolveAltReady,
  onPreview,
  onInsert,
  onDelete,
}: Props) {
  const {
    prompt,
    setPrompt,
    generating,
    suggesting,
    resolveAlt,
    handleGenerate,
    handleAutoFill,
    handleResetPrompt,
  } = useAiImageTab({
    lesson,
    language,
    editorCommentPrompt,
    editorCursorOffset,
    refreshScope,
    showNotice,
    clearNotice,
    onHighlightPaths,
  });

  useEffect(() => {
    onResolveAltReady(resolveAlt);
    return () => onResolveAltReady(null);
  }, [resolveAlt, onResolveAltReady]);

  return (
    <>
      <TabNoticeBanner notice={notice} />
      {/* staging はレッスンに紐づかないので、レッスン未選択でも中身は出したまま */}
      <div className={cn(PANE4_TAB_INSET, "flex flex-col gap-3 pb-3 pt-3")}>
        <div className={PANE4_PROMPT_BLOCK_CLASS}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="画像生成プロンプトを入力してください"
            className={PANE4_PROMPT_TEXTAREA_CLASS}
          />
          <div className={PANE4_BUTTON_ROW_CLASS}>
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 px-4 text-xs transition-colors enabled:hover:bg-primary/85"
              disabled={generating || suggesting || !prompt.trim()}
              onClick={() => void handleGenerate()}
            >
              {generating ? (
                <>
                  <BusySpinner className="size-3.5" />
                  生成中...
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  生成
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 text-xs"
              // 自動入力はカーソル周辺の本文を読むので、レッスンがなければ成立しない
              disabled={!lesson || suggesting || generating}
              onClick={() => void handleAutoFill()}
            >
              {suggesting ? (
                <BusySpinner className="size-3.5" />
              ) : (
                <Pen className="h-3.5 w-3.5" />
              )}
              自動入力
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 text-xs"
              disabled={suggesting || generating}
              onClick={handleResetPrompt}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              リセット
            </Button>
          </div>
        </div>
        <ImageGrid
          items={gridItems}
          emptyMessage="AI staging に画像がありません"
          thumbnailFit="contain"
          canInsert={canInsert}
          onPreview={onPreview}
          onInsert={onInsert}
          onDelete={onDelete}
        />
      </div>
    </>
  );
}
