import { describe, expect, it } from "vitest";
import {
  draftToMetaPatch,
  lessonToMetaDraft,
} from "@/components/workspace/LessonMetaPanel";
import type { Lesson } from "@/lib/schema";

const lesson: Lesson = {
  id: "lsn-1",
  series: "S",
  course: "C",
  lesson: "L",
  slug: "old-slug",
  status: "open",
  description: "",
  tags: [],
  estimated_minutes: 15,
  author: "Kitamura",
  content: "",
};

describe("lessonToMetaDraft / draftToMetaPatch の slug", () => {
  it("既存 slug が draft に載る", () => {
    expect(lessonToMetaDraft(lesson).slug).toBe("old-slug");
  });

  it("有効な slug は patch に含まれる", () => {
    const draft = { ...lessonToMetaDraft(lesson), slug: "new-slug" };
    const { patch, slugError } = draftToMetaPatch(draft, lesson);
    expect(slugError).toBeNull();
    expect(patch.slug).toBe("new-slug");
  });

  it("空文字は patch で空文字（キー削除）になる", () => {
    const draft = { ...lessonToMetaDraft(lesson), slug: "  " };
    const { patch, slugError } = draftToMetaPatch(draft, lesson);
    expect(slugError).toBeNull();
    expect(patch.slug).toBe("");
  });

  it("不正な slug はエラーになり patch は空", () => {
    const draft = { ...lessonToMetaDraft(lesson), slug: "Git基礎" };
    const { patch, slugError } = draftToMetaPatch(draft, lesson);
    expect(slugError).toContain("小文字英数とハイフン");
    expect(patch).toEqual({});
  });
});
