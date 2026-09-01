"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import { type ImageGridItem } from "@/components/workspace/ImageGrid";
import { ImageLightbox } from "@/components/workspace/ImageLightbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildUsedImageRows } from "@/lib/build-used-image-rows";
import {
  countImageRefsInSeries,
  indexImageRefLocations,
  isSeriesUnusedFilter,
  usedRowMatchesFilter,
  type UsedImageFilter,
} from "@/lib/extract-image-refs";
import { toImageMarkdown, isCanonicalImagePath } from "@/lib/image-path";
import { canonicalFileApiParams } from "@/lib/image-api-client";
import type { StorageErrorKind } from "@/lib/image-storage/types";
import { IMAGE_ERROR_MESSAGE } from "@/lib/image-error";
import { AiImagesTab } from "@/components/workspace/image-manager/AiImagesTab";
import { UploadImagesTab } from "@/components/workspace/image-manager/UploadImagesTab";
import { UsedImagesTab } from "@/components/workspace/image-manager/UsedImagesTab";
import { WebImagesTab } from "@/components/workspace/image-manager/WebImagesTab";
import {
  FILTER_ALL,
  FILTER_UNUSED,
} from "@/components/workspace/image-manager/image-manager-constants";
import { tabToScope } from "@/components/workspace/image-manager/image-manager-utils";
import type {
  ImageManagerPaneProps,
  ImageManagerTab,
  PendingDelete,
  TabNotice,
} from "@/components/workspace/image-manager/types";
import { useImageLists } from "@/components/workspace/image-manager/use-image-lists";
import { usePromoteAndInsert } from "@/components/workspace/image-manager/use-promote-and-insert";

function mergeTabNotice(
  usedStorageErrorKind: StorageErrorKind | null,
  notice: TabNotice | undefined,
): TabNotice | undefined {
  if (usedStorageErrorKind) {
    return {
      message: IMAGE_ERROR_MESSAGE[usedStorageErrorKind],
      // 上限ブロックは「直せば戻る」状態なので error ではなく warning で出す
      tone: usedStorageErrorKind === "blocked" ? "warning" : "error",
    };
  }
  return notice;
}

export function ImageManagerPane({
  series,
  lesson,
  pane3Mode,
  activeTab,
  onActiveTabChange,
  onInsertImage,
  editorCommentPrompt,
  editorCursorOffset,
  editLanguage,
  contextLesson,
  pane4Open,
  onImageAssetsChanged,
}: ImageManagerPaneProps) {
  const [tabNotices, setTabNotices] = useState<
    Partial<Record<ImageManagerTab, TabNotice>>
  >({});
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [usedFilter, setUsedFilter] = useState<UsedImageFilter>({
    seriesId: null,
    courseId: null,
    lessonId: null,
  });
  const [highlightedPaths, setHighlightedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const pasteHandlerRef = useRef<
    ((e: React.ClipboardEvent) => void) | null
  >(null);
  const aiResolveAltRef = useRef<
    ((item: ImageGridItem) => string | undefined) | null
  >(null);
  const webResolveAltRef = useRef<
    ((item: ImageGridItem) => string | undefined) | null
  >(null);

  const closePreview = useCallback(() => {
    setPreviewPath(null);
  }, []);

  const {
    stagingFiles,
    aiStagingFiles,
    webStagingFiles,
    promotedFiles,
    loading,
    usedStorageErrorKind,
    refreshScope,
    refreshScopes,
  } = useImageLists({ pane4Open, activeTab });

  const refCounts = useMemo(
    () => countImageRefsInSeries(series),
    [series],
  );

  const refLocations = useMemo(
    () => indexImageRefLocations(series),
    [series],
  );

  const usedRows = useMemo(
    () => buildUsedImageRows(promotedFiles, refCounts),
    [promotedFiles, refCounts],
  );

  const filteredUsedRows = useMemo(
    () =>
      usedRows.filter((row) =>
        usedRowMatchesFilter(
          row.path,
          row.referenceCount,
          usedFilter,
          refLocations,
        ),
      ),
    [usedRows, usedFilter, refLocations],
  );

  // タブ切替でプレビューとハイライトをリセットする。タブは親からも変わるため
  // イベントハンドラに寄せられず、「前回値を state に持ち render 中に比較する」
  // React 公式パターンで書く（Effect+setState は 1 render 遅れる）
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);
  if (activeTab !== prevActiveTab) {
    setPrevActiveTab(activeTab);
    setPreviewPath(null);
    setHighlightedPaths(new Set());
  }

  const highlightPaths = useCallback((paths: string | string[]) => {
    const list = Array.isArray(paths) ? paths : [paths];
    setHighlightedPaths((prev) => {
      const next = new Set(prev);
      for (const path of list) next.add(path);
      return next;
    });
  }, []);

  const withHighlight = useCallback(
    (items: ImageGridItem[]): ImageGridItem[] =>
      items.map((item) => ({
        ...item,
        highlighted: highlightedPaths.has(item.path),
      })),
    [highlightedPaths],
  );

  const showNotice = useCallback(
    (tab: ImageManagerTab, message: string, tone: TabNotice["tone"]) => {
      setTabNotices((prev) => ({ ...prev, [tab]: { message, tone } }));
    },
    [],
  );

  const clearNotice = useCallback((tab: ImageManagerTab) => {
    setTabNotices((prev) => {
      if (!(tab in prev)) return prev;
      const next = { ...prev };
      delete next[tab];
      return next;
    });
  }, []);

  /**
   * 挿入操作が今この場で実行できるか。レッスン選択中かつ編集モードのときだけ有効で、
   * ここ 1 箇所から全タブ・拡大プレビューへ配る。エディタ側が登録する挿入コールバックの
   * 有無は根拠にしない——アンマウント後も残るため「成功を返すが本文に入らない」状態になる。
   */
  const canInsert = !!lesson && pane3Mode === "raw";

  const tryInsert = useCallback(
    (markdown: string, tab: ImageManagerTab) => {
      const ok = onInsertImage(markdown);
      if (ok) clearNotice(tab);
      return ok;
    },
    [onInsertImage, clearNotice],
  );

  const { promoteAndInsert } = usePromoteAndInsert({
    tryInsert,
    refreshScopes,
    showNotice,
    onImageAssetsChanged,
  });

  const handleInsertPromoted = useCallback(
    (item: ImageGridItem) => {
      tryInsert(toImageMarkdown(item.path), "used");
    },
    [tryInsert],
  );

  const handleInsertStaging = useCallback(
    (item: ImageGridItem) =>
      promoteAndInsert(item, { tab: "upload", stagingScope: "uploaded" }),
    [promoteAndInsert],
  );

  const handleInsertAiStaging = useCallback(
    (item: ImageGridItem) =>
      promoteAndInsert(item, {
        tab: "ai",
        stagingScope: "ai",
        resolveAlt: (i) => aiResolveAltRef.current?.(i),
      }),
    [promoteAndInsert],
  );

  const handleInsertWebStaging = useCallback(
    (item: ImageGridItem) =>
      promoteAndInsert(item, {
        tab: "web",
        stagingScope: "web",
        resolveAlt: (i) => webResolveAltRef.current?.(i),
      }),
    [promoteAndInsert],
  );

  const requestDelete = useCallback(
    (item: ImageGridItem, tab: ImageManagerTab, referenceCount = 0) => {
      if (item.missing) return;
      const kind =
        tab === "used" && referenceCount > 0 ? "referenced" : "simple";
      setPendingDelete({ ...item, referenceCount, kind, tab });
    },
    [],
  );

  const onPasteReady = useCallback(
    (handler: ((e: React.ClipboardEvent) => void) | null) => {
      pasteHandlerRef.current = handler;
    },
    [],
  );

  const onAiResolveAltReady = useCallback(
    (resolveAlt: ((item: ImageGridItem) => string | undefined) | null) => {
      aiResolveAltRef.current = resolveAlt;
    },
    [],
  );

  const onWebResolveAltReady = useCallback(
    (resolveAlt: ((item: ImageGridItem) => string | undefined) | null) => {
      webResolveAltRef.current = resolveAlt;
    },
    [],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    pasteHandlerRef.current?.(e);
  }, []);

  const aiStagingGridItems: ImageGridItem[] = withHighlight(
    aiStagingFiles.map((file) => ({
      path: file.path,
      name: file.name,
      showInsert: true,
      showDelete: true,
    })),
  );

  const webStagingGridItems: ImageGridItem[] = withHighlight(
    webStagingFiles.map((file) => ({
      path: file.path,
      name: file.name,
      showInsert: true,
      showDelete: true,
    })),
  );

  const stagingGridItems: ImageGridItem[] = withHighlight(
    stagingFiles.map((file) => ({
      path: file.path,
      name: file.name,
      showInsert: true,
      showDelete: true,
    })),
  );

  const usedGridItems: ImageGridItem[] = filteredUsedRows.map((row) => ({
    path: row.path,
    name: row.name,
    missing: row.missing,
    statusLabel: row.missing
      ? "画像が存在しません"
      : row.referenceCount > 0
        ? `使用中: ${row.referenceCount}`
        : "未使用",
    showInsert: !row.missing,
    showDelete: !row.missing,
  }));

  const previewItems: ImageGridItem[] = useMemo(() => {
    switch (activeTab) {
      case "used":
        return usedGridItems;
      case "upload":
        return stagingGridItems;
      case "ai":
        return aiStagingGridItems;
      case "web":
        return webStagingGridItems;
      default:
        return [];
    }
  }, [
    activeTab,
    usedGridItems,
    stagingGridItems,
    aiStagingGridItems,
    webStagingGridItems,
  ]);

  const previewableItems: ImageGridItem[] = useMemo(
    () => previewItems.filter((item) => !item.missing),
    [previewItems],
  );

  const executeDelete = useCallback(
    async (item: PendingDelete, tab: ImageManagerTab, force = false) => {
      const wasPreviewingDeleted = previewPath === item.path;
      let nextPreviewPath: string | null | undefined;
      if (wasPreviewingDeleted) {
        const idx = previewableItems.findIndex((i) => i.path === item.path);
        if (previewableItems.length <= 1) {
          nextPreviewPath = null;
        } else if (idx < previewableItems.length - 1) {
          nextPreviewPath = previewableItems[idx + 1]!.path;
        } else {
          nextPreviewPath = previewableItems[idx - 1]!.path;
        }
      }

      const params = isCanonicalImagePath(item.path)
        ? canonicalFileApiParams(item.path)
        : new URLSearchParams({ path: item.path });
      if (force && item.referenceCount) {
        params.set("force", "1");
        params.set("referenceCount", String(item.referenceCount));
      }
      const res = await fetch(`/api/images/file?${params}`, { method: "DELETE" });
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        showNotice(tab, data.error ?? "削除に失敗しました", "error");
        return;
      }
      await refreshScope(tabToScope(tab), { silent: true });
      onImageAssetsChanged?.(item.path);

      if (wasPreviewingDeleted) {
        if (nextPreviewPath) setPreviewPath(nextPreviewPath);
        else closePreview();
      }
    },
    [
      previewPath,
      previewableItems,
      refreshScope,
      showNotice,
      onImageAssetsChanged,
      closePreview,
    ],
  );

  const previewIndex = useMemo(() => {
    if (!previewPath) return null;
    const idx = previewableItems.findIndex((i) => i.path === previewPath);
    return idx >= 0 ? idx : null;
  }, [previewPath, previewableItems]);

  const openPreview = useCallback((item: ImageGridItem) => {
    if (item.missing) return;
    setPreviewPath(item.path);
  }, []);

  const currentPreviewItem =
    previewIndex !== null ? previewableItems[previewIndex] : null;

  const seriesUnusedMode = isSeriesUnusedFilter(usedFilter);

  const filterCourses = useMemo(() => {
    if (seriesUnusedMode || !usedFilter.seriesId) return [];
    const s = series.find((x) => x.id === usedFilter.seriesId);
    return s?.courses ?? [];
  }, [series, usedFilter.seriesId, seriesUnusedMode]);

  const filterLessons = useMemo(() => {
    if (!usedFilter.courseId) return [];
    for (const s of series) {
      const course = s.courses.find((c) => c.id === usedFilter.courseId);
      if (course) return course.lessons;
    }
    return [];
  }, [series, usedFilter.courseId]);

  const usedFilterSeriesLabel = useMemo(() => {
    if (seriesUnusedMode) return "（未使用）";
    if (!usedFilter.seriesId) return "すべてのシリーズ";
    return series.find((s) => s.id === usedFilter.seriesId)?.name ?? "シリーズ";
  }, [usedFilter.seriesId, series, seriesUnusedMode]);

  const usedFilterCourseLabel = useMemo(() => {
    if (seriesUnusedMode) return "（未使用）";
    if (!usedFilter.courseId) return "すべてのコース";
    return (
      filterCourses.find((c) => c.id === usedFilter.courseId)?.name ?? "コース"
    );
  }, [usedFilter.courseId, filterCourses, seriesUnusedMode]);

  const usedFilterLessonLabel = useMemo(() => {
    if (seriesUnusedMode) return "（未使用）";
    if (!usedFilter.lessonId) return "すべてのレッスン";
    return (
      filterLessons.find((l) => l.id === usedFilter.lessonId)?.lesson ?? "レッスン"
    );
  }, [usedFilter.lessonId, filterLessons, seriesUnusedMode]);

  const seriesSelectValue = seriesUnusedMode
    ? FILTER_UNUSED
    : (usedFilter.seriesId ?? FILTER_ALL);

  const resetUsedFilter = useCallback(() => {
    setUsedFilter({ seriesId: null, courseId: null, lessonId: null });
  }, []);

  return (
    <PaneWheelRoot
      scrollRef={tabScrollRef}
      className="min-h-0 flex-1 bg-card"
      onPaste={handlePaste}
    >
      <div
        ref={tabScrollRef}
        className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        {loading && activeTab !== "ai" && activeTab !== "web" ? (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            読み込み中...
          </div>
        ) : null}

        <div className={cn(activeTab !== "used" || loading ? "hidden" : undefined)}>
          <UsedImagesTab
            series={series}
            usedFilter={usedFilter}
            onUsedFilterChange={setUsedFilter}
            seriesSelectValue={seriesSelectValue}
            usedFilterSeriesLabel={usedFilterSeriesLabel}
            usedFilterCourseLabel={usedFilterCourseLabel}
            usedFilterLessonLabel={usedFilterLessonLabel}
            seriesUnusedMode={seriesUnusedMode}
            filterCourses={filterCourses}
            filterLessons={filterLessons}
            gridItems={usedGridItems}
            canInsert={canInsert}
            usedRows={usedRows}
            notice={mergeTabNotice(usedStorageErrorKind, tabNotices.used)}
            onResetFilter={resetUsedFilter}
            onPreview={openPreview}
            onInsert={handleInsertPromoted}
            onDelete={(item, referenceCount) =>
              requestDelete(item, "used", referenceCount)
            }
          />
        </div>

        <div className={cn(activeTab !== "upload" || loading ? "hidden" : undefined)}>
          <UploadImagesTab
            gridItems={stagingGridItems}
            canInsert={canInsert}
            notice={tabNotices.upload}
            refreshScope={refreshScope}
            showNotice={showNotice}
            clearNotice={clearNotice}
            setActiveTab={onActiveTabChange}
            onHighlightPaths={highlightPaths}
            onPasteReady={onPasteReady}
            onPreview={openPreview}
            onInsert={handleInsertStaging}
            onDelete={(item) => requestDelete(item, "upload")}
          />
        </div>

        <div className={cn(activeTab !== "ai" ? "hidden" : undefined)}>
          <AiImagesTab
            lesson={contextLesson}
            language={editLanguage}
            editorCommentPrompt={editorCommentPrompt}
            editorCursorOffset={editorCursorOffset}
            refreshScope={refreshScope}
            showNotice={showNotice}
            clearNotice={clearNotice}
            onHighlightPaths={highlightPaths}
            gridItems={aiStagingGridItems}
            canInsert={canInsert}
            notice={tabNotices.ai}
            onResolveAltReady={onAiResolveAltReady}
            onPreview={openPreview}
            onInsert={handleInsertAiStaging}
            onDelete={(item) => requestDelete(item, "ai")}
          />
        </div>

        <div className={cn(activeTab !== "web" ? "hidden" : undefined)}>
          <WebImagesTab
            lesson={lesson}
            editorCommentPrompt={editorCommentPrompt}
            editorCursorOffset={editorCursorOffset}
            refreshScope={refreshScope}
            showNotice={showNotice}
            clearNotice={clearNotice}
            onHighlightPaths={highlightPaths}
            gridItems={webStagingGridItems}
            canInsert={canInsert}
            notice={tabNotices.web}
            onResolveAltReady={onWebResolveAltReady}
            onPreview={openPreview}
            onInsert={handleInsertWebStaging}
            onDelete={(item) => requestDelete(item, "web")}
          />
        </div>
      </div>

      {previewIndex !== null && currentPreviewItem ? (
        <ImageLightbox
          open
          onOpenChange={(open) => !open && closePreview()}
          items={previewableItems}
          index={previewIndex}
          onIndexChange={(idx) => {
            const item = previewableItems[idx];
            if (item) setPreviewPath(item.path);
          }}
          showInsert={currentPreviewItem.showInsert}
          showDelete={currentPreviewItem.showDelete}
          canInsert={canInsert}
          onInsert={() => {
            if (!currentPreviewItem) return;
            closePreview();
            switch (activeTab) {
              case "used":
                handleInsertPromoted(currentPreviewItem);
                break;
              case "upload":
                void handleInsertStaging(currentPreviewItem);
                break;
              case "ai":
                void handleInsertAiStaging(currentPreviewItem);
                break;
              case "web":
                void handleInsertWebStaging(currentPreviewItem);
                break;
            }
          }}
          onDelete={() => {
            if (!currentPreviewItem) return;
            if (activeTab === "used") {
              const row = usedRows.find((r) => r.path === currentPreviewItem.path);
              requestDelete(
                currentPreviewItem,
                "used",
                row?.referenceCount ?? 0,
              );
              return;
            }
            requestDelete(currentPreviewItem, activeTab);
          }}
        />
      ) : null}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>画像を削除しますか？</AlertDialogTitle>
            {pendingDelete?.kind === "referenced" ? (
              <AlertDialogDescription>
                {pendingDelete.name} は {pendingDelete.referenceCount}{" "}
                箇所で使用しています。
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  void executeDelete(
                    pendingDelete,
                    pendingDelete.tab,
                    pendingDelete.kind === "referenced",
                  );
                  setPendingDelete(null);
                }
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PaneWheelRoot>
  );
}
