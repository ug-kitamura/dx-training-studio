"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeImageLogicalPath } from "@/lib/image-path";
import { fetchAvailableImagePaths } from "@/lib/preview-image-assets";
import {
  settingsEventAffectsStorage,
  WORKSPACE_SETTINGS_CHANGED_EVENT,
} from "@/lib/workspace-settings";

export function useWorkspaceImageAssets(enabled = true) {
  const [imageAssetsRevision, setImageAssetsRevision] = useState(0);
  const [availableImagePaths, setAvailableImagePaths] = useState<Set<string> | null>(
    null,
  );

  const notifyImageAssetsChanged = useCallback(
    (removedPaths?: string | string[]) => {
      if (removedPaths) {
        const list = Array.isArray(removedPaths) ? removedPaths : [removedPaths];
        setAvailableImagePaths((prev) => {
          if (!prev) return prev;
          const next = new Set(prev);
          for (const path of list) {
            next.delete(normalizeImageLogicalPath(path));
          }
          return next;
        });
        return;
      }
      setImageAssetsRevision((v) => v + 1);
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetchAvailableImagePaths().then((paths) => {
      if (!cancelled) setAvailableImagePaths(paths);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, imageAssetsRevision]);

  useEffect(() => {
    const onSettingsChanged = (event: Event) => {
      // ストレージ解決に影響する変更のみ再取得する
      if (!settingsEventAffectsStorage(event)) return;
      setImageAssetsRevision((v) => v + 1);
    };
    window.addEventListener(WORKSPACE_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    return () =>
      window.removeEventListener(WORKSPACE_SETTINGS_CHANGED_EVENT, onSettingsChanged);
  }, []);

  return {
    availableImagePaths,
    imageAssetsRevision,
    notifyImageAssetsChanged,
  };
}
