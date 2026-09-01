/**
 * 公開サイトの表示ラベル語彙。生成物に依存しない純粋な部分だけを置く。
 *
 * ⚠ **このモジュールは Studio の parity テストがアプリ境界を越えて読む。**
 * （`studio/__tests__/lib/lesson-label-locale.parity.test.ts`）
 *
 * そのため **`content/site-data.json` などのビルド生成物へ依存させてはならない。**
 * 越境で読まれるファイルは Studio 側の `tsconfig.json` の設定だけで型検査が通る
 * 必要があり、生成物は git 管理外で Studio の `@/*`（= `studio/*`）では解決できない。
 * 依存を足すと `next build` の型検査が落ちる——Next はテスト自身のエラーは捨てるが、
 * テストが引きずり込んだ `__tests__` の外のファイルのエラーは捨てないため。
 *
 * 生成物を読む側は `./site-data` に置くこと。こちらはそこから import する側で、
 * 逆向きの依存を作ってはならない。
 */
import type { Locale } from "./locale-path";

export type LessonStatus = "open" | "in_progress" | "done";

/** コースの受講形態。正本 `.meta.json` の `style` */
export type CourseStyle = "self-study" | "lecture" | "hands-on";

export function formatMinutes(minutes: number, locale: Locale): string {
  return locale === "en" ? `${minutes} min` : `${minutes}分`;
}

const COURSE_STYLE_LABELS_JA: Record<CourseStyle, string> = {
  "self-study": "独習",
  lecture: "講義",
  "hands-on": "ハンズオン",
};

/** 受講形態の表示ラベル。英語は値そのまま（小文字） */
export function formatCourseStyle(
  style: CourseStyle | undefined,
  locale: Locale,
): string | undefined {
  if (!style) return undefined;
  return locale === "en" ? style : COURSE_STYLE_LABELS_JA[style];
}

/**
 * 執筆状況の表示ラベル。語彙は Studio（`lib/schema.ts`）に揃える——
 * 目次でもレッスンページでも同じ言葉を出すため、対応はここ1箇所だけに置く。
 * `done` はどちらにも表示しない。
 */
const LESSON_STATUS_LABELS: Record<
  Exclude<LessonStatus, "done">,
  { ja: string; en: string }
> = {
  open: { ja: "未着手", en: "open" },
  in_progress: { ja: "作成中", en: "in progress" },
};

export function formatLessonStatus(
  status: LessonStatus,
  locale: Locale,
): string | undefined {
  if (status === "done") return undefined;
  return LESSON_STATUS_LABELS[status][locale];
}
