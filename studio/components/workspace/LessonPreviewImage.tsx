"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { LessonPreviewVideo } from "@/components/workspace/LessonPreviewVideo";
import {
  isMp4Path,
  resolveImageLogicalPathFromMarkdown,
  resolveToAvailablePath,
  toImageApiUrl,
} from "@/lib/image-path";
import { getImageStorageMode } from "@/lib/image-api-client";
import {
  IMAGE_ERROR_MESSAGE,
  probeImageError,
  type ImageErrorKind,
} from "@/lib/image-error";

type Props = {
  src?: string | Blob;
  alt?: string;
  availableImagePaths?: ReadonlySet<string> | null;
  cacheRevision?: number;
};

function MissingImagePlaceholder({
  label,
  alt,
  kind,
}: {
  label: string;
  alt?: string;
  kind: ImageErrorKind;
}) {
  const message = IMAGE_ERROR_MESSAGE[kind];
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

export function LessonPreviewImage({
  src,
  alt,
  availableImagePaths = null,
  cacheRevision = 0,
}: Props) {
  const [failed, setFailed] = useState(false);
  // 読み出し失敗の理由。判別が返るまでは従来表示（missing）を出す
  const [failedKind, setFailedKind] = useState<ImageErrorKind>("missing");

  const logicalPath =
    src && typeof src === "string"
      ? resolveImageLogicalPathFromMarkdown(src)
      : null;

  const fetchPath =
    logicalPath && availableImagePaths
      ? (resolveToAvailablePath(logicalPath, availableImagePaths) ?? logicalPath)
      : logicalPath;

  const isKnownMissing = Boolean(
    logicalPath &&
      availableImagePaths &&
      !resolveToAvailablePath(logicalPath, availableImagePaths),
  );

  const resolved =
    src && typeof src === "string"
      ? fetchPath
        ? `${toImageApiUrl(fetchPath, { storageMode: getImageStorageMode() })}&v=${cacheRevision}`
        : src
      : null;

  const label = logicalPath ?? (typeof src === "string" ? src : "") ?? "";

  // 参照先が変わったら失敗状態を持ち越さない（Effect+setState は 1 render
  // 遅れて古いプレースホルダーが見えるため render 中に比較して書く）
  const [prevImageKey, setPrevImageKey] = useState<{
    resolved: string | null;
    isKnownMissing: boolean;
    cacheRevision: number;
  }>({ resolved, isKnownMissing, cacheRevision });
  if (
    prevImageKey.resolved !== resolved ||
    prevImageKey.isKnownMissing !== isKnownMissing ||
    prevImageKey.cacheRevision !== cacheRevision
  ) {
    setPrevImageKey({ resolved, isKnownMissing, cacheRevision });
    setFailed(false);
    setFailedKind("missing");
  }

  if (!src || typeof src !== "string") return null;

  if (logicalPath && isMp4Path(logicalPath)) {
    return (
      <LessonPreviewVideo
        src={src}
        alt={alt}
        availableImagePaths={availableImagePaths}
        cacheRevision={cacheRevision}
      />
    );
  }

  if (isKnownMissing || failed) {
    // 一覧に無い＝本当に実体が無い。取得に失敗した場合だけ理由を分ける
    const kind: ImageErrorKind = isKnownMissing ? "missing" : failedKind;
    return <MissingImagePlaceholder label={label} alt={alt} kind={kind} />;
  }

  if (!resolved) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={resolved}
      src={resolved}
      alt={alt ?? ""}
      className="my-4 block h-auto max-w-full rounded-md"
      onError={() => {
        setFailed(true);
        void probeImageError(resolved).then(setFailedKind);
      }}
    />
  );
}
