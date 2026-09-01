export const LESSON_CONTENTS_FILENAME = "contents.md";
/** 英語版本文。日本語正本から派生し、1行目に原文ハッシュのコメントを持つ */
export const LESSON_CONTENTS_EN_FILENAME = "contents.en.md";
export const LESSON_SESSION_FILENAME = "session.json";
/** 各階層のメタ情報（id / order / target 等）。アプリが管理する */
export const CONTENT_META_FILENAME = ".meta.json";

export function lessonContentsRelativePath(
  series: string,
  course: string,
  lesson: string,
): string {
  return `contents/${series}/${course}/${lesson}/${LESSON_CONTENTS_FILENAME}`;
}
