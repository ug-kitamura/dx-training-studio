import { describe, expect, it } from "vitest";
import {
  AI_MODEL_OPTIONS,
  DEFAULT_AI_MODEL,
  isAiModelSlug,
  normalizeAiModel,
} from "@/lib/ai-models";

describe("AI_MODEL_OPTIONS", () => {
  it("lists the five selectable models in order", () => {
    expect(AI_MODEL_OPTIONS.map((o) => o.slug)).toEqual([
      "gpt-5-nano",
      "claude-haiku-4-5",
      "claude-sonnet-5",
      "claude-opus-5",
      "claude-fable-5",
    ]);
  });

  it("labels claude-opus-5 as Claude Opus 5", () => {
    const opus = AI_MODEL_OPTIONS.find((o) => o.slug === "claude-opus-5");
    expect(opus?.label).toBe("Claude Opus 5");
  });
});

describe("normalizeAiModel", () => {
  it("keeps a slug that is still on the list", () => {
    expect(normalizeAiModel("claude-opus-5")).toBe("claude-opus-5");
  });

  // 一覧から外した slug（claude-sonnet-4-6 / claude-opus-4-7 / claude-opus-4-8）を
  // 保存済みのユーザーは、読み替えではなく既定値へ落とす
  it.each(["claude-sonnet-4-6", "claude-opus-4-7", "claude-opus-4-8"])(
    "falls back to the default for the removed slug %s",
    (removed) => {
      expect(isAiModelSlug(removed)).toBe(false);
      expect(normalizeAiModel(removed)).toBe(DEFAULT_AI_MODEL);
    },
  );

  it("falls back to the default for a non-string value", () => {
    expect(normalizeAiModel(undefined)).toBe(DEFAULT_AI_MODEL);
  });
});
