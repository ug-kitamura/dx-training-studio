import type { Series } from "@/lib/schema";

export const TAG_PATTERN = /^[a-z0-9-]+$/;

export function isValidTag(tag: string): boolean {
  return TAG_PATTERN.test(tag);
}

export function normalizeTagToken(raw: string): string {
  return raw.trim().replace(/^,+|,+$/g, "").trim().toLowerCase();
}

export function collectAllLessonTags(seriesList: Series[]): string[] {
  const seen = new Set<string>();
  for (const series of seriesList) {
    for (const course of series.courses) {
      for (const lesson of course.lessons) {
        for (const tag of lesson.tags) {
          if (tag) seen.add(tag);
        }
      }
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "ja"));
}
