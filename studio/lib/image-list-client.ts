import type { ImageAsset } from "@/lib/schema";
import { getImageStorageMode } from "@/lib/image-api-client";
import {
  STORAGE_CONNECTION_ERROR_MESSAGE,
  type StorageErrorKind,
} from "@/lib/image-storage/types";

/** Pane4 タブごとの画像リスト API スコープ */
export type ImageListScope = "used" | "uploaded" | "ai" | "web";

export type ImageListFetchResult = {
  files: ImageAsset[];
  storageConnectionError: boolean;
  /** 失敗の層。未接続・上限ブロック・読み出し失敗を UI が区別するために運ぶ */
  storageErrorKind: StorageErrorKind | null;
};

export function isStorageConnectionErrorMessage(
  message: string | undefined,
): boolean {
  return message === STORAGE_CONNECTION_ERROR_MESSAGE;
}

export function imageListScopeUrl(scope: ImageListScope): string {
  switch (scope) {
    case "used": {
      const storageMode = getImageStorageMode();
      return `/api/images/list?scope=used&storageMode=${encodeURIComponent(storageMode)}`;
    }
    case "uploaded":
      return "/api/images/list?scope=staging&source=uploaded";
    case "ai":
      return "/api/images/list?scope=staging&source=ai";
    case "web":
      return "/api/images/list?scope=staging&source=web";
  }
}

export async function fetchImageList(scope: ImageListScope): Promise<ImageListFetchResult> {
  const res = await fetch(imageListScopeUrl(scope));
  const json: { files?: ImageAsset[]; error?: string; kind?: StorageErrorKind } =
    await res.json();
  if (!res.ok) {
    const connectionError = isStorageConnectionErrorMessage(json.error);
    return {
      files: [],
      storageConnectionError: connectionError,
      storageErrorKind: json.kind ?? (connectionError ? "not-connected" : null),
    };
  }
  return {
    files: json.files ?? [],
    storageConnectionError: false,
    storageErrorKind: null,
  };
}

/** promote 後: staging ソースと used の両方を更新する */
export function scopesAfterPromote(stagingScope: Exclude<ImageListScope, "used">): ImageListScope[] {
  return [stagingScope, "used"];
}
