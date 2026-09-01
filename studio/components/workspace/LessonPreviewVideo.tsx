"use client";

import { useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { MediaPlayOverlay } from "@/components/workspace/MediaPlayOverlay";
import {
  resolveImageLogicalPathFromMarkdown,
  resolveToAvailablePath,
  toImageApiUrl,
} from "@/lib/image-path";
import { getImageStorageMode } from "@/lib/image-api-client";
import {
  VIDEO_ERROR_MESSAGE,
  probeImageError,
  type ImageErrorKind,
} from "@/lib/image-error";

type Props = {
  src: string;
  alt?: string;
  availableImagePaths?: ReadonlySet<string> | null;
  cacheRevision?: number;
};

function MissingVideoPlaceholder({
  label,
  alt,
  kind,
}: {
  label: string;
  alt?: string;
  kind: ImageErrorKind;
}) {
  const message = VIDEO_ERROR_MESSAGE[kind];
  return (
    <span
      role="img"
      aria-label={alt ? `${alt}（${message}）` : message}
      className="my-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-destructive"
    >
      <ImageOff className="h-5 w-5 shrink-0" />
      <span className="min-w-0 text-sm">
        {message}
        <span className="mt-0.5 block truncate text-xs opacity-80">{label}</span>
      </span>
    </span>
  );
}

export function LessonPreviewVideo({
  src,
  alt,
  availableImagePaths = null,
  cacheRevision = 0,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  // 読み出し失敗の理由。判別が返るまでは従来表示（missing）を出す
  const [failedKind, setFailedKind] = useState<ImageErrorKind>("missing");

  const logicalPath = resolveImageLogicalPathFromMarkdown(src);

  const fetchPath =
    logicalPath && availableImagePaths
      ? (resolveToAvailablePath(logicalPath, availableImagePaths) ?? logicalPath)
      : logicalPath;

  const isKnownMissing = Boolean(
    logicalPath && availableImagePaths && !resolveToAvailablePath(logicalPath, availableImagePaths),
  );

  const resolved = fetchPath
    ? `${toImageApiUrl(fetchPath, { storageMode: getImageStorageMode() })}&v=${cacheRevision}`
    : null;

  const label = logicalPath ?? src;

  if (isKnownMissing || failed) {
    // 一覧に無い＝本当に実体が無い。取得に失敗した場合だけ理由を分ける
    const kind: ImageErrorKind = isKnownMissing ? "missing" : failedKind;
    return <MissingVideoPlaceholder label={label} alt={alt} kind={kind} />;
  }

  if (!resolved) return null;

  return (
    <button
      type="button"
      className="relative my-4 block max-w-full overflow-hidden rounded-md border-0 bg-muted p-0"
      aria-label={alt ? `${alt} を再生` : "動画を再生"}
      onClick={() => {
        const video = videoRef.current;
        if (!video) return;
        if (playing) {
          video.pause();
          setPlaying(false);
          return;
        }
        void video.play();
        setPlaying(true);
      }}
    >
      <video
        ref={videoRef}
        key={resolved}
        src={resolved}
        preload="metadata"
        playsInline
        className="max-w-full rounded-md"
        onEnded={() => setPlaying(false)}
        onError={() => {
          setFailed(true);
          if (resolved) void probeImageError(resolved).then(setFailedKind);
        }}
      />
      <MediaPlayOverlay visible={!playing} />
    </button>
  );
}
