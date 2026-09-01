import { describe, expect, it } from "vitest";
import {
  buildSuggestPromptMessages,
  parseSuggestPromptResponse,
  snippetAroundOffset,
} from "@/lib/ai-image-suggest-prompt";
import type { Lesson } from "@/lib/schema";

const lesson: Lesson = {
  id: "l1",
  series: "Series",
  course: "Course",
  lesson: "Test",
  status: "open",
  description: "desc",
  tags: ["tag"],
  estimated_minutes: 10,
  author: "author",
  content: "---\nlesson: Test\n---\n\nbody",
};

describe("snippetAroundOffset", () => {
  it("extracts text around offset with ellipsis", () => {
    const text = "aaaaBBBBcccc";
    expect(snippetAroundOffset(text, 6, 4)).toBe("…aaBBBBcc…");
  });
});

describe("parseSuggestPromptResponse", () => {
  it("returns plain text", () => {
    expect(parseSuggestPromptResponse("  flow diagram  ")).toBe("flow diagram");
  });

  it("strips markdown fences", () => {
    expect(parseSuggestPromptResponse("```\nstep flow\n```")).toBe("step flow");
  });
});

describe("buildSuggestPromptMessages", () => {
  it("includes seed prompt when provided", () => {
    const { user } = buildSuggestPromptMessages(lesson, 0, "seed text");
    expect(user).toContain("Seed prompt");
    expect(user).toContain("seed text");
  });

  it("既定は日本語の指示のまま", () => {
    const { system } = buildSuggestPromptMessages(lesson, 0);
    expect(system).toContain("a Japanese DX training lesson editor");
    expect(system).toContain("Japanese is fine unless");
  });

  it("en では英語のプロンプトを書くよう指示する", () => {
    const { system } = buildSuggestPromptMessages(lesson, 0, undefined, "en");
    expect(system).toContain("an English DX training lesson editor");
    expect(system).toContain("Write the prompt in English");
    expect(system).not.toContain("Japanese is fine unless");
  });

  it("en ではレッスン名に name_en を使う", () => {
    const { user } = buildSuggestPromptMessages(
      { ...lesson, name_en: "Test lesson" },
      0,
      undefined,
      "en",
    );
    expect(user).toContain("lesson: Test lesson");
  });
});
