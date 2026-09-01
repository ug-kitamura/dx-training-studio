import type { Series } from "@/lib/schema";
import {
  decodeImageMarkdownSrc,
  isCanonicalImagePath,
  normalizeImageLogicalPath,
} from "@/lib/image-path";

const MD_IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/g;

export type ImageRefLocation = {
  seriesId: string;
  seriesName: string;
  courseId: string;
  courseName: string;
  lessonId: string;
  lessonName: string;
};

/** Markdown 本文から正本 `images/<filename>` 参照を抽出 */
export function extractImageRefs(content: string): string[] {
  const refs: string[] = [];
  for (const match of content.matchAll(MD_IMAGE_RE)) {
    const url = match[1]?.trim();
    if (!url || url.startsWith("data:")) continue;
    const normalized = normalizeImageLogicalPath(decodeImageMarkdownSrc(url));
    if (isCanonicalImagePath(normalized)) {
      refs.push(normalized);
    }
  }
  return refs;
}

/**
 * 1 レッスンが参照する正本 `images/...`（日本語本文と英語本文の両方）。
 *
 * ⚠ 編集言語で切り替えない——片方の言語でしか使われていない画像が `未使用` に
 * 見えると、削除確認の警告が出ないまま消され、もう一方の本文が参照切れになる。
 * 同じ画像を日英で使っていれば 2 回数える（出現回数の合計）。
 */
function lessonImageRefs(lesson: Series["courses"][number]["lessons"][number]): string[] {
  return [
    ...extractImageRefs(lesson.content),
    ...(lesson.content_en ? extractImageRefs(lesson.content_en) : []),
  ];
}

/** 全レッスンの日英本文における正本 `images/...` 出現回数 */
export function countImageRefsInSeries(series: Series[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of series) {
    for (const course of s.courses) {
      for (const lesson of course.lessons) {
        for (const ref of lessonImageRefs(lesson)) {
          counts.set(ref, (counts.get(ref) ?? 0) + 1);
        }
      }
    }
  }
  return counts;
}

/**
 * 正本パス → 参照しているレッスン位置（重複レッスン内複数 ref も複数行）。
 * ⚠ 位置に言語は持たせない——フィルタはレッスン単位なので区別が要らない。
 */
export function indexImageRefLocations(
  seriesList: Series[],
): Map<string, ImageRefLocation[]> {
  const index = new Map<string, ImageRefLocation[]>();
  for (const s of seriesList) {
    for (const course of s.courses) {
      for (const lesson of course.lessons) {
        const loc: ImageRefLocation = {
          seriesId: s.id,
          seriesName: s.name,
          courseId: course.id,
          courseName: course.name,
          lessonId: lesson.id,
          lessonName: lesson.lesson,
        };
        for (const ref of lessonImageRefs(lesson)) {
          const list = index.get(ref) ?? [];
          list.push(loc);
          index.set(ref, list);
        }
      }
    }
  }
  return index;
}

/** シリーズ Select「未使用」モード用 sentinel（実シリーズ ID ではない） */
export const FILTER_SERIES_UNUSED = "__unused__" as const;

export type UsedImageFilter = {
  seriesId: string | null;
  courseId: string | null;
  lessonId: string | null;
};

export function isSeriesUnusedFilter(filter: UsedImageFilter): boolean {
  return filter.seriesId === FILTER_SERIES_UNUSED;
}

export function isUsedImageFilterActive(filter: UsedImageFilter): boolean {
  if (isSeriesUnusedFilter(filter)) return true;
  return Boolean(filter.seriesId || filter.courseId || filter.lessonId);
}

/** フィルタ適用中: 未使用は非表示。選択スコープ内のレッスンが参照する path のみ true */
export function usedRowMatchesFilter(
  path: string,
  referenceCount: number,
  filter: UsedImageFilter,
  refLocations: Map<string, ImageRefLocation[]>,
): boolean {
  if (isSeriesUnusedFilter(filter)) {
    return referenceCount === 0;
  }
  if (!isUsedImageFilterActive(filter)) return true;
  if (referenceCount === 0) return false;
  const locs = refLocations.get(path) ?? [];
  return locs.some((loc) => {
    if (filter.lessonId) return loc.lessonId === filter.lessonId;
    if (filter.courseId) return loc.courseId === filter.courseId;
    if (filter.seriesId) return loc.seriesId === filter.seriesId;
    return true;
  });
}
