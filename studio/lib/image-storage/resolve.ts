import { imageStorageModeSchema, type ImageStorageMode } from "@/lib/schema";
import { createLocalCanonicalBackend } from "@/lib/image-storage/local";
import {
  StorageBlockedError,
  StorageConnectionError,
  StorageReadError,
  type CanonicalBackend,
  type StorageErrorKind,
} from "@/lib/image-storage/types";
import { createVercelBlobCanonicalBackend } from "@/lib/image-storage/vercel-blob";

export function parseImageStorageMode(
  raw: string | null | undefined,
): ImageStorageMode {
  const parsed = imageStorageModeSchema.safeParse(raw ?? "storage");
  return parsed.success ? parsed.data : "storage";
}

export function resolveCanonicalBackend(
  projectRoot: string,
  storageMode: ImageStorageMode,
): CanonicalBackend {
  if (storageMode === "local") {
    return createLocalCanonicalBackend(projectRoot);
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new StorageConnectionError();
  }

  return createVercelBlobCanonicalBackend(token);
}

/**
 * ストレージ由来の失敗を、層に応じたステータス・文言の Response にする。
 * ここで拾えない失敗だけが呼び出し側の汎用ハンドラへ落ちる。
 */
export function storageErrorResponse(error: unknown): Response | null {
  if (
    error instanceof StorageConnectionError ||
    error instanceof StorageBlockedError ||
    error instanceof StorageReadError
  ) {
    return Response.json(
      { error: error.message, kind: storageErrorKind(error) },
      { status: error.statusCode },
    );
  }
  return null;
}

/** クライアントが文言に依存せず分岐できるようにする識別子 */
export function storageErrorKind(error: unknown): StorageErrorKind | undefined {
  if (error instanceof StorageBlockedError) return "blocked";
  if (error instanceof StorageReadError) return "read-failed";
  if (error instanceof StorageConnectionError) return "not-connected";
  return undefined;
}
