"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Course, Lesson, Series } from "@/lib/schema";
import {
  focusCourse,
  focusHome,
  focusLesson,
  focusSeries,
  resolveInitialSelection,
  resolveSelectionAfterContentReload,
  saveStoredSelection,
  selectionLevel,
  type WorkspaceSelection,
} from "@/lib/workspace-selection";

export function useWorkspaceSelection(options: {
  series: Series[];
  initialSeriesId: string;
  initialCourseId: string;
  initialLessonId: string;
}) {
  const { series, initialSeriesId, initialCourseId, initialLessonId } = options;
  const fallback = useMemo(
    (): WorkspaceSelection => ({
      seriesId: initialSeriesId,
      courseId: initialCourseId,
      lessonId: initialLessonId,
    }),
    [initialSeriesId, initialCourseId, initialLessonId],
  );

  const [selectedSeriesId, setSelectedSeriesId] = useState(initialSeriesId);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId);
  const [selectedLessonId, setSelectedLessonId] = useState(initialLessonId);
  const skipPersistRef = useRef(true);
  const hasResolvedInitialRef = useRef(false);
  const prevSeriesRef = useRef(series);
  const selectedSeriesIdRef = useRef(selectedSeriesId);
  const selectedCourseIdRef = useRef(selectedCourseId);
  const selectedLessonIdRef = useRef(selectedLessonId);

  const applySelection = useCallback((selection: WorkspaceSelection) => {
    setSelectedSeriesId(selection.seriesId);
    setSelectedCourseId(selection.courseId);
    setSelectedLessonId(selection.lessonId);
  }, []);

  useEffect(() => {
    selectedSeriesIdRef.current = selectedSeriesId;
  }, [selectedSeriesId]);

  useEffect(() => {
    selectedCourseIdRef.current = selectedCourseId;
  }, [selectedCourseId]);

  useEffect(() => {
    selectedLessonIdRef.current = selectedLessonId;
  }, [selectedLessonId]);

  useEffect(() => {
    if (!hasResolvedInitialRef.current) {
      applySelection(resolveInitialSelection(series, fallback));
      skipPersistRef.current = false;
      hasResolvedInitialRef.current = true;
    } else if (prevSeriesRef.current !== series) {
      applySelection(
        resolveSelectionAfterContentReload(prevSeriesRef.current, series, {
          seriesId: selectedSeriesIdRef.current,
          courseId: selectedCourseIdRef.current,
          lessonId: selectedLessonIdRef.current,
        }),
      );
    }
    prevSeriesRef.current = series;
  }, [series, fallback, applySelection]);

  useEffect(() => {
    if (skipPersistRef.current) return;
    saveStoredSelection({
      seriesId: selectedSeriesId,
      courseId: selectedCourseId,
      lessonId: selectedLessonId,
    });
  }, [selectedSeriesId, selectedCourseId, selectedLessonId]);

  const selectedCourse = useMemo((): Course | undefined => {
    for (const s of series) {
      const c = s.courses.find((c) => c.id === selectedCourseId);
      if (c) return c;
    }
    return undefined;
  }, [series, selectedCourseId]);

  const selectedLesson = useMemo((): Lesson | undefined => {
    return selectedCourse?.lessons.find((l) => l.id === selectedLessonId);
  }, [selectedCourse, selectedLessonId]);

  const selectedSeriesName = useMemo(() => {
    return series.find((s) => s.id === selectedSeriesId)?.name ?? "";
  }, [series, selectedSeriesId]);

  /** 最深の非空フィールドから導出したフォーカス階層。 */
  const focusLevel = useMemo(
    () =>
      selectionLevel({
        seriesId: selectedSeriesId,
        courseId: selectedCourseId,
        lessonId: selectedLessonId,
      }),
    [selectedSeriesId, selectedCourseId, selectedLessonId],
  );

  const setSelection = applySelection;

  // 以下は「クリックした階層で止まり、下位はクリアする」規則に従う
  const selectHome = useCallback(
    () => applySelection(focusHome()),
    [applySelection],
  );

  const selectSeries = useCallback(
    (seriesId: string) => applySelection(focusSeries(series, seriesId)),
    [series, applySelection],
  );

  const selectCourse = useCallback(
    (courseId: string) => applySelection(focusCourse(series, courseId)),
    [series, applySelection],
  );

  const selectLesson = useCallback(
    (lessonId: string) => applySelection(focusLesson(series, lessonId)),
    [series, applySelection],
  );

  return {
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    selectedCourse,
    selectedLesson,
    selectedSeriesName,
    focusLevel,
    selectHome,
    selectSeries,
    selectCourse,
    selectLesson,
    setSelection,
    setSelectedLessonId,
  };
}
