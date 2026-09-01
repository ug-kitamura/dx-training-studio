"use client";

import type { Course, Lesson } from "@/lib/schema";
import type { EditLanguage } from "@/lib/display-name";
import {
  authorLabel,
  formatCourseStyleLabel,
  formatLessonStatusLabel,
  formatMinutesLabel,
  resolveAuthorName,
} from "@/lib/lesson-label-locale";

/**
 * プレビュー本文の上に出すレッスンメタのラベル行。
 * デザインは公開サイト（mandala）のレッスンページのラベル行と同一
 * （状態=赤系 / 所要時間=緑系 / 受講形態=青系、右端に著者）。
 * 受講形態だけはコースメタ（style）から取る。
 *
 * ⚠ **語彙も公開サイトと同一**（`lib/lesson-label-locale.ts`）。配色・形状だけ
 * 揃えて言葉が割れると、英語プレビューがサイトと違う英語を出す。
 */
export function LessonPreviewMetaRow({
  lesson,
  course,
  language = "ja",
}: {
  lesson: Lesson;
  course: Course | undefined;
  language?: EditLanguage;
}) {
  // 公開サイトと同じく「完成」はラベルを出さない
  const statusLabel = formatLessonStatusLabel(lesson.status, language);
  const minutesLabel = formatMinutesLabel(lesson.estimated_minutes, language);
  const styleLabel = formatCourseStyleLabel(course?.style, language);
  // 著者は双方向フォールバック——表記が1つしか無くても名前が消えない
  const author = resolveAuthorName(lesson, language);

  if (!statusLabel && !minutesLabel && !styleLabel && !author) return null;

  return (
    <div className="lesson-preview-meta">
      <div className="lesson-preview-meta-labels">
        {statusLabel ? (
          <span className="lesson-preview-meta-label lesson-preview-meta-status">
            {statusLabel}
          </span>
        ) : null}
        {minutesLabel ? (
          <span className="lesson-preview-meta-label lesson-preview-meta-minutes">
            {minutesLabel}
          </span>
        ) : null}
        {styleLabel ? (
          <span className="lesson-preview-meta-label lesson-preview-meta-style">
            {styleLabel}
          </span>
        ) : null}
      </div>
      {author ? (
        <span className="lesson-preview-meta-author">
          {authorLabel(language)}: {author}
        </span>
      ) : null}
    </div>
  );
}
