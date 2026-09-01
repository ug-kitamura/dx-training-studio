"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageGrid, type ImageGridItem } from "@/components/workspace/ImageGrid";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  FILTER_SERIES_UNUSED,
  isUsedImageFilterActive,
  type UsedImageFilter,
} from "@/lib/extract-image-refs";
import type { Series } from "@/lib/schema";
import {
  FILTER_ALL,
  FILTER_UNUSED,
  PANE4_TAB_INSET,
} from "@/components/workspace/image-manager/image-manager-constants";
import { TabNoticeBanner } from "@/components/workspace/image-manager/TabNoticeBanner";
import type { TabNotice } from "@/components/workspace/image-manager/types";

type Props = {
  series: Series[];
  usedFilter: UsedImageFilter;
  onUsedFilterChange: (filter: UsedImageFilter) => void;
  seriesSelectValue: string;
  usedFilterSeriesLabel: string;
  usedFilterCourseLabel: string;
  usedFilterLessonLabel: string;
  seriesUnusedMode: boolean;
  filterCourses: Series["courses"];
  filterLessons: Series["courses"][number]["lessons"];
  gridItems: ImageGridItem[];
  /** 挿入操作が今この場で実行できるか（レッスン選択中かつ編集モード） */
  canInsert: boolean;
  usedRows: Array<{ path: string; referenceCount: number }>;
  notice?: TabNotice;
  onResetFilter: () => void;
  onPreview: (item: ImageGridItem) => void;
  onInsert: (item: ImageGridItem) => void;
  onDelete: (item: ImageGridItem, referenceCount: number) => void;
};

export function UsedImagesTab({
  series,
  usedFilter,
  onUsedFilterChange,
  seriesSelectValue,
  usedFilterSeriesLabel,
  usedFilterCourseLabel,
  usedFilterLessonLabel,
  seriesUnusedMode,
  filterCourses,
  filterLessons,
  gridItems,
  canInsert,
  usedRows,
  notice,
  onResetFilter,
  onPreview,
  onInsert,
  onDelete,
}: Props) {
  return (
    <>
      <TabNoticeBanner notice={notice} />
      <div className={cn(PANE4_TAB_INSET, "flex flex-col gap-3 pb-3 pt-3")}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <Select
              value={seriesSelectValue}
              onValueChange={(value) => {
                if (value === FILTER_UNUSED) {
                  onUsedFilterChange({
                    seriesId: FILTER_SERIES_UNUSED,
                    courseId: null,
                    lessonId: null,
                  });
                  return;
                }
                onUsedFilterChange({
                  seriesId: value === FILTER_ALL ? null : value,
                  courseId: null,
                  lessonId: null,
                });
              }}
            >
              <SelectTrigger size="sm" className="w-full text-xs">
                <span className="truncate">{usedFilterSeriesLabel}</span>
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value={FILTER_ALL} className="text-xs">
                  すべてのシリーズ
                </SelectItem>
                {series.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
                <SelectItem value={FILTER_UNUSED} className="text-xs">
                  （未使用）
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={usedFilter.courseId ?? FILTER_ALL}
              onValueChange={(value) => {
                onUsedFilterChange({
                  ...usedFilter,
                  courseId: value === FILTER_ALL ? null : value,
                  lessonId: null,
                });
              }}
              disabled={seriesUnusedMode || !usedFilter.seriesId}
            >
              <SelectTrigger size="sm" className="w-full text-xs">
                <span className="truncate">{usedFilterCourseLabel}</span>
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value={FILTER_ALL} className="text-xs">
                  すべてのコース
                </SelectItem>
                {filterCourses.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={usedFilter.lessonId ?? FILTER_ALL}
              onValueChange={(value) => {
                onUsedFilterChange({
                  ...usedFilter,
                  lessonId: value === FILTER_ALL ? null : value,
                });
              }}
              disabled={seriesUnusedMode || !usedFilter.courseId}
            >
              <SelectTrigger size="sm" className="w-full text-xs">
                <span className="truncate">{usedFilterLessonLabel}</span>
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value={FILTER_ALL} className="text-xs">
                  すべてのレッスン
                </SelectItem>
                {filterLessons.map((l) => (
                  <SelectItem key={l.id} value={l.id} className="text-xs">
                    {l.lesson}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isUsedImageFilterActive(usedFilter) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-fit text-xs"
              onClick={onResetFilter}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              フィルタリセット
            </Button>
          ) : null}
        </div>
        <ImageGrid
          items={gridItems}
          emptyMessage="promote 済みの画像がありません"
          canInsert={canInsert}
          onPreview={onPreview}
          onInsert={onInsert}
          onDelete={(item) => {
            const row = usedRows.find((r) => r.path === item.path);
            onDelete(item, row?.referenceCount ?? 0);
          }}
        />
      </div>
    </>
  );
}
