import type { CourseStyle, Lesson, LessonStatus } from "@/lib/schema";
import type { EditLanguage } from "@/lib/display-name";

/**
 * プレビューのメタラベル行の語彙（studio-translation spec）。
 *
 * ⚠ **公開サイト（`mandala/lib/site-labels.ts`）と一致していなければならない。**
 * Studio のプレビューは「デザインは公開サイトのレッスンページのラベル行と同一」を
 * 宣言しており、語彙が割れるとその宣言が嘘になる。突き合わせは parity テストが
 * 担保する（`__tests__/lib/lesson-label-locale.parity.test.ts`）——
 * **アプリ間の実行時依存は張らない**（mandala を import しない）ので、規則を
 * 変えるときは両方を直すこと。
 */

/** 執筆状況。⚠ `done` は日英どちらでもラベルを出さない */
const STATUS_LABELS_BY_LOCALE: Record<
  Exclude<LessonStatus, "done">,
  Record<EditLanguage, string>
> = {
  open: { ja: "未着手", en: "open" },
  in_progress: { ja: "作成中", en: "in progress" },
};

export function formatLessonStatusLabel(
  status: LessonStatus,
  language: EditLanguage,
): string | undefined {
  if (status === "done") return undefined;
  return STATUS_LABELS_BY_LOCALE[status][language];
}

/** 所要時間。英語は半角スペース区切りの `N min` */
export function formatMinutesLabel(
  minutes: number,
  language: EditLanguage,
): string | undefined {
  if (minutes <= 0) return undefined;
  return language === "en" ? `${minutes} min` : `${minutes}分`;
}

const COURSE_STYLE_LABELS_JA: Record<CourseStyle, string> = {
  "self-study": "独習",
  lecture: "講義",
  "hands-on": "ハンズオン",
};

/** 受講形態。⚠ 英語は style の値そのまま（サイトと同じ規則） */
export function formatCourseStyleLabel(
  style: CourseStyle | undefined,
  language: EditLanguage,
): string | undefined {
  if (!style) return undefined;
  return language === "en" ? style : COURSE_STYLE_LABELS_JA[style];
}

/** 「著者」の見出し語 */
export function authorLabel(language: EditLanguage): string {
  return language === "en" ? "author" : "著者";
}

/**
 * 著者名。**双方向フォールバック**——英語ビューは `author_en` → `author`、
 * 日本語ビューは `author` → `author_en`（`mandala/scripts/lib/emit.mts` と同じ規則）。
 * 表記が1つしか無い著者でも、どちらのビューでも名前が消えない。
 */
export function resolveAuthorName(
  lesson: Pick<Lesson, "author" | "author_en">,
  language: EditLanguage,
): string {
  const ja = lesson.author?.trim() ?? "";
  const en = lesson.author_en?.trim() ?? "";
  return language === "en" ? en || ja : ja || en;
}
