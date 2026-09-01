import { describe, expect, it } from "vitest";
import {
  buildTitleGenerationUserPrompt,
  hasTitleGenerationExchange,
  normalizeSessionTitle,
  truncateMessageContent,
} from "@/lib/agent/generate-session-title";

describe("generate-session-title", () => {
  it("truncates long message content", () => {
    const long = "あ".repeat(600);
    expect(truncateMessageContent(long)).toBe(`${"あ".repeat(500)}…`);
  });

  it("normalizes quotes and whitespace", () => {
    expect(normalizeSessionTitle('  "レッスン構成の相談"  ')).toBe(
      "レッスン構成の相談",
    );
  });

  it("truncates generated title to 40 chars without ellipsis", () => {
    const long = "あ".repeat(50);
    expect(normalizeSessionTitle(long)).toBe("あ".repeat(40));
  });

  it("builds user prompt from first exchange", () => {
    const prompt = buildTitleGenerationUserPrompt([
      { role: "user", content: "構成を相談したい" },
      { role: "assistant", content: "どのレッスンですか？" },
    ]);
    expect(prompt).toContain("User: 構成を相談したい");
    expect(prompt).toContain("Assistant: どのレッスンですか？");
  });

  it("requires both roles for title generation exchange", () => {
    expect(
      hasTitleGenerationExchange([{ role: "user", content: "hello" }]),
    ).toBe(false);
    expect(
      hasTitleGenerationExchange([
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
      ]),
    ).toBe(true);
  });
});
