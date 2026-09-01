import { describe, expect, it } from "vitest";
import { summarizeToolPairs } from "@/components/workspace/AgentToolCallBlock";
import type { AgentToolEvent } from "@/lib/agent/llm/types";

function startEvent(id: string, display: string): AgentToolEvent {
  return {
    phase: "start",
    toolUseId: id,
    name: "tool",
    display,
  } as AgentToolEvent;
}

function endEvent(id: string, display: string): AgentToolEvent {
  return {
    phase: "end",
    toolUseId: id,
    name: "tool",
    display,
  } as AgentToolEvent;
}

describe("summarizeToolPairs", () => {
  it("実行中は最新ツールのみを表示する", () => {
    const pairs = [
      {
        start: startEvent("1", "読取: a.md"),
        end: endEvent("1", "読取: a.md"),
      },
      { start: startEvent("2", "作成: output") },
    ];
    expect(summarizeToolPairs(pairs)).toBe("作成: output を実行中…");
  });

  it("display の無い実行中ツールは汎用表記になる", () => {
    expect(
      summarizeToolPairs([
        {
          start: {
            phase: "start",
            toolUseId: "1",
            name: "t",
          } as AgentToolEvent,
        },
      ]),
    ).toBe("ツールを実行中…");
  });

  it("完了後は件数と動詞集計を表示する", () => {
    const pairs = [
      { end: endEvent("1", "読取: a.md") },
      { end: endEvent("2", "読取: b.md") },
      { end: endEvent("3", "読取: c.md") },
      { end: endEvent("4", "作成: output") },
      { end: endEvent("5", "書込: out.md") },
    ];
    expect(summarizeToolPairs(pairs)).toBe(
      "ツール実行 5件（読取 ×3・作成・書込）",
    );
  });

  it("1件だけなら display をそのまま使う", () => {
    expect(summarizeToolPairs([{ end: endEvent("1", "読取: a.md") }])).toBe(
      "読取: a.md",
    );
  });

  it("全角コロンや区切り無し display も1語として数える", () => {
    const pairs = [
      { end: endEvent("1", "検索：query") },
      { end: endEvent("2", "web_search") },
    ];
    expect(summarizeToolPairs(pairs)).toBe(
      "ツール実行 2件（検索・web_search）",
    );
  });
});
