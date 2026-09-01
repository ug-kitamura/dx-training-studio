"use client";

import { useEffect } from "react";
import { Pen, RotateCcw, Search } from "lucide-react";
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
import { useWebImageTab } from "@/components/workspace/image-manager/use-web-image-tab";
import type { Lesson } from "@/lib/schema";

type Props = {
  lesson: Lesson | undefined;
  editorCommentPrompt: string | null;
  editorCursorOffset: number | null;
  refreshScope: (
    scope: "web",
    options?: { silent?: boolean },
  ) => Promise<void>;
  showNotice: (tab: "web", message: string, tone: "error" | "success") => void;
  clearNotice: (tab: "web") => void;
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

export function WebImagesTab({
  lesson,
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
    searching,
    suggesting,
    resolveAlt,
    handleSearch,
    handleAutoFill,
    handleResetPrompt,
  } = useWebImageTab({
    lesson,
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
            placeholder="画像検索条件を入力してください"
            className={PANE4_PROMPT_TEXTAREA_CLASS}
          />
          <div className={PANE4_BUTTON_ROW_CLASS}>
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 px-4 text-xs transition-colors enabled:hover:bg-primary/85"
              disabled={searching || suggesting || !prompt.trim()}
              onClick={() => void handleSearch()}
            >
              {searching ? (
                <>
                  <BusySpinner className="size-3.5" />
                  検索中...
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  検索
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 text-xs"
              // 自動入力はカーソル周辺の本文を読むので、レッスンがなければ成立しない
              disabled={!lesson || suggesting || searching}
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
              disabled={suggesting || searching}
              onClick={handleResetPrompt}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              リセット
            </Button>
          </div>
        </div>
        <ImageGrid
          items={gridItems}
          emptyMessage="Web staging に画像がありません"
          canInsert={canInsert}
          onPreview={onPreview}
          onInsert={onInsert}
          onDelete={onDelete}
        />
      </div>
    </>
  );
}
