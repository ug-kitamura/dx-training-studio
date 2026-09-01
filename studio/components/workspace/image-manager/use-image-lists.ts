"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchImageList, type ImageListScope } from "@/lib/image-list-client";
import {
  settingsEventAffectsStorage,
  WORKSPACE_SETTINGS_CHANGED_EVENT,
} from "@/lib/workspace-settings";
import type { ImageAsset } from "@/lib/schema";
import { tabToScope } from "@/components/workspace/image-manager/image-manager-utils";
import type { ImageManagerTab } from "@/components/workspace/image-manager/types";
import type { StorageErrorKind } from "@/lib/image-storage/types";

type RefreshOptions = { silent?: boolean };

export function useImageLists(options: {
  pane4Open: boolean;
  activeTab: ImageManagerTab;
}) {
  const { pane4Open, activeTab } = options;

  const [stagingFiles, setStagingFiles] = useState<ImageAsset[]>([]);
  const [aiStagingFiles, setAiStagingFiles] = useState<ImageAsset[]>([]);
  const [webStagingFiles, setWebStagingFiles] = useState<ImageAsset[]>([]);
  const [promotedFiles, setPromotedFiles] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(false);
  /** Used タブの正本一覧取得時のみ（UP/AI/Web はローカル staging のため対象外） */
  const [usedStorageErrorKind, setUsedStorageErrorKind] =
    useState<StorageErrorKind | null>(null);
  const usedStorageConnectionError = usedStorageErrorKind !== null;

  const applyScopeFiles = useCallback((scope: ImageListScope, files: ImageAsset[]) => {
    switch (scope) {
      case "used":
        setPromotedFiles(files);
        break;
      case "uploaded":
        setStagingFiles(files);
        break;
      case "ai":
        setAiStagingFiles(files);
        break;
      case "web":
        setWebStagingFiles(files);
        break;
    }
  }, []);

  const refreshScope = useCallback(
    async (scope: ImageListScope, refreshOptions?: RefreshOptions) => {
      if (!refreshOptions?.silent) setLoading(true);
      try {
        const result = await fetchImageList(scope);
        if (scope === "used") {
          setUsedStorageErrorKind(result.storageErrorKind);
          applyScopeFiles(scope, result.storageErrorKind ? [] : result.files);
        } else {
          applyScopeFiles(scope, result.files);
        }
      } finally {
        if (!refreshOptions?.silent) setLoading(false);
      }
    },
    [applyScopeFiles],
  );

  const refreshScopes = useCallback(
    async (scopes: ImageListScope[], refreshOptions?: RefreshOptions) => {
      if (!refreshOptions?.silent) setLoading(true);
      try {
        const results = await Promise.all(
          scopes.map(async (scope) => [scope, await fetchImageList(scope)] as const),
        );
        for (const [scope, result] of results) {
          if (scope === "used") {
            setUsedStorageErrorKind(result.storageErrorKind);
            applyScopeFiles(scope, result.storageErrorKind ? [] : result.files);
          } else {
            applyScopeFiles(scope, result.files);
          }
        }
      } finally {
        if (!refreshOptions?.silent) setLoading(false);
      }
    },
    [applyScopeFiles],
  );

  useEffect(() => {
    if (pane4Open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- list API の非同期取得。結果を state に入れるのが目的で、派生 state の複製ではない
      void refreshScope(tabToScope(activeTab));
    }
  }, [pane4Open, activeTab, refreshScope]);

  useEffect(() => {
    const onSettingsChanged = (event: Event) => {
      // ストレージ解決に影響する変更のみ再取得する
      // （エディタのフォント拡縮等で「読み込み中…」を繰り返さない）
      if (!settingsEventAffectsStorage(event)) return;
      if (pane4Open) void refreshScope(tabToScope(activeTab));
    };
    window.addEventListener(WORKSPACE_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    return () =>
      window.removeEventListener(WORKSPACE_SETTINGS_CHANGED_EVENT, onSettingsChanged);
  }, [pane4Open, activeTab, refreshScope]);

  return {
    stagingFiles,
    aiStagingFiles,
    webStagingFiles,
    promotedFiles,
    loading,
    usedStorageConnectionError,
    usedStorageErrorKind,
    refreshScope,
    refreshScopes,
  };
}
