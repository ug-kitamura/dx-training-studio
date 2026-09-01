import type { Lesson } from "@/lib/schema";

export function stripNumericPrefix(value: string): string {
  return value.replace(/^\d+_/, "");
}

export function matchLessonContentPath(
  files: Array<{ path: string; name: string }>,
  lesson: Pick<Lesson, "series" | "course" | "lesson">,
): string | null {
  for (const file of files) {
    const parts = file.path.split("/");
    if (parts.length < 5 || parts[0] !== "contents") continue;
    if (parts[parts.length - 1] !== "contents.md") continue;
    const fileLesson = stripNumericPrefix(parts[parts.length - 2]);
    const coursePart = stripNumericPrefix(parts[parts.length - 3]);
    const seriesPart = stripNumericPrefix(parts[parts.length - 4]);
    if (
      fileLesson === lesson.lesson &&
      coursePart === lesson.course &&
      seriesPart === lesson.series
    ) {
      return file.path;
    }
  }
  return null;
}

export function buildCreateDraftVariables(options: {
  lesson: Lesson;
  lessonBody: string;
  courseMeta: Record<string, unknown>;
  availableTags?: string[];
}): Record<string, string> {
  const { lesson, lessonBody, courseMeta, availableTags = [] } = options;
  const lessonMeta = {
    status: lesson.status,
    tags: lesson.tags,
    description: lesson.description,
    estimated_minutes: lesson.estimated_minutes,
    author: lesson.author,
  };
  return {
    series: lesson.series,
    course: lesson.course,
    lesson: lesson.lesson,
    lessonBody,
    courseMeta: JSON.stringify(courseMeta, null, 2),
    lessonMeta: JSON.stringify(lessonMeta, null, 2),
    availableTags: JSON.stringify(availableTags, null, 2),
  };
}

export function buildCreateStructureVariables(
  seriesList: unknown[],
): Record<string, string> {
  return {
    seriesList: JSON.stringify(seriesList, null, 2),
  };
}
