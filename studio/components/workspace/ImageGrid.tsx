"use client";

import { useState } from "react";
import { ImageOff, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaPlayOverlay } from "@/components/workspace/MediaPlayOverlay";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import { IMAGE_GRID_CELL_MIN } from "@/components/workspace/pane-layout";
import { isMp4Path, isCanonicalImagePath, toImageApiUrl } from "@/lib/image-path";
import { getImageStorageMode } from "@/lib/image-api-client";
import {
  IMAGE_ERROR_MESSAGE,
  probeImageError,
  type ImageErrorKind,
} from "@/lib/image-error";

function mediaSrc(path: string): string {
  const storageMode = isCanonicalImagePath(path) ? getImageStorageMode() : undefined;
  return toImageApiUrl(path, storageMode ? { storageMode } : undefined);
}

export type ImageGridItem = {
  path: string;
  name: string;
  missing?: boolean;
  statusLabel?: string;
  showInsert?: boolean;
  showDelete?: boolean;
  highlighted?: boolean;
};

/** セル内のエラー表示（実体なし・ストレージ障害で共通の見た目、文言だけ変える） */
function ThumbnailErrorCell({ kind }: { kind: ImageErrorKind }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-1 p-2",
        // 実体なしは destructive、ストレージ障害は「直せば戻る」ので warning 系
        kind === "missing" ? "text-destructive" : "text-amber-600 dark:text-amber-400",
      )}
    >
      <ImageOff className="h-5 w-5 shrink-0" />
      <span className="text-center text-[9px] leading-tight">
        {IMAGE_ERROR_MESSAGE[kind]}
      </span>
    </div>
  );
}

/**
 * サムネイル本体。読み出しに失敗したら理由を判別して文言を変える
 * ——実在する画像を「存在しません」と表示しないため。
 */
function Thumbnail({
  item,
  isVideo,
  fitClass,
}: {
  item: ImageGridItem;
  isVideo: boolean;
  fitClass: string;
}) {
  const [failedKind, setFailedKind] = useState<ImageErrorKind | null>(null);
  const src = mediaSrc(item.path);

  const onError = () => {
    setFailedKind("missing");
    void probeImageError(src).then(setFailedKind);
  };

  if (failedKind) return <ThumbnailErrorCell kind={failedKind} />;

  if (isVideo) {
    return (
      <video
        src={src}
        preload="metadata"
        muted
        playsInline
        className={cn("max-h-full max-w-full", fitClass)}
        onError={onError}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={item.name}
      className={cn("max-h-full max-w-full", fitClass)}
      onError={onError}
    />
  );
}

type Props = {
  items: ImageGridItem[];
  emptyMessage: string;
  onPreview: (item: ImageGridItem) => void;
  onInsert?: (item: ImageGridItem) => void;
  onDelete?: (item: ImageGridItem) => void;
  className?: string;
  thumbnailFit?: "cover" | "contain";
  /**
   * 今この場で挿入を実行できるか。`item.showInsert`（そのタブに挿入という操作が
   * 存在するか）とは別概念——存在するが押せない状態を disabled で表す。
   */
  canInsert?: boolean;
};

export function ImageGrid({
  items,
  emptyMessage,
  onPreview,
  onInsert,
  onDelete,
  className,
  thumbnailFit = "contain",
  canInsert = true,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-center text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn("grid w-full gap-2", className)}
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(min(${IMAGE_GRID_CELL_MIN}px, calc((100% - 0.5rem) / 2)), 1fr))`,
      }}
    >
      {items.map((item) => {
        const isVideo = !item.missing && isMp4Path(item.path);
        const mediaFitClass =
          thumbnailFit === "contain" ? "object-contain" : "object-cover";
        return (
          <div
            key={item.path}
            className={cn(
              "flex flex-col overflow-hidden rounded border bg-card",
              item.highlighted
                ? "border-2 border-primary"
                : "border border-border",
              item.missing && "border-destructive/40 bg-destructive/5",
            )}
          >
            <button
              type="button"
              className={cn(
                "relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted",
                item.missing ? "cursor-default" : "cursor-zoom-in hover:opacity-90",
              )}
              onClick={() => !item.missing && onPreview(item)}
              disabled={item.missing}
              aria-label={
                item.missing
                  ? item.statusLabel
                  : isVideo
                    ? `${item.name} を拡大表示`
                    : `${item.name} を拡大表示`
              }
            >
              {item.missing ? (
                <ThumbnailErrorCell kind="missing" />
              ) : (
                <Thumbnail item={item} isVideo={isVideo} fitClass={mediaFitClass} />
              )}
              {isVideo ? <MediaPlayOverlay /> : null}
            </button>
            <div className="flex min-h-0 flex-1 flex-col gap-1 p-1.5 dark:bg-muted">
              {/* 省略表示の補完。⚠ 生 title は使わない（Studio 既定のツールチップ規則） */}
              <WorkspaceTooltip
                label={item.name}
                render={
                  <p className="truncate text-[10px] font-medium text-foreground">
                    {item.name}
                  </p>
                }
              />
              {item.statusLabel ? (
                <p
                  className={cn(
                    "text-[9px]",
                    item.missing
                      ? "text-destructive"
                      : item.statusLabel === "未使用"
                        ? "text-muted-foreground"
                        : "text-primary",
                  )}
                >
                  {item.statusLabel}
                </p>
              ) : null}
              <div className="mt-auto flex gap-1">
                {item.showInsert && onInsert ? (
                  <button
                    type="button"
                    onClick={() => onInsert(item)}
                    disabled={!canInsert}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-0.5 rounded border border-border py-0.5 text-[9px]",
                      canInsert
                        ? "hover:border-primary hover:text-primary"
                        : "cursor-not-allowed text-muted-foreground opacity-50",
                    )}
                    aria-label="エディタに挿入"
                  >
                    <Plus className="h-3 w-3" />
                    挿入
                  </button>
                ) : null}
                {item.showDelete && onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    className="flex items-center justify-center rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground hover:border-destructive hover:text-destructive"
                    aria-label="削除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
