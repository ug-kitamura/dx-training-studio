"use client";

import { useCallback } from "react";
import {
  isAllowedUploadMime,
  isMp4FileName,
  MAX_MP4_BYTES,
} from "@/lib/image-path";
import { MP4_SIZE_ERROR } from "@/components/workspace/image-manager/image-manager-constants";
import type { ImageManagerTab } from "@/components/workspace/image-manager/types";

type RefreshScope = (
  scope: "uploaded",
  options?: { silent?: boolean },
) => Promise<void>;

export function useUploadImagesTab(options: {
  refreshScope: RefreshScope;
  showNotice: (tab: "upload", message: string, tone: "error" | "success") => void;
  clearNotice: (tab: "upload") => void;
  setActiveTab: (tab: ImageManagerTab) => void;
  onHighlightPaths: (paths: string | string[]) => void;
}) {
  const { refreshScope, showNotice, clearNotice, setActiveTab, onHighlightPaths } =
    options;

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      let uploaded = false;
      const uploadedPaths: string[] = [];
      for (const file of Array.from(files)) {
        if (!isAllowedUploadMime(file.type, file.name)) continue;
        const isMp4 =
          file.type === "video/mp4" ||
          (file.type === "" && isMp4FileName(file.name));
        if (isMp4 && file.size > MAX_MP4_BYTES) {
          showNotice("upload", MP4_SIZE_ERROR, "error");
          continue;
        }
        const form = new FormData();
        form.append("file", file);
        form.append("source", "uploaded");
        const res = await fetch("/api/images/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const data: { error?: string } = await res.json();
          showNotice(
            "upload",
            data.error ?? "アップロードに失敗しました",
            "error",
          );
          continue;
        }
        const data: { file?: { path: string } } = await res.json();
        if (data.file?.path) uploadedPaths.push(data.file.path);
        uploaded = true;
      }
      if (uploaded) clearNotice("upload");
      await refreshScope("uploaded", { silent: true });
      if (uploadedPaths.length > 0) onHighlightPaths(uploadedPaths);
      setActiveTab("upload");
    },
    [refreshScope, showNotice, clearNotice, setActiveTab, onHighlightPaths],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const imageFiles: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.type.startsWith("image/") || item.type === "video/mp4") {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) void uploadFiles(imageFiles);
    },
    [uploadFiles],
  );

  return { uploadFiles, handlePaste };
}
