import { describe, expect, it, beforeEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { history } from "@codemirror/commands";
import {
  clearLessonEditorStateCache,
  getLessonEditorStateCache,
  setLessonEditorStateCache,
} from "@/lib/lesson-editor-state-cache";

describe("lesson-editor-state-cache", () => {
  beforeEach(() => {
    clearLessonEditorStateCache();
  });

  it("stores and retrieves EditorState per lesson id", () => {
    const state = EditorState.create({
      doc: "hello",
      extensions: [history()],
    });
    setLessonEditorStateCache("lesson-a", state);
    expect(getLessonEditorStateCache("lesson-a")).toBe(state);
    expect(getLessonEditorStateCache("lesson-b")).toBeUndefined();
  });
});
