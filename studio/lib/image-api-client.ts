import type { ImageListScope } from "@/lib/image-list-client";
import { loadWorkspaceSettings, type ImageStorageMode } from "@/lib/workspace-settings";

export function getImageStorageMode(): ImageStorageMode {
  return loadWorkspaceSettings().imageStorage;
}

export async function checkImageStorageConnection(): Promise<boolean> {
  const res = await fetch("/api/images/storage-check");
  return res.ok;
}

export function withImageStorageMode(url: string): string {
  const storageMode = getImageStorageMode();
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}storageMode=${encodeURIComponent(storageMode)}`;
}

/** 正本（used）スコープの list URL */
export function usedImageListUrl(): string {
  return withImageStorageMode("/api/images/list?scope=used");
}

export function canonicalFileApiParams(path: string): URLSearchParams {
  const params = new URLSearchParams({ path });
  params.set("storageMode", getImageStorageMode());
  return params;
}

export function scopesNeedingStorageMode(scopes: ImageListScope[]): boolean {
  return scopes.includes("used");
}
