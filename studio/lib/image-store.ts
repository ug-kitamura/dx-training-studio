import fs from "node:fs/promises";
import path from "node:path";
import type { CanonicalBackend } from "@/lib/image-storage/types";
import {
  IMAGE_SOURCES,
  IMAGE_TRASH_DIR,
  type ImageSource,
  imageFileName,
  isCanonicalImagePath,
  isImageSource,
  isSafeImageLogicalPath,
  isStagingImagePath,
  normalizeImageLogicalPath,
  promoteTargetPath,
  sanitizeUploadFileName,
  stagingDirLogical,
  trashDirLogical,
} from "@/lib/image-path";

export type ImageFileEntry = {
  path: string;
  name: string;
  source: ImageSource;
  uploadedAt: string;
  /** バイト数。正本一覧では ETag の材料に使う（`lib/image-storage/canonical-cache.ts`） */
  size?: number;
};

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
};

const RESERVED_ROOT_DIRS = new Set<string>([...IMAGE_SOURCES, IMAGE_TRASH_DIR]);

export function getImagesRoot(projectRoot: string): string {
  return path.join(projectRoot, "images");
}

export function resolveAbsoluteImagePath(
  projectRoot: string,
  logicalPath: string,
): string | null {
  const normalized = normalizeImageLogicalPath(logicalPath);
  if (!isSafeImageLogicalPath(normalized)) return null;
  const absolute = path.join(projectRoot, normalized.split("/").join(path.sep));
  const root = getImagesRoot(projectRoot);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(absolute);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    return null;
  }
  return resolved;
}

export async function ensureImageDirectories(projectRoot: string): Promise<void> {
  await fs.mkdir(getImagesRoot(projectRoot), { recursive: true });
  for (const source of IMAGE_SOURCES) {
    await fs.mkdir(path.join(getImagesRoot(projectRoot), source), {
      recursive: true,
    });
  }
  await fs.mkdir(path.join(getImagesRoot(projectRoot), IMAGE_TRASH_DIR), {
    recursive: true,
  });
}

async function listFilesInDir(
  dir: string,
  source: ImageSource,
  logicalPrefix: string,
): Promise<ImageFileEntry[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const result: ImageFileEntry[] = [];
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    const absolute = path.join(dir, name);
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) continue;
    result.push({
      path: `${logicalPrefix}/${name}`,
      name,
      source,
      uploadedAt: stat.mtime.toISOString(),
    });
  }
  return result.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function listStagingImages(
  projectRoot: string,
  source: ImageSource,
): Promise<ImageFileEntry[]> {
  const dir = path.join(getImagesRoot(projectRoot), source);
  return listFilesInDir(dir, source, stagingDirLogical(source));
}

export async function listPromotedImages(
  projectRoot: string,
): Promise<ImageFileEntry[]> {
  const root = getImagesRoot(projectRoot);
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }

  const result: ImageFileEntry[] = [];
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    if (RESERVED_ROOT_DIRS.has(name)) continue;
    const absolute = path.join(root, name);
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) continue;
    const logicalPath = `images/${name}`;
    if (!isCanonicalImagePath(logicalPath)) continue;
    result.push({
      path: logicalPath,
      name,
      source: "uploaded",
      uploadedAt: stat.mtime.toISOString(),
      size: stat.size,
    });
  }
  return result.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function saveStagingImage(
  projectRoot: string,
  source: ImageSource,
  fileName: string,
  data: Buffer,
): Promise<ImageFileEntry> {
  await ensureImageDirectories(projectRoot);
  const safeName = sanitizeUploadFileName(fileName);
  const logicalPath = `${stagingDirLogical(source)}/${safeName}`;
  const absolute = resolveAbsoluteImagePath(projectRoot, logicalPath);
  if (!absolute) throw new Error("invalid path");
  await fs.writeFile(absolute, data);
  const stat = await fs.stat(absolute);
  return {
    path: logicalPath,
    name: safeName,
    source,
    uploadedAt: stat.mtime.toISOString(),
  };
}

export async function promoteStagingToCanonical(
  projectRoot: string,
  stagingPath: string,
  backend: CanonicalBackend,
): Promise<ImageFileEntry> {
  const targetLogical = promoteTargetPath(stagingPath);
  if (!targetLogical) throw new Error("invalid staging path");

  const sourceAbsolute = resolveAbsoluteImagePath(projectRoot, stagingPath);
  if (!sourceAbsolute) throw new Error("invalid path");

  try {
    await fs.access(sourceAbsolute);
  } catch {
    throw new Error("staging file not found");
  }

  const data = await fs.readFile(sourceAbsolute);
  const source = sourceFromStagingPath(stagingPath);
  if (!source) throw new Error("invalid source");

  return backend.putCanonical(targetLogical, data, source);
}

export async function promoteStagingImage(
  projectRoot: string,
  stagingPath: string,
): Promise<ImageFileEntry> {
  const { createLocalCanonicalBackend } = await import("@/lib/image-storage/local");
  return promoteStagingToCanonical(
    projectRoot,
    stagingPath,
    createLocalCanonicalBackend(projectRoot),
  );
}

function sourceFromStagingPath(stagingPath: string): ImageSource | null {
  const match = normalizeImageLogicalPath(stagingPath).match(
    /^images\/([^/]+)\//,
  );
  const segment = match?.[1];
  return segment && isImageSource(segment) ? segment : null;
}

export async function moveImageToTrash(
  projectRoot: string,
  logicalPath: string,
): Promise<void> {
  const normalized = normalizeImageLogicalPath(logicalPath);
  if (!isCanonicalImagePath(normalized) && !isStagingImagePath(normalized)) {
    throw new Error("invalid path");
  }
  const sourceAbsolute = resolveAbsoluteImagePath(projectRoot, normalized);
  if (!sourceAbsolute) throw new Error("invalid path");

  await ensureImageDirectories(projectRoot);
  const fileName = imageFileName(normalized);
  const trashLogical = `${trashDirLogical()}/${fileName}`;
  const trashAbsolute = path.join(
    getImagesRoot(projectRoot),
    IMAGE_TRASH_DIR,
    fileName,
  );

  try {
    await fs.access(trashAbsolute);
    await fs.unlink(trashAbsolute);
  } catch {
    // no existing trash file
  }

  try {
    await fs.rename(sourceAbsolute, trashAbsolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("file not found");
    }
    throw error;
  }

  if (!trashLogical.startsWith(trashDirLogical())) {
    throw new Error("invalid trash path");
  }
}

/** @deprecated use moveImageToTrash */
export async function deleteImageFile(
  projectRoot: string,
  logicalPath: string,
): Promise<void> {
  await moveImageToTrash(projectRoot, logicalPath);
}

export async function imageFileExists(
  projectRoot: string,
  logicalPath: string,
): Promise<boolean> {
  const absolute = resolveAbsoluteImagePath(projectRoot, logicalPath);
  if (!absolute) return false;
  try {
    await fs.access(absolute);
    return true;
  } catch {
    return false;
  }
}

export function mimeTypeForPath(logicalPath: string): string {
  const ext = path.extname(logicalPath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
