import { describe, expect, it } from "vitest";
import {
  buildWebSearchPlanMessages,
  parseWebSearchPlanResponse,
} from "@/lib/web-image-search-plan";
import type { Lesson } from "@/lib/schema";

describe("parseWebSearchPlanResponse", () => {
  it("parses valid JSON plan", () => {
    const plan = parseWebSearchPlanResponse(
      JSON.stringify({
        queries: [
          { q: "office meeting", media: "photo" },
          { q: "teamwork flat", media: "illustration" },
        ],
      }),
    );
    expect(plan.queries).toHaveLength(2);
    expect(plan.queries[0]).toEqual({ q: "office meeting", media: "photo" });
  });

  it("caps queries at three", () => {
    const plan = parseWebSearchPlanResponse(
      JSON.stringify({
        queries: [
          { q: "a", media: "photo" },
          { q: "b", media: "photo" },
          { q: "c", media: "photo" },
          { q: "d", media: "photo" },
        ],
      }),
    );
    expect(plan.queries).toHaveLength(3);
  });

  it("strips markdown fences", () => {
    const plan = parseWebSearchPlanResponse(
      '```json\n{"queries":[{"q":"laptop work","media":"photo"}]}\n```',
    );
    expect(plan.queries[0].q).toBe("laptop work");
  });

  it("throws on invalid media", () => {
    expect(() =>
      parseWebSearchPlanResponse(
        JSON.stringify({ queries: [{ q: "test", media: "vector" }] }),
      ),
    ).toThrow("no valid queries");
  });

  it("throws on empty queries", () => {
    expect(() =>
      parseWebSearchPlanResponse(JSON.stringify({ queries: [] })),
    ).toThrow("no queries");
  });
});

describe("buildWebSearchPlanMessages の lesson 任意化", () => {
  const lesson: Lesson = {
    id: "l1",
    series: "s",
    course: "c",
    lesson: "Git 入門",
    status: "open",
    description: "バージョン管理の基礎",
    tags: ["git"],
    estimated_minutes: 10,
    author: "",
    content: "本文サンプル",
  };

  it("lesson があればレッスン metadata と本文全文を含める", () => {
    const { user } = buildWebSearchPlanMessages(lesson, "会議室の写真");
    expect(user).toContain("会議室の写真");
    expect(user).toContain("## Lesson metadata");
    expect(user).toContain("## Full lesson markdown body");
    expect(user).toContain("本文サンプル");
  });

  it("lesson が無ければ文脈ブロックを含めず検索指示だけを渡す", () => {
    const { user } = buildWebSearchPlanMessages(undefined, "会議室の写真");
    expect(user).toContain("会議室の写真");
    expect(user).not.toContain("## Lesson metadata");
    expect(user).not.toContain("## Full lesson markdown body");
  });
});
