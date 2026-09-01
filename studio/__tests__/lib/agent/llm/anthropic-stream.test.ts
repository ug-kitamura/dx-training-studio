import { describe, expect, it } from "vitest";
import {
  parseAnthropicStream,
  withMessagesCacheControl,
  withSystemCacheControl,
  withToolsCacheControl,
  toAnthropicMessages,
} from "@/lib/agent/llm/anthropic";
import type { ToolDefinition } from "@/lib/agent/llm/types";

function sseBody(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const text = events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe("parseAnthropicStream", () => {
  it("marks tool_use with invalid JSON as inputParseError", async () => {
    const body = sseBody([
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "tu1", name: "write_file" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: "{not-json" },
      },
      { type: "content_block_stop", index: 0 },
      {
        type: "message_delta",
        delta: { stop_reason: "tool_use" },
      },
    ]);

    let turn = null;
    for await (const event of parseAnthropicStream(body)) {
      if (event.type === "turn_complete") turn = event.result;
    }

    expect(turn?.toolCalls).toHaveLength(1);
    expect(turn?.toolCalls[0]).toMatchObject({
      id: "tu1",
      name: "write_file",
      input: {},
      inputParseError: true,
    });
  });

  it("parses valid tool_use JSON without inputParseError", async () => {
    const body = sseBody([
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "tu2", name: "read_file" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "input_json_delta",
          partial_json: '{"path":"notes.md"}',
        },
      },
      { type: "content_block_stop", index: 0 },
      {
        type: "message_delta",
        delta: { stop_reason: "tool_use" },
      },
    ]);

    let turn = null;
    for await (const event of parseAnthropicStream(body)) {
      if (event.type === "turn_complete") turn = event.result;
    }

    expect(turn?.toolCalls[0]).toEqual({
      id: "tu2",
      name: "read_file",
      input: { path: "notes.md" },
    });
  });
});

describe("withSystemCacheControl", () => {
  it("wraps a non-empty system string into a cached text block", () => {
    const result = withSystemCacheControl("You are a helpful agent.");
    expect(result).toEqual([
      {
        type: "text",
        text: "You are a helpful agent.",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("leaves an empty system string untouched", () => {
    expect(withSystemCacheControl("")).toBe("");
    expect(withSystemCacheControl("   ")).toBe("   ");
  });
});

describe("withToolsCacheControl", () => {
  const tool = (name: string): ToolDefinition => ({
    name,
    description: `desc-${name}`,
    input_schema: { type: "object", properties: {} },
  });

  it("returns undefined for an empty tools array", () => {
    expect(withToolsCacheControl([])).toBeUndefined();
  });

  it("tags only the last tool definition and leaves the original array untouched", () => {
    const tools = [tool("read_file"), tool("write_file"), tool("run_script")];
    const result = withToolsCacheControl(tools);

    expect(result).toHaveLength(3);
    expect(result?.[0].cache_control).toBeUndefined();
    expect(result?.[1].cache_control).toBeUndefined();
    expect(result?.[2].cache_control).toEqual({ type: "ephemeral" });
    // 元の配列・要素は変更しない（レジストリの共有オブジェクトを汚染しない）
    expect(tools[2].cache_control).toBeUndefined();
  });
});

describe("withMessagesCacheControl", () => {
  it("returns an empty array unchanged", () => {
    expect(withMessagesCacheControl([])).toEqual([]);
  });

  it("converts a string-content last message into a cached text block", () => {
    const messages = toAnthropicMessages([
      { role: "user", content: "earlier turn" },
      { role: "user", content: "latest turn" },
    ]);
    const result = withMessagesCacheControl(messages);

    expect(result[0]).toEqual({ role: "user", content: "earlier turn" });
    expect(result[1]).toEqual({
      role: "user",
      content: [
        {
          type: "text",
          text: "latest turn",
          cache_control: { type: "ephemeral" },
        },
      ],
    });
  });

  it("tags only the last block of the last message when content is a block array", () => {
    const messages = toAnthropicMessages([
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "t1", content: "ok" },
          { type: "text", text: "please continue" },
        ],
      },
    ]);
    const result = withMessagesCacheControl(messages);
    const content = result[0].content;
    if (typeof content === "string") throw new Error("expected block array");

    expect(content[0]).toEqual({
      type: "tool_result",
      tool_use_id: "t1",
      content: "ok",
    });
    expect(content[1]).toEqual({
      type: "text",
      text: "please continue",
      cache_control: { type: "ephemeral" },
    });
  });

  it("does not mutate the input array", () => {
    const messages = toAnthropicMessages([{ role: "user", content: "hello" }]);
    const before = JSON.stringify(messages);
    withMessagesCacheControl(messages);
    expect(JSON.stringify(messages)).toBe(before);
  });
});

describe("prompt cache breakpoint budget", () => {
  it("keeps the total number of breakpoints within the API limit of 4", () => {
    const tools = [
      { name: "a", description: "d", input_schema: {} },
      { name: "b", description: "d", input_schema: {} },
    ];
    const messages = withMessagesCacheControl(
      toAnthropicMessages([
        { role: "user", content: "old" },
        { role: "assistant", content: "reply" },
        { role: "user", content: "latest" },
      ]),
    );
    const system = withSystemCacheControl("system prompt");
    const cachedTools = withToolsCacheControl(tools);

    const countBreakpoints = (value: unknown): number => {
      if (Array.isArray(value)) {
        return value.reduce(
          (sum: number, item) => sum + countBreakpoints(item),
          0,
        );
      }
      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        const own = "cache_control" in record ? 1 : 0;
        return (
          own +
          Object.values(record).reduce(
            (sum: number, v) => sum + countBreakpoints(v),
            0,
          )
        );
      }
      return 0;
    };

    const total =
      countBreakpoints(system) +
      countBreakpoints(cachedTools) +
      countBreakpoints(messages);
    expect(total).toBeLessThanOrEqual(4);
    expect(total).toBe(3); // system 1 + tools 1(末尾のみ) + messages 1(末尾ブロックのみ)
  });
});
