import { Label, StatusLabel } from "@/components/Label";
import {
  formatCourseStyle,
  formatMinutes,
  type CourseStyle,
  type LessonStatus,
} from "@/lib/site-data";
import { localeOf } from "@/lib/locale-path";

export type LessonMetadata = {
  title?: string;
  seriesName?: string;
  seriesHref?: string;
  courseName?: string;
  courseHref?: string;
  lessonStatus?: LessonStatus;
  estimatedMinutes?: number;
  courseStyle?: CourseStyle;
  author?: string;
};

/**
 * レッスン本文の上に置くラベル行。
 * 値は変換スクリプトが frontmatter に入れたものを使う（MDX 側に手を入れない）。
 * パンくずはテーマ内蔵のものを使うのでここでは描かない。
 *
 * ⚠ 翻訳の状態は**ここに出さない**（publishing-site-build spec）。未翻訳は本文が
 * `Coming soon` になることで示し、翻訳の古さは Studio 側だけが伝える。
 * そのため `seriesHref` を持たないページ（変更履歴）はラベル行を持たない。
 */
export function LessonHeader({ metadata }: { metadata: LessonMetadata }) {
  const { seriesHref, lessonStatus, estimatedMinutes, courseStyle, author } =
    metadata;
  if (!seriesHref) return null;

  const locale = localeOf(seriesHref);
  const styleLabel = formatCourseStyle(courseStyle, locale);
  const hasLabels = Boolean(lessonStatus || estimatedMinutes || styleLabel);

  if (!hasLabels && !author) return null;

  return (
    <div className="dxm-lesson-header">
      <div className="dxm-lesson-labels">
        {lessonStatus && <StatusLabel status={lessonStatus} locale={locale} />}
        {estimatedMinutes ? (
          <Label kind="minutes">{formatMinutes(estimatedMinutes, locale)}</Label>
        ) : null}
        {styleLabel && <Label kind="style">{styleLabel}</Label>}
      </div>
      {author && (
        <span className="dxm-lesson-author">
          {locale === "en" ? "author" : "著者"}: {author}
        </span>
      )}
    </div>
  );
}
