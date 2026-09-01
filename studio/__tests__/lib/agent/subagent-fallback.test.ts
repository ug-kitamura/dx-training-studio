import { describe, expect, it } from "vitest";
import {
  SUBAGENT_KEYWORD,
  isLikelySubagentToolName,
  skillMentionsSubagent,
} from "@/lib/agent/subagent-fallback";

describe("skillMentionsSubagent", () => {
  it("detects the Japanese keyword", () => {
    expect(skillMentionsSubagent(`起動: ${SUBAGENT_KEYWORD}を使う`)).toBe(true);
  });

  it("ignores English-only wording", () => {
    expect(skillMentionsSubagent("Launch a subagent Task tool")).toBe(false);
  });
});

describe("isLikelySubagentToolName", () => {
  it("matches subagent and Task-like names", () => {
    expect(isLikelySubagentToolName("Task")).toBe(true);
    expect(isLikelySubagentToolName("task")).toBe(true);
    expect(isLikelySubagentToolName("task_launch")).toBe(true);
    expect(isLikelySubagentToolName("spawn_subagent")).toBe(true);
  });

  it("does not match unrelated tools", () => {
    expect(isLikelySubagentToolName("read_file")).toBe(false);
    expect(isLikelySubagentToolName("create_task_list")).toBe(false);
  });
});
