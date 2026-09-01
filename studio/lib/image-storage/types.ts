import type { ImageSource } from "@/lib/image-path";
import type { ImageStorageMode } from "@/lib/schema";

export type { ImageStorageMode };

export const STORAGE_CONNECTION_ERROR_MESSAGE =
  "ストレージに接続できません。ストレージトークンを環境変数に設定してください。";

/** 画像取得の失敗を UI が文言に依存せず分岐するための層 */
export type StorageErrorKind = "not-connected" | "blocked" | "read-failed";

export const STORAGE_BLOCKED_ERROR_MESSAGE =
  "ストレージが利用上限でブロックされています。プランの使用量を確認してください。";

export const STORAGE_READ_ERROR_MESSAGE = "ストレージから読み込めません。";

export class StorageConnectionError extends Error {
  readonly statusCode = 503;

  constructor(message = STORAGE_CONNECTION_ERROR_MESSAGE) {
    super(message);
    this.name = "StorageConnectionError";
  }
}

/**
 * ストレージがプランの利用上限でブロックされている。
 * 「実体が無い」とは別物——ここを 404 に潰すと、実在する画像が
 * 「画像が存在しません」と表示され、原因調査が誤った方向へ進む。
 */
export class StorageBlockedError extends Error {
  readonly statusCode = 503;

  constructor(message = STORAGE_BLOCKED_ERROR_MESSAGE) {
    super(message);
    this.name = "StorageBlockedError";
  }
}

/** 認証エラー・ネットワーク断など、不存在でもブロックでもない読み出し失敗 */
export class StorageReadError extends Error {
  readonly statusCode = 502;

  constructor(message = STORAGE_READ_ERROR_MESSAGE) {
    super(message);
    this.name = "StorageReadError";
  }
}

export type CanonicalFileEntry = {
  path: string;
  name: string;
  source: ImageSource;
  uploadedAt: string;
  /** バイト数。ETag の材料に使う（`lib/image-storage/canonical-cache.ts`） */
  size?: number;
};

export type CanonicalBackend = {
  listCanonical(): Promise<CanonicalFileEntry[]>;
  readCanonical(logicalPath: string): Promise<Buffer | null>;
  putCanonical(
    logicalPath: string,
    data: Buffer,
    source: ImageSource,
  ): Promise<CanonicalFileEntry>;
  deleteCanonical(logicalPath: string): Promise<void>;
};
