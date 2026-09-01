"use client";

import { useCallback } from "react";
import type { ImageGridItem } from "@/components/workspace/ImageGrid";
import {
  isStorageConnectionErrorMessage,
  scopesAfterPromote,
  type ImageListScope,
} from "@/lib/image-list-client";
import { getImageStorageMode } from "@/lib/image-api-client";
import { toImageMarkdown } from "@/lib/image-path";
import { STORAGE_CONNECTION_ERROR_MESSAGE } from "@/lib/image-storage/types";
import type { ImageAsset } from "@/lib/schema";
import type { ImageManagerTab } from "@/components/workspace/image-manager/types";

export type PromoteStagingScope = Exclude<ImageListScope, "used">;

type RefreshOptions = { silent?: boolean };

export function usePromoteAndInsert(options: {
  tryInsert: (markdown: string, tab: ImageManagerTab) => boolean;
  refreshScopes: (
    scopes: ImageListScope[],
    refreshOptions?: RefreshOptions,
  ) => Promise<void>;
  showNotice: (tab: ImageManagerTab, message: string, tone: "error" | "success") => void;
  onImageAssetsChanged?: (removedPaths?: string | string[]) => void;
}) {
  const { tryInsert, refreshScopes, showNotice, onImageAssetsChanged } = options;

  const promoteAndInsert = useCallback(
    async (
      item: ImageGridItem,
      params: {
        tab: ImageManagerTab;
        stagingScope: PromoteStagingScope;
        resolveAlt?: (item: ImageGridItem) => string | undefined;
      },
    ) => {
      const res = await fetch("/api/images/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stagingPath: item.path,
          storageMode: getImageStorageMode(),
        }),
      });
      const data: { file?: ImageAsset; error?: string } = await res.json();
      if (!res.ok || !data.file) {
        const message = data.error ?? "画像の promote に失敗しました";
        showNotice(
          params.tab,
          isStorageConnectionErrorMessage(message)
            ? STORAGE_CONNECTION_ERROR_MESSAGE
            : message,
          "error",
        );
        return;
      }
      const alt = params.resolveAlt?.(item);
      const markdown = alt
        ? toImageMarkdown(data.file.path, alt)
        : toImageMarkdown(data.file.path);
      if (tryInsert(markdown, params.tab)) {
        await refreshScopes(scopesAfterPromote(params.stagingScope), { silent: true });
        onImageAssetsChanged?.();
      }
    },
    [tryInsert, refreshScopes, showNotice, onImageAssetsChanged],
  );

  return { promoteAndInsert };
}
