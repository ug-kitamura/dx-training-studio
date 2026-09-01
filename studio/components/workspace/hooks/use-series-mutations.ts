"use client";

import { useCallback } from "react";
import type { Course, Series } from "@/lib/schema";

async function saveCourseMeta(
  seriesName: string,
  courseName: string,
  meta: Pick<
    Course,
    | "target"
    | "style"
    | "slug"
    | "catch"
    | "description"
    | "cross_series_prev"
    | "cross_series_next"
    | "is_start"
    | "is_goal"
  >,
): Promise<void> {
  const res = await fetch("/api/content/save-course", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      series: seriesName,
      course: courseName,
      target: meta.target ?? "",
      // 未設定は空文字で送る（API 側が既存キーを除去する）。
      // state（ローダー由来）が正なので、公開フィールドも常に明示送信する
      style: meta.style ?? "",
      slug: meta.slug ?? "",
      catch: meta.catch ?? "",
      description: meta.description ?? "",
      cross_series_prev: meta.cross_series_prev,
      cross_series_next: meta.cross_series_next,
      is_start: meta.is_start ?? false,
      is_goal: meta.is_goal ?? false,
    }),
  });
  if (!res.ok) throw new Error("コースメタ保存エラー");
}

async function persistCourseMetas(
  items: ReturnType<typeof listCoursesNeedingMetaPersist>,
): Promise<void> {
  await Promise.all(
    items.map(({ seriesName, course }) =>
      saveCourseMeta(seriesName, course.name, {
        target: course.target,
        style: course.style,
        slug: course.slug,
        catch: course.catch,
        description: course.description,
        cross_series_prev: course.cross_series_prev,
        cross_series_next: course.cross_series_next,
        is_start: course.is_start,
        is_goal: course.is_goal,
      }),
    ),
  );
}

async function saveSeriesOrder(seriesNames: string[]): Promise<void> {
  const res = await fetch("/api/content/save-series-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order: seriesNames }),
  });
  if (!res.ok) throw new Error("シリーズ順序保存エラー");
}

async function callContentApi(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`/api/content/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({ error: "APIエラー" }))) as {
      error: string;
    };
    throw new Error(error);
  }
}
import {
  applySeriesRename,
  remapCourseAndLessonIds,
  remapSelection,
} from "@/lib/content-rename";
import { generateSeriesId, generateCourseId } from "@/lib/content-ids";
import {
  applyCourseDeletion,
  applyCrossSeriesCourseMetaEdit,
  applySeriesDeletion,
  filterCrossSeriesIds,
  listCoursesNeedingMetaPersist,
} from "@/lib/course-flow";
import {
  resolveSelectionAfterDelete,
  type WorkspaceSelection,
} from "@/lib/workspace-selection";

export function useSeriesMutations(options: {
  series: Series[];
  setSeries: React.Dispatch<React.SetStateAction<Series[]>>;
  selectedSeriesId: string;
  selectedCourseId: string;
  selectedLessonId: string;
  setSelection: (selection: WorkspaceSelection) => void;
  onSaveError?: (msg: string) => void;
}) {
  const { series, setSeries, selectedSeriesId, selectedCourseId, selectedLessonId, setSelection, onSaveError } =
    options;

  const addSeries = useCallback(
    (name: string) => {
      const newId = generateSeriesId(name);
      setSeries((prev) => [...prev, { id: newId, name, courses: [] }]);
      callContentApi("create", { type: "series", name, id: newId }).catch((err: unknown) => {
        onSaveError?.(`シリーズ追加エラー: ${String(err)}`);
      });
      return newId;
    },
    [setSeries, onSaveError],
  );

  const deleteSeries = useCallback(
    (seriesId: string) => {
      const target = series.find((s) => s.id === seriesId);
      const next = applySeriesDeletion(series, seriesId);
      const selection = resolveSelectionAfterDelete({
        prevSeries: series,
        nextSeries: next,
        selectedSeriesId,
        selectedCourseId,
        selectedLessonId,
        deleted: { kind: "series", seriesId },
      });
      setSeries(next);
      setSelection(selection);
      if (target) {
        callContentApi("delete", { type: "series", name: target.name }).catch(
          (err: unknown) => onSaveError?.(`シリーズ削除エラー: ${String(err)}`),
        );
      }
    },
    [series, selectedSeriesId, selectedCourseId, selectedLessonId, setSeries, setSelection, onSaveError],
  );

  const deleteCourse = useCallback(
    (seriesId: string, courseId: string) => {
      const targetSeries = series.find((s) => s.id === seriesId);
      const targetCourse = targetSeries?.courses.find((c) => c.id === courseId);
      const next = applyCourseDeletion(series, seriesId, courseId);
      const selection = resolveSelectionAfterDelete({
        prevSeries: series,
        nextSeries: next,
        selectedSeriesId,
        selectedCourseId,
        selectedLessonId,
        deleted: { kind: "course", courseId },
      });
      setSeries(next);
      setSelection(selection);
      if (targetSeries && targetCourse) {
        callContentApi("delete", {
          type: "course",
          series: targetSeries.name,
          name: targetCourse.name,
        }).catch((err: unknown) => onSaveError?.(`コース削除エラー: ${String(err)}`));
      }
    },
    [series, selectedSeriesId, selectedCourseId, selectedLessonId, setSeries, setSelection, onSaveError],
  );

  const addCourse = useCallback(
    (seriesId: string, name: string) => {
      const targetSeries = series.find((s) => s.id === seriesId);
      const newId = generateCourseId(name);
      setSeries((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          const newCourse: Course = {
            id: newId,
            name,
            target: "",
            cross_series_prev: [],
            cross_series_next: [],
            lessons: [],
          };
          return { ...s, courses: [...s.courses, newCourse] };
        }),
      );
      if (targetSeries) {
        callContentApi("create", {
          type: "course",
          series: targetSeries.name,
          name,
          id: newId,
        }).catch((err: unknown) => onSaveError?.(`コース追加エラー: ${String(err)}`));
      }
    },
    [series, setSeries, onSaveError],
  );

  const reorderSeries = useCallback(
    (fromIndex: number, toIndex: number) => {
      setSeries((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        saveSeriesOrder(next.map((s) => s.name)).catch((err: unknown) => {
          onSaveError?.(`シリーズ順序保存エラー: ${String(err)}`);
        });
        return next;
      });
    },
    [setSeries, onSaveError],
  );

  const reorderCourses = useCallback(
    (seriesId: string, fromIndex: number, toIndex: number) => {
      setSeries((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          const courses = [...s.courses];
          const [moved] = courses.splice(fromIndex, 1);
          courses.splice(toIndex, 0, moved);
          callContentApi("reorder", {
            type: "course",
            series: s.name,
            newOrder: courses.map((c) => c.name),
          }).catch((err: unknown) =>
            onSaveError?.(`コース並び替えエラー: ${String(err)}`),
          );
          return { ...s, courses };
        }),
      );
    },
    [setSeries, onSaveError],
  );

  const updateCourseMeta = useCallback(
    (
      courseId: string,
      meta: Pick<
        Course,
        | "name"
        | "target"
        | "style"
        | "cross_series_prev"
        | "cross_series_next"
        | "is_start"
        | "is_goal"
      > &
        // 公開フィールドは「undefined＝変更しない / 空文字＝削除 / 値＝設定」
        Partial<Pick<Course, "slug" | "catch" | "description">>,
    ) => {
      let oldCourseName: string | undefined;
      let seriesName: string | undefined;
      for (const s of series) {
        const c = s.courses.find((co) => co.id === courseId);
        if (c) {
          oldCourseName = c.name;
          seriesName = s.name;
          break;
        }
      }
      if (!seriesName) return;

      const crossSeriesPrev = filterCrossSeriesIds(
        series,
        courseId,
        meta.cross_series_prev ?? [],
      );
      const crossSeriesNext = filterCrossSeriesIds(
        series,
        courseId,
        meta.cross_series_next ?? [],
      );
      const synced = applyCrossSeriesCourseMetaEdit(
        series,
        courseId,
        crossSeriesPrev,
        crossSeriesNext,
      );
      const next = synced.map((s) => ({
        ...s,
        courses: s.courses.map((c) => {
          if (c.id !== courseId) return c;
          const newName = meta.name?.trim() || c.name;
          return {
            ...c,
            name: newName,
            target: meta.target,
            style: meta.style,
            // undefined は「変更しない」、空文字は「削除」
            slug:
              meta.slug !== undefined ? meta.slug.trim() || undefined : c.slug,
            catch:
              meta.catch !== undefined
                ? meta.catch.trim() || undefined
                : c.catch,
            description:
              meta.description !== undefined
                ? meta.description.trim() || undefined
                : c.description,
            is_start: meta.is_start ?? false,
            is_goal: meta.is_goal ?? false,
            lessons: c.lessons.map((l) => ({ ...l, course: newName })),
          };
        }),
      }));

      const updatedBeforeRemap = next
        .flatMap((s) => s.courses)
        .find((c) => c.id === courseId);
      if (!updatedBeforeRemap) return;

      let finalSeries = next;
      let newCourseId = courseId;
      if (oldCourseName && oldCourseName !== updatedBeforeRemap.name) {
        const remapped = remapCourseAndLessonIds(
          next,
          courseId,
          seriesName,
          updatedBeforeRemap.name,
        );
        finalSeries = remapped.series;
        newCourseId = remapped.remap.courseIds.get(courseId) ?? courseId;
        setSelection(
          remapSelection(
            { seriesId: selectedSeriesId, courseId: selectedCourseId, lessonId: selectedLessonId },
            remapped.remap,
          ),
        );
      }

      setSeries(finalSeries);

      const updatedCourse = finalSeries
        .flatMap((s) => s.courses)
        .find((c) => c.id === newCourseId);
      if (!updatedCourse) return;

      const toPersist = listCoursesNeedingMetaPersist(
        series,
        finalSeries,
        newCourseId,
      );
      const persistAll = () =>
        persistCourseMetas(toPersist).catch((err: unknown) => {
          onSaveError?.(`コースメタ保存エラー: ${String(err)}`);
        });

      if (oldCourseName && oldCourseName !== updatedCourse.name) {
        callContentApi("rename", {
          type: "course",
          series: seriesName,
          oldName: oldCourseName,
          newName: updatedCourse.name,
        })
          .then(persistAll)
          .catch((err: unknown) =>
            onSaveError?.(`コースリネームエラー: ${String(err)}`),
          );
      } else {
        persistAll();
      }
    },
    [series, selectedSeriesId, selectedCourseId, selectedLessonId, setSeries, setSelection, onSaveError],
  );

  /** シリーズの公開フィールド（slug / catch / description）を保存する。空文字はキー削除 */
  const updateSeriesMeta = useCallback(
    (
      seriesId: string,
      meta: { slug?: string; catch?: string; description?: string },
    ) => {
      const target = series.find((s) => s.id === seriesId);
      if (!target) return;
      setSeries((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          return {
            ...s,
            slug:
              meta.slug !== undefined ? meta.slug.trim() || undefined : s.slug,
            catch:
              meta.catch !== undefined
                ? meta.catch.trim() || undefined
                : s.catch,
            description:
              meta.description !== undefined
                ? meta.description.trim() || undefined
                : s.description,
          };
        }),
      );
      callContentApi("save-series", {
        series: target.name,
        ...(meta.slug !== undefined ? { slug: meta.slug.trim() } : {}),
        ...(meta.catch !== undefined ? { catch: meta.catch } : {}),
        ...(meta.description !== undefined
          ? { description: meta.description }
          : {}),
      }).catch((err: unknown) =>
        onSaveError?.(`シリーズメタ保存エラー: ${String(err)}`),
      );
    },
    [series, setSeries, onSaveError],
  );

  const updateSeriesName = useCallback(
    (seriesId: string, name: string) => {
      const target = series.find((s) => s.id === seriesId);
      if (!target) return;
      const newName = name.trim() || target.name;
      if (newName === target.name) return;

      const { series: next, remap } = applySeriesRename(series, seriesId, newName);
      setSeries(next);
      setSelection(
        remapSelection(
          { seriesId: selectedSeriesId, courseId: selectedCourseId, lessonId: selectedLessonId },
          remap,
        ),
      );

      callContentApi("rename", {
        type: "series",
        oldName: target.name,
        newName,
      }).catch((err: unknown) =>
        onSaveError?.(`シリーズリネームエラー: ${String(err)}`),
      );
    },
    [series, selectedSeriesId, selectedCourseId, selectedLessonId, setSeries, setSelection, onSaveError],
  );

  return {
    addSeries,
    deleteSeries,
    addCourse,
    deleteCourse,
    reorderSeries,
    reorderCourses,
    updateCourseMeta,
    updateSeriesMeta,
    updateSeriesName,
  };
}
