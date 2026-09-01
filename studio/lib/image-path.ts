export const IMAGE_SOURCES = ["uploaded", "ai", "web"] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

export const IMAGE_TRASH_DIR = "trash";

/** UP タブ MP4 アップロード上限（3 MB） */
export const MAX_MP4_BYTES = 3 * 1024 * 1024;

const IMAGE_PATH_PREFIX = "images/";

export function normalizeImageLogicalPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

/** Markdown / react-markdown 由来の src を論理パスへ（% エンコードを復元） */
export function decodeImageMarkdownSrc(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return trimmed;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

/** プレビュー用: Markdown src から安全な論理パスを得る */
export function resolveImageLogicalPathFromMarkdown(src: string): string | null {
  const decoded = decodeImageMarkdownSrc(src);
  const normalized = normalizeImageLogicalPath(decoded);
  return isSafeImageLogicalPath(normalized) ? normalized : null;
}

export function isImageSource(value: string): value is ImageSource {
  return (IMAGE_SOURCES as readonly string[]).includes(value);
}

function pathPartsAfterImages(normalized: string): string[] {
  if (!normalized.startsWith(IMAGE_PATH_PREFIX)) return [];
  return normalized.slice(IMAGE_PATH_PREFIX.length).split("/").filter(Boolean);
}

/** trash: `images/trash/<filename>` */
export function isTrashImagePath(path: string): boolean {
  const parts = pathPartsAfterImages(normalizeImageLogicalPath(path));
  if (parts.length !== 2) return false;
  if (parts[0] !== IMAGE_TRASH_DIR) return false;
  return parts[1].length > 0 && parts[1] !== "." && parts[1] !== "..";
}

/** 正本: `images/<filename>`（1 セグメント、予約ディレクトリ名は不可） */
export function isCanonicalImagePath(path: string): boolean {
  const parts = pathPartsAfterImages(normalizeImageLogicalPath(path));
  if (parts.length !== 1) return false;
  if (isImageSource(parts[0])) return false;
  if (parts[0] === IMAGE_TRASH_DIR) return false;
  return parts[0].length > 0 && parts[0] !== "." && parts[0] !== "..";
}

export function trashDirLogical(): string {
  return `${IMAGE_PATH_PREFIX}${IMAGE_TRASH_DIR}`;
}

/** staging: `images/{source}/<filename>` */
export function isStagingImagePath(path: string): boolean {
  const parts = pathPartsAfterImages(normalizeImageLogicalPath(path));
  if (parts.length !== 2) return false;
  if (!isImageSource(parts[0])) return false;
  return parts[1].length > 0 && parts[1] !== "." && parts[1] !== "..";
}

/** 正本または staging の論理パス */
export function isSafeImageLogicalPath(path: string): boolean {
  const normalized = normalizeImageLogicalPath(path);
  if (!normalized.startsWith(IMAGE_PATH_PREFIX)) return false;
  if (normalized.includes("..")) return false;
  return isCanonicalImagePath(normalized) || isStagingImagePath(normalized);
}

/** @deprecated staging は `isStagingImagePath` を使用 */
export function isStagingPath(path: string): boolean {
  return isStagingImagePath(path);
}

/** staging パスから正本の論理パス */
export function promoteTargetPath(stagingPath: string): string | null {
  const normalized = normalizeImageLogicalPath(stagingPath);
  if (!isStagingImagePath(normalized)) return null;
  const fileName = pathPartsAfterImages(normalized)[1];
  return `${IMAGE_PATH_PREFIX}${fileName}`;
}

export function stagingDirLogical(source: ImageSource): string {
  return `images/${source}`;
}

export function imageFileName(path: string): string {
  const normalized = normalizeImageLogicalPath(path);
  const parts = pathPartsAfterImages(normalized);
  return parts[parts.length - 1] ?? normalized;
}

export function isMp4FileName(name: string): boolean {
  return name.toLowerCase().endsWith(".mp4");
}

export function isMp4Path(path: string): boolean {
  return isMp4FileName(imageFileName(path));
}

export function isAllowedUploadMime(type: string, fileName: string): boolean {
  if (type.startsWith("image/")) return true;
  if (type === "video/mp4") return true;
  return type === "" && isMp4FileName(fileName);
}

export function sourceFromPath(path: string): ImageSource | null {
  const normalized = normalizeImageLogicalPath(path);
  if (!isStagingImagePath(normalized)) return null;
  const source = pathPartsAfterImages(normalized)[0];
  return isImageSource(source) ? source : null;
}

export function toImageMarkdown(path: string, alt?: string): string {
  const name = imageFileName(path);
  const normalized = normalizeImageLogicalPath(path);
  const canonical = isCanonicalImagePath(normalized)
    ? normalized
    : promoteTargetPath(normalized) ?? normalized;
  const label = alt?.trim() || name;
  return `![${label}](${canonical})`;
}

export function toImageApiUrl(
  logicalPath: string,
  options?: { storageMode?: "local" | "storage" },
): string {
  const normalized = normalizeImageLogicalPath(logicalPath);
  const params = new URLSearchParams({ path: normalized });
  if (options?.storageMode && isCanonicalImagePath(normalized)) {
    params.set("storageMode", options.storageMode);
  }
  return `/api/images/file?${params.toString()}`;
}

export function sanitizeUploadFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "image";
  const cleaned = base.replace(/[^\w.\-()\u3000-\u9fff\u3040-\u309f\u30a0-\u30ff]+/g, "_");
  return cleaned.length > 0 ? cleaned : "image.png";
}

/** 一覧にある正本パスへ寄せる（空白等→sanitize 済みファイル名へのフォールバック） */
export function resolveToAvailablePath(
  logicalPath: string,
  available: ReadonlySet<string>,
): string | null {
  const normalized = normalizeImageLogicalPath(logicalPath);
  if (available.has(normalized)) return normalized;
  const sanitized = `${IMAGE_PATH_PREFIX}${sanitizeUploadFileName(imageFileName(normalized))}`;
  if (available.has(sanitized)) return sanitized;
  return null;
}
