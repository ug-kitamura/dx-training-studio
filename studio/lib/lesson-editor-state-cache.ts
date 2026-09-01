import type { EditorState } from "@codemirror/state";

const cache = new Map<string, EditorState>();

export function getLessonEditorStateCache(
  lessonId: string,
): EditorState | undefined {
  return cache.get(lessonId);
}

export function setLessonEditorStateCache(
  lessonId: string,
  state: EditorState,
): void {
  cache.set(lessonId, state);
}

export function deleteLessonEditorStateCache(lessonId: string): void {
  cache.delete(lessonId);
}

/** テスト用 */
export function clearLessonEditorStateCache(): void {
  cache.clear();
}
