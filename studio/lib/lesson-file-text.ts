/** レッスン .md をリポジトリ上 LF で統一する */
export function normalizeLessonFileNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/** 改行正規化後に同一か（CRLF / LF の差は無視） */
export function lessonFileTextEquals(a: string, b: string): boolean {
  if (a === b) return true;
  return normalizeLessonFileNewlines(a) === normalizeLessonFileNewlines(b);
}
