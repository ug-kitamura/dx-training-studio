import { buildLessonId } from "@/lib/content-ids";
import type { Series } from "@/lib/schema";
import type { WorkspaceSelection } from "@/lib/workspace-selection";

export type IdRemap = {
  courseIds: Map<string, string>;
  lessonIds: Map<string, string>;
};

export function remapSelection(
  selection: WorkspaceSelection,
  remap: IdRemap,
): WorkspaceSelection {
  return {
    // シリーズの安定 ID はリネームで変わらないため remap 対象に含めない
    seriesId: selection.seriesId,
    courseId: remap.courseIds.get(selection.courseId) ?? selection.courseId,
    lessonId: remap.lessonIds.get(selection.lessonId) ?? selection.lessonId,
  };
}

/** シリーズ名変更: 安定 ID は維持し、表示名とレッスン ID のみ更新 */
export function applySeriesRename(
  allSeries: Series[],
  seriesId: string,
  newSeriesName: string,
): { series: Series[]; remap: IdRemap } {
  const lessonIds = new Map<string, string>();

  const next = allSeries.map((s) => {
    if (s.id !== seriesId) return s;
    return {
      ...s,
      name: newSeriesName,
      courses: s.courses.map((c) => ({
        ...c,
        lessons: c.lessons.map((l) => {
          const newLessonId = buildLessonId(newSeriesName, c.name, l.lesson);
          lessonIds.set(l.id, newLessonId);
          return { ...l, series: newSeriesName, id: newLessonId };
        }),
      })),
    };
  });

  return {
    series: next,
    remap: { courseIds: new Map(), lessonIds },
  };
}

/** コース名変更: 安定 ID は維持し、レッスン ID のみ更新 */
export function remapCourseAndLessonIds(
  allSeries: Series[],
  courseId: string,
  seriesName: string,
  newCourseName: string,
): { series: Series[]; remap: IdRemap } {
  const lessonIds = new Map<string, string>();

  const next = allSeries.map((s) => ({
    ...s,
    courses: s.courses.map((c) => {
      if (c.id !== courseId) return c;
      return {
        ...c,
        name: newCourseName,
        lessons: c.lessons.map((l) => {
          const newLessonId = buildLessonId(seriesName, newCourseName, l.lesson);
          lessonIds.set(l.id, newLessonId);
          return { ...l, id: newLessonId };
        }),
      };
    }),
  }));

  return {
    series: next,
    remap: { courseIds: new Map(), lessonIds },
  };
}
