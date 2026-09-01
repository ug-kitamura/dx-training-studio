"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageGrid, type ImageGridItem } from "@/components/workspace/ImageGrid";
import {
  PANE4_TAB_INSET,
  PANE4_TOP_BOX_CLASS,
} from "@/components/workspace/image-manager/image-manager-constants";
import { TabNoticeBanner } from "@/components/workspace/image-manager/TabNoticeBanner";
import type {
  ImageManagerTab,
  TabNotice,
} from "@/components/workspace/image-manager/types";
import { useUploadImagesTab } from "@/components/workspace/image-manager/use-upload-images-tab";

type Props = {
  gridItems: ImageGridItem[];
  /** 挿入操作が今この場で実行できるか（レッスン選択中かつ編集モード） */
  canInsert: boolean;
  notice?: TabNotice;
  refreshScope: (
    scope: "uploaded",
    options?: { silent?: boolean },
  ) => Promise<void>;
  showNotice: (tab: "upload", message: string, tone: "error" | "success") => void;
  clearNotice: (tab: "upload") => void;
  setActiveTab: (tab: ImageManagerTab) => void;
  onHighlightPaths: (paths: string | string[]) => void;
  onPasteReady: (handler: ((e: React.ClipboardEvent) => void) | null) => void;
  onPreview: (item: ImageGridItem) => void;
  onInsert: (item: ImageGridItem) => void;
  onDelete: (item: ImageGridItem) => void;
};

export function UploadImagesTab({
  gridItems,
  canInsert,
  notice,
  refreshScope,
  showNotice,
  clearNotice,
  setActiveTab,
  onHighlightPaths,
  onPasteReady,
  onPreview,
  onInsert,
  onDelete,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFiles, handlePaste } = useUploadImagesTab({
    refreshScope,
    showNotice,
    clearNotice,
    setActiveTab,
    onHighlightPaths,
  });

  useEffect(() => {
    onPasteReady(handlePaste);
    return () => onPasteReady(null);
  }, [handlePaste, onPasteReady]);

  return (
    <>
      <TabNoticeBanner notice={notice} />
      <div className={cn(PANE4_TAB_INSET, "flex flex-col gap-3 pb-3 pt-3")}>
        <UploadDropZone
          fileInputRef={fileInputRef}
          onUploadFiles={uploadFiles}
        />
        <ImageGrid
          items={gridItems}
          emptyMessage="UP staging に画像がありません"
          canInsert={canInsert}
          onPreview={onPreview}
          onInsert={onInsert}
          onDelete={onDelete}
        />
      </div>
    </>
  );
}

function UploadDropZone({
  fileInputRef,
  onUploadFiles,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadFiles: (files: FileList | File[]) => void | Promise<void>;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <>
      <div
        className={cn(
          PANE4_TOP_BOX_CLASS,
          "cursor-pointer transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary hover:bg-primary/5",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          void onUploadFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-xs font-medium text-foreground">ドラッグ&ドロップ</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          またはクリックして選択
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && void onUploadFiles(e.target.files)}
      />
    </>
  );
}
