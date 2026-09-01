"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MediaPlayOverlay } from "@/components/workspace/MediaPlayOverlay";
import { isMp4Path, isCanonicalImagePath, toImageApiUrl } from "@/lib/image-path";
import { getImageStorageMode } from "@/lib/image-api-client";

export type LightboxItem = {
  name: string;
  path: string;
  statusLabel?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LightboxItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onInsert?: () => void;
  onDelete?: () => void;
  showInsert?: boolean;
  showDelete?: boolean;
  /** 今この場で挿入を実行できるか（`showInsert` は操作の有無、これは可否） */
  canInsert?: boolean;
};

export function ImageLightbox({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
  onInsert,
  onDelete,
  showInsert = false,
  showDelete = false,
  canInsert = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sizeLabel, setSizeLabel] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const item = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;
  const isVideo = item ? isMp4Path(item.path) : false;

  const resetVideo = () => {
    setPlaying(false);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetVideo();
      setSizeLabel(null);
    }
    onOpenChange(next);
  };

  const handleIndexChange = (nextIndex: number) => {
    resetVideo();
    setSizeLabel(null);
    onIndexChange(nextIndex);
  };

  if (!item) return null;

  const mediaUrl = toImageApiUrl(item.path, {
    storageMode: isCanonicalImagePath(item.path) ? getImageStorageMode() : undefined,
  });

  const handleVideoAreaClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      setPlaying(false);
      return;
    }
    void video.play();
    setPlaying(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[min(90vw,720px)] max-w-[min(90vw,720px)] gap-3">
        <DialogHeader>
          <DialogTitle className="truncate text-sm">
            {item.name}
            {items.length > 1 ? (
              <span className="ml-2 font-normal text-muted-foreground">
                ({index + 1}/{items.length})
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex w-full justify-center">
          <div className="relative max-w-full rounded border border-border bg-muted">
            {hasPrev ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 opacity-90 transition-none active:!-translate-y-1/2"
                onClick={() => handleIndexChange(index - 1)}
                aria-label="前の画像"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : null}
            {hasNext ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 opacity-90 transition-none active:!-translate-y-1/2"
                onClick={() => handleIndexChange(index + 1)}
                aria-label="次の画像"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : null}
            {isVideo ? (
              <button
                type="button"
                className="relative block"
                aria-label={playing ? "動画を一時停止" : "動画を再生"}
                onClick={handleVideoAreaClick}
              >
                <video
                  ref={videoRef}
                  key={item.path}
                  src={mediaUrl}
                  preload="metadata"
                  playsInline
                  className="block h-auto max-h-[70vh] w-auto max-w-full"
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    setSizeLabel(
                      `${video.videoWidth} × ${video.videoHeight}px`,
                    );
                  }}
                  onEnded={() => setPlaying(false)}
                />
                <MediaPlayOverlay visible={!playing} />
              </button>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={item.path}
                src={mediaUrl}
                alt={item.name}
                className="block h-auto max-h-[70vh] w-auto max-w-full"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setSizeLabel(`${img.naturalWidth} × ${img.naturalHeight}px`);
                }}
              />
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-xs text-muted-foreground">
            <span className="truncate">{item.path}</span>
            {sizeLabel ? (
              <>
                <span className="shrink-0 text-border">·</span>
                <span className="shrink-0 tabular-nums">{sizeLabel}</span>
              </>
            ) : null}
            {item.statusLabel ? (
              <>
                <span className="shrink-0 text-border">·</span>
                <span className="shrink-0">{item.statusLabel}</span>
              </>
            ) : null}
          </div>
          {(showInsert || showDelete) && (onInsert || onDelete) ? (
            <div className="flex shrink-0 gap-1.5">
              {showInsert && onInsert ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={onInsert}
                  disabled={!canInsert}
                >
                  <Plus className="h-3.5 w-3.5" />
                  挿入
                </Button>
              ) : null}
              {showDelete && onDelete ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1 text-xs"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  削除
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
