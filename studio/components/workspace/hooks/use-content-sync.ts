"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Series } from "@/lib/schema";
import { normalizeSeriesCourseMeta } from "@/lib/course-flow";
import {
  resolveSelectionAfterContentReload,
  type WorkspaceSelection,
} from "@/lib/workspace-selection";

const POLL_INTERVAL_MS = 3000;

export function useContentSync(options: {
  /** 現在の series state（編集中レッスン content を保護するために使用） */
  series: Series[];
  selectedSeriesId: string;
  selectedCourseId: string;
  selectedLessonId: string;
  onSeriesLoaded: (newSeries: Series[]) => void;
  onSelectionChange: (selection: WorkspaceSelection) => void;
  onLessonDiskSynced?: (lessonId: string) => void;
}) {
  const {
    series,
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    onSeriesLoaded,
    onSelectionChange,
    onLessonDiskSynced,
  } = options;

  const lastFingerprintRef = useRef("");
  const seriesRef = useRef(series);
  const selectedSeriesIdRef = useRef(selectedSeriesId);
  const selectedCourseIdRef = useRef(selectedCourseId);
  const selectedLessonIdRef = useRef(selectedLessonId);
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    seriesRef.current = series;
  }, [series]);

  useEffect(() => {
    selectedSeriesIdRef.current = selectedSeriesId;
  }, [selectedSeriesId]);

  useEffect(() => {
    selectedCourseIdRef.current = selectedCourseId;
  }, [selectedCourseId]);

  useEffect(() => {
    selectedLessonIdRef.current = selectedLessonId;
  }, [selectedLessonId]);

  /** デバウンス保存中のみ true。外部変更の取り込みを妨げないよう限定して使う */
  const setPendingSave = useCallback((pending: boolean) => {
    pendingSaveRef.current = pending;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchAndMerge() {
      try {
        const mtimeRes = await fetch("/api/content/mtime", { cache: "no-store" });
        if (!mtimeRes.ok || cancelled) return;
        const { fingerprint } = (await mtimeRes.json()) as {
          mtime: number;
          fingerprint: string;
        };

        if (lastFingerprintRef.current === "") {
          lastFingerprintRef.current = fingerprint;
          return;
        }
        if (fingerprint === lastFingerprintRef.current) return;
        lastFingerprintRef.current = fingerprint;

        const dataRes = await fetch("/api/content/load", { cache: "no-store" });
        if (!dataRes.ok || cancelled) return;
        const freshSeries = (await dataRes.json()) as Series[];

        const normalized = normalizeSeriesCourseMeta(freshSeries);

        const currentSelection: WorkspaceSelection = {
          seriesId: selectedSeriesIdRef.current,
          courseId: selectedCourseIdRef.current,
          lessonId: selectedLessonIdRef.current,
        };
        const nextSelection = resolveSelectionAfterContentReload(
          seriesRef.current,
          normalized,
          currentSelection,
        );

        const preserveEditor =
          pendingSaveRef.current && selectedLessonIdRef.current;
        const editingLesson = preserveEditor
          ? findLessonById(seriesRef.current, selectedLessonIdRef.current)
          : null;
        const preserveLessonId = editingLesson ? nextSelection.lessonId : "";

        const merged = normalized.map((s) => ({
          ...s,
          courses: s.courses.map((c) => ({
            ...c,
            lessons: c.lessons.map((l) => {
              if (editingLesson && preserveLessonId && l.id === preserveLessonId) {
                return { ...l, content: editingLesson.content };
              }
              if (l.id === selectedLessonIdRef.current) {
                onLessonDiskSynced?.(l.id);
              }
              return l;
            }),
          })),
        }));

        if (
          nextSelection.seriesId !== currentSelection.seriesId ||
          nextSelection.courseId !== currentSelection.courseId ||
          nextSelection.lessonId !== currentSelection.lessonId
        ) {
          onSelectionChange(nextSelection);
        }
        onSeriesLoaded(merged);
      } catch {
        /* ネットワークエラーは無視 */
      }
    }

    const timer = setInterval(() => {
      void fetchAndMerge();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [onSeriesLoaded, onSelectionChange, onLessonDiskSynced]);

  return { setPendingSave };
}

function findLessonById(series: Series[], lessonId: string) {
  for (const s of series) {
    for (const c of s.courses) {
      for (const l of c.lessons) {
        if (l.id === lessonId) return l;
      }
    }
  }
  return null;
}
