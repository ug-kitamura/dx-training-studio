import { describe, expect, it } from "vitest";
import {
  lessonFileTextEquals,
  normalizeLessonFileNewlines,
} from "@/lib/lesson-file-text";

describe("lesson-file-text", () => {
  it("normalizes CRLF to LF", () => {
    expect(normalizeLessonFileNewlines("a\r\nb")).toBe("a\nb");
  });

  it("treats CRLF and LF as equal", () => {
    expect(lessonFileTextEquals("a\r\nb", "a\nb")).toBe(true);
  });
});
