"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Lesson, Series } from "@/lib/schema";
import { buildLessonId } from "@/lib/content-ids";
import { remapSelection } from "@/lib/content-rename";
import { deleteLessonEditorStateCache } from "@/lib/lesson-editor-state-cache";
import { deleteLessonScrollMemory } from "@/lib/pane2-scroll-memory";
import { lessonFileTextEquals } from "@/lib/lesson-file-text";
import {
  applyLessonMetaPatch,
  defaultLessonBody,
  normalizeLessonMeta,
  metaToLessonFields,
  type LessonMetaFields,
} from "@/lib/lesson-meta";
import type { WorkspaceSelection } from "@/lib/workspace-selection";

const AUTOSAVE_DEBOUNCE_MS = 800;

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

async function saveLessonToFs(
  series: string,
  course: string,
  lesson: string,
  content: string,
): Promise<void> {
  const res = await fetch("/api/content/save-lesson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ series, course, lesson, content }),
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({ error: "保存エラー" }))) as {
      error: string;
    };
    throw new Error(error);
  }
}

/** レッスンメタを `.meta.json` へ保存する（本文の保存経路とは独立） */
async function saveLessonMetaToFs(lesson: Lesson): Promise<void> {
  const fields = metaToLessonFields(
    normalizeLessonMeta({}, {
      lesson: lesson.lesson,
      status: lesson.status,
      description: lesson.description,
      tags: lesson.tags,
      estimated_minutes: lesson.estimated_minutes,
      author: lesson.author,
      author_en: lesson.author_en,
      slug: lesson.slug,
    }),
  );
  const res = await fetch("/api/content/save-lesson-meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      series: lesson.series,
      course: lesson.course,
      lesson: lesson.lesson,
      meta: {
        status: fields.status,
        description: fields.description,
        tags: fields.tags,
        estimated_minutes: fields.estimated_minutes,
        author: fields.author,
        author_en: fields.author_en ?? "",
        slug: fields.slug ?? "",
      },
    }),
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({ error: "保存エラー" }))) as {
      error: string;
    };
    throw new Error(error);
  }
}

function findLessonInSeries(series: Series[], lessonId: string): Lesson | null {
  for (const s of series) {
    for (const c of s.courses) {
      for (const l of c.lessons) {
        if (l.id === lessonId) return l;
      }
    }
  }
  return null;
}

export function useLessonMutations(options: {
  series: Series[];
  setSeries: React.Dispatch<React.SetStateAction<Series[]>>;
  selectedSeriesId: string;
  selectedCourseId: string;
  selectedLessonId: string;
  setSelection: (selection: WorkspaceSelection) => void;
  setPendingSave?: (pending: boolean) => void;
  onSaveError?: (msg: string) => void;
}) {
  const {
    series,
    setSeries,
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    setSelection,
    setPendingSave,
    onSaveError,
  } = options;
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const seriesRef = useRef(series);
  /** 削除済みレッスン ID。非同期 create/save が完了しても FS を汚さない */
  const retiredLessonIdsRef = useRef(new Set<string>());

  useEffect(() => {
    seriesRef.current = series;
  }, [series]);

  const isLessonPersistable = useCallback((lessonId: string): boolean => {
    if (retiredLessonIdsRef.current.has(lessonId)) return false;
    return findLessonInSeries(seriesRef.current, lessonId) !== null;
  }, []);

  const retireLesson = useCallback((lessonId: string) => {
    retiredLessonIdsRef.current.add(lessonId);
    const timer = debounceTimers.current.get(lessonId);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.current.delete(lessonId);
    }
    deleteLessonEditorStateCache(lessonId);
    deleteLessonScrollMemory(lessonId);
  }, []);

  const cleanupLessonOnDisk = useCallback(
    (seriesName: string, courseName: string, lessonName: string) =>
      callContentApi("delete", {
        type: "lesson",
        series: seriesName,
        course: courseName,
        name: lessonName,
      }).catch(() => {
        /* 既に削除済みなら無視 */
      }),
    [],
  );

  const mapLessonById = useCallback(
    (
      lessonId: string,
      fn: (
        lesson: Lesson,
        ctx: { seriesName: string; courseName: string },
      ) => Lesson,
    ) => {
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) => ({
            ...c,
            lessons: c.lessons.map((l) =>
              l.id === lessonId
                ? fn(l, { seriesName: s.name, courseName: c.name })
                : l,
            ),
          })),
        })),
      );
    },
    [setSeries],
  );

  const cancelLessonDebounce = useCallback((lessonId: string) => {
    const timer = debounceTimers.current.get(lessonId);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.current.delete(lessonId);
    }
  }, []);

  const updateLessonContent = useCallback(
    (lessonId: string, content: string) => {
      if (!isLessonPersistable(lessonId)) return;

      let diskLesson: Lesson | null = null;
      let seriesName = "";
      let courseName = "";
      for (const s of seriesRef.current) {
        for (const c of s.courses) {
          for (const l of c.lessons) {
            if (l.id === lessonId) {
              diskLesson = l;
              seriesName = s.name;
              courseName = c.name;
            }
          }
        }
      }
      if (!diskLesson) return;

      const diskLessonName = diskLesson.lesson;

      if (lessonFileTextEquals(content, diskLesson.content)) {
        return;
      }

      // 本文はそのまま保存する。メタの書き戻し・正規化・保存拒否は無い
      //（メタの正本は `.meta.json`。本文の保存経路から独立している）
      mapLessonById(lessonId, (lesson) => ({ ...lesson, content }));

      const existing = debounceTimers.current.get(lessonId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        debounceTimers.current.delete(lessonId);
        if (!isLessonPersistable(lessonId)) return;

        setPendingSave?.(true);
        saveLessonToFs(seriesName, courseName, diskLessonName, content)
          .catch((err: unknown) => {
            if (!isLessonPersistable(lessonId)) return;
            onSaveError?.(`レッスン保存エラー: ${String(err)}`);
          })
          .finally(() => {
            setPendingSave?.(false);
          });
      }, AUTOSAVE_DEBOUNCE_MS);

      debounceTimers.current.set(lessonId, timer);
    },
    [isLessonPersistable, mapLessonById, setPendingSave, onSaveError],
  );

  const updateLessonMeta = useCallback(
    (lessonId: string, meta: Partial<LessonMetaFields>) => {
      if (!isLessonPersistable(lessonId)) return;

      let rename: {
        oldName: string;
        newName: string;
        series: string;
        course: string;
        newId: string;
      } | null = null;
      let updatedLesson: Lesson | null = null;

      const next = seriesRef.current.map((s) => ({
        ...s,
        courses: s.courses.map((c) => ({
          ...c,
          lessons: c.lessons.map((l) => {
            if (l.id !== lessonId) return l;
            const updated = applyLessonMetaPatch(l, meta);
            if (meta.lesson !== undefined && l.lesson !== updated.lesson) {
              const newId = buildLessonId(
                updated.series,
                updated.course,
                updated.lesson,
              );
              rename = {
                oldName: l.lesson,
                newName: updated.lesson,
                series: updated.series,
                course: updated.course,
                newId,
              };
              updatedLesson = { ...updated, id: newId };
              return updatedLesson;
            }
            updatedLesson = updated;
            return updated;
          }),
        })),
      }));

      if (!updatedLesson) return;

      setSeries(next);

      const persistMeta = () => {
        const target = updatedLesson!;
        if (!isLessonPersistable(rename ? rename.newId : lessonId)) return;
        return saveLessonMetaToFs(target).catch((err: unknown) => {
          if (!isLessonPersistable(rename ? rename.newId : lessonId)) return;
          onSaveError?.(`レッスンメタ保存エラー: ${String(err)}`);
        });
      };

      if (rename) {
        const { oldName, newName, series: seriesName, course: courseName, newId } =
          rename;
        setSelection(
          remapSelection(
            { seriesId: selectedSeriesId, courseId: selectedCourseId, lessonId },
            { courseIds: new Map(), lessonIds: new Map([[lessonId, newId]]) },
          ),
        );
        callContentApi("rename", {
          type: "lesson",
          series: seriesName,
          course: courseName,
          oldName,
          newName,
        })
          .then(persistMeta)
          .catch((err: unknown) => {
            onSaveError?.(`レッスンリネームエラー: ${String(err)}`);
          });
      } else {
        persistMeta();
      }
    },
    [isLessonPersistable, selectedSeriesId, selectedCourseId, setSeries, setSelection, onSaveError],
  );

  const updateLessonStatus = useCallback(
    (lessonId: string, status: Lesson["status"]) => {
      updateLessonMeta(lessonId, { status });
    },
    [updateLessonMeta],
  );

  const addLesson = useCallback(
    (courseId: string, lessonName: string) => {
      let seriesName = "";
      let courseName = "";
      for (const s of seriesRef.current) {
        const c = s.courses.find((co) => co.id === courseId);
        if (c) {
          seriesName = s.name;
          courseName = c.name;
          break;
        }
      }
      if (!seriesName || !courseName) return;

      const meta = normalizeLessonMeta({
        lesson: lessonName,
        status: "open",
        description: "",
        tags: [],
        estimated_minutes: 0,
        author: "",
      });
      const newLesson: Lesson = {
        id: buildLessonId(seriesName, courseName, lessonName),
        series: seriesName,
        course: courseName,
        ...metaToLessonFields(meta),
        content: defaultLessonBody(lessonName),
      };

      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) =>
            c.id === courseId
              ? { ...c, lessons: [...c.lessons, newLesson] }
              : c,
          ),
        })),
      );
      setSelection({ seriesId: selectedSeriesId, courseId, lessonId: newLesson.id });
      setPendingSave?.(true);
      callContentApi("create", {
        type: "lesson",
        series: seriesName,
        course: courseName,
        name: lessonName,
      })
        .then(() => {
          if (!isLessonPersistable(newLesson.id)) {
            return cleanupLessonOnDisk(seriesName, courseName, lessonName);
          }
          return saveLessonToFs(
            seriesName,
            courseName,
            newLesson.lesson,
            newLesson.content,
          );
        })
        .catch((err: unknown) => {
          if (!isLessonPersistable(newLesson.id)) return;
          onSaveError?.(`レッスン追加エラー: ${String(err)}`);
        })
        .finally(() => {
          setPendingSave?.(false);
        });
    },
    [
      cleanupLessonOnDisk,
      isLessonPersistable,
      selectedSeriesId,
      setSeries,
      setSelection,
      setPendingSave,
      onSaveError,
    ],
  );

  const deleteLesson = useCallback(
    (courseId: string, lessonId: string) => {
      let seriesName = "";
      let courseName = "";
      let lessonName = "";

      retireLesson(lessonId);

      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) => {
            if (c.id !== courseId) return c;
            const target = c.lessons.find((l) => l.id === lessonId);
            if (target) {
              seriesName = s.name;
              courseName = c.name;
              lessonName = target.lesson;
            }
            return { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) };
          }),
        })),
      );
      if (selectedLessonId === lessonId) {
        setSelection({ seriesId: selectedSeriesId, courseId: selectedCourseId, lessonId: "" });
      }
      if (seriesName && courseName && lessonName) {
        cleanupLessonOnDisk(seriesName, courseName, lessonName).catch(
          (err: unknown) => {
            onSaveError?.(`レッスン削除エラー: ${String(err)}`);
          },
        );
      }
    },
    [
      cleanupLessonOnDisk,
      onSaveError,
      retireLesson,
      selectedCourseId,
      selectedLessonId,
      selectedSeriesId,
      setSelection,
      setSeries,
    ],
  );

  const reorderLessons = useCallback(
    (courseId: string, fromIndex: number, toIndex: number) => {
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) => {
            if (c.id !== courseId) return c;
            const lessons = [...c.lessons];
            const [moved] = lessons.splice(fromIndex, 1);
            lessons.splice(toIndex, 0, moved);
            callContentApi("reorder", {
              type: "lesson",
              series: s.name,
              course: c.name,
              newOrder: lessons.map((l) => l.lesson),
            }).catch((err: unknown) => {
              onSaveError?.(`レッスン並び替えエラー: ${String(err)}`);
            });
            return { ...c, lessons };
          }),
        })),
      );
    },
    [setSeries, onSaveError],
  );

  /**
   * 英語版本文をツリー state に反映する。**state の更新だけで、fs 保存はしない**
   * ——英語版の保存は `use-lesson-en-body` が既に担っており、ここでも書くと
   * 保存経路が 2 本になる。
   *
   * 目的は、全レッスンを横断して数える処理（画像の参照走査）が編集直後の
   * 内容を見られるようにすること。日本語側の `updateLessonContent` が
   * state 更新と保存を兼ねているのと、更新の即時性だけを揃えている。
   */
  const updateLessonEnContent = useCallback(
    (lessonId: string, content: string) => {
      mapLessonById(lessonId, (lesson) =>
        lesson.content_en === content ? lesson : { ...lesson, content_en: content },
      );
    },
    [mapLessonById],
  );

  return {
    addLesson,
    deleteLesson,
    reorderLessons,
    updateLessonContent,
    updateLessonEnContent,
    updateLessonMeta,
    updateLessonStatus,
    cancelLessonDebounce,
  };
}
