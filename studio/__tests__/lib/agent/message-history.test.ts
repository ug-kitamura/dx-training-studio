import { describe, expect, it } from "vitest";
import { clientMessagesToLlmMessages } from "@/lib/agent/message-history";

describe("clientMessagesToLlmMessages", () => {
  it("replays logical turns in chronological order before user OK", () => {
    const messages = clientMessagesToLlmMessages([
      { role: "user", content: "/minutes-maid" },
      {
        role: "assistant",
        content:
          "output/minutes-2026-07-13.md を保存しました。問題なければ「OK」とお知らせください。",
        toolTurns: [
          {
            toolCalls: [
              {
                id: "tu_read",
                name: "read_file",
                input: { path: "meeting.vtt" },
                result: JSON.stringify({
                  path: "workspace/demo/meeting.vtt",
                  content: "WEBVTT\n話者A",
                }),
              },
            ],
          },
          {
            toolCalls: [
              {
                id: "tu_write",
                name: "write_file",
                input: { path: "output/minutes.md", content: "# draft" },
                result: JSON.stringify({
                  path: "workspace/demo/output/minutes.md",
                  bytes: 7,
                }),
              },
            ],
          },
          {
            text: "output/minutes-2026-07-13.md を保存しました。問題なければ「OK」とお知らせください。",
          },
        ],
      },
      { role: "user", content: "OK" },
    ]);

    expect(messages[0]).toEqual({ role: "user", content: "/minutes-maid" });

    const readAssistant = messages[1];
    expect(readAssistant.role).toBe("assistant");
    expect(readAssistant.content).toEqual([
      {
        type: "tool_use",
        id: "tu_read",
        name: "read_file",
        input: { path: "meeting.vtt" },
      },
    ]);

    const readResult = messages[2];
    expect(readResult.role).toBe("user");
    expect(readResult.content).toEqual([
      {
        type: "tool_result",
        tool_use_id: "tu_read",
        content: expect.stringContaining("WEBVTT"),
      },
    ]);

    const writeAssistant = messages[3];
    expect(writeAssistant.content).toEqual([
      expect.objectContaining({
        type: "tool_use",
        id: "tu_write",
        name: "write_file",
      }),
    ]);

    const confirmAssistant = messages[5];
    expect(confirmAssistant).toEqual({
      role: "assistant",
      content: [
        {
          type: "text",
          text: "output/minutes-2026-07-13.md を保存しました。問題なければ「OK」とお知らせください。",
        },
      ],
    });

    expect(messages[6]).toEqual({ role: "user", content: "OK" });
  });

  it("falls back to legacy toolEvents without crashing", () => {
    const messages = clientMessagesToLlmMessages([
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: "done",
        toolEvents: [
          {
            phase: "start",
            name: "read_file",
            toolUseId: "t1",
            input: { path: "a.md" },
            display: "read",
          },
          {
            phase: "end",
            name: "read_file",
            toolUseId: "t1",
            display: "read",
            result: JSON.stringify({ path: "a.md", content: "x" }),
          },
        ],
      },
    ]);

    expect(messages.some((m) => m.role === "assistant")).toBe(true);
    expect(
      messages.some(
        (m) =>
          Array.isArray(m.content) &&
          m.content.some((b) => b.type === "tool_result"),
      ),
    ).toBe(true);
  });
});
