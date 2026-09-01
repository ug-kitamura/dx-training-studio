import { describe, expect, it } from "vitest";
import { buildCreateDraftVariables } from "@/lib/agent/invoke-context";
import type { Lesson } from "@/lib/schema";

describe("buildCreateDraftVariables", () => {
  const lesson: Lesson = {
    id: "1",
    series: "シリーズ",
    course: "コース",
    lesson: "レッスン",
    status: "open",
    description: "説明",
    tags: [],
    estimated_minutes: 10,
    author: "author",
    content: "---\nseries: シリーズ\n---\n\n本文",
  };

  it("does not include contextItems", () => {
    const variables = buildCreateDraftVariables({
      lesson,
      lessonBody: "本文",
      courseMeta: { name: "コース" },
    });
    expect(variables.contextItems).toBeUndefined();
    expect(JSON.parse(variables.lessonMeta)).toEqual({
      status: "open",
      tags: [],
      description: "説明",
      estimated_minutes: 10,
      author: "author",
    });
    expect(JSON.parse(variables.availableTags)).toEqual([]);
  });

  it("passes availableTags", () => {
    const variables = buildCreateDraftVariables({
      lesson,
      lessonBody: "本文",
      courseMeta: { name: "コース" },
      availableTags: ["git", "python"],
    });
    expect(JSON.parse(variables.availableTags)).toEqual(["git", "python"]);
  });
});
