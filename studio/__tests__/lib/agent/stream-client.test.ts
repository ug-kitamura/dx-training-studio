import { describe, expect, it } from "vitest";
import {
  consumeAgentStream,
  type AgentStreamCallbacks,
  type ToolConfirmRequiredEvent,
} from "@/lib/agent/stream-client";
import { CONFIRM_KINDS } from "@/lib/agent/tools/confirm-kind";

type SseEvent = { event: string; data: unknown };

function sseResponse(events: SseEvent[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const { event, data } of events) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }
      controller.close();
    },
  });
  return new Response(body);
}

describe("consumeAgentStream token_usage handling", () => {
  it("forwards outputTokens from token_usage events", async () => {
    const events: SseEvent[] = [
      { event: "token_usage", data: { outputTokens: 42 } },
      { event: "token_usage", data: { outputTokens: 17 } },
      { event: "done", data: {} },
    ];

    const received: number[] = [];
    const callbacks: AgentStreamCallbacks = {
      onDelta: () => {},
      onTokenUsage: (event) => received.push(event.outputTokens),
    };

    await consumeAgentStream(sseResponse(events), callbacks);

    expect(received).toEqual([42, 17]);
  });
});

describe("consumeAgentStream confirm_required handling", () => {
  it("forwards every server-defined ConfirmKind to onConfirmRequired", async () => {
    const events: SseEvent[] = CONFIRM_KINDS.map((kind, index) => ({
      event: "confirm_required",
      data: {
        toolUseId: `id-${index}`,
        kind,
        path: "workspace/demo/output.txt",
        isNew: false,
      },
    }));
    events.push({ event: "done", data: {} });

    const received: ToolConfirmRequiredEvent[] = [];
    const callbacks: AgentStreamCallbacks = {
      onDelta: () => {},
      onConfirmRequired: (event) => received.push(event),
      onUnknownConfirmKind: () => {
        throw new Error("known kinds must not be reported as unknown");
      },
    };

    await consumeAgentStream(sseResponse(events), callbacks);

    expect(received.map((event) => event.kind).sort()).toEqual(
      [...CONFIRM_KINDS].sort(),
    );
  });

  it("parses and forwards the generate payload for generate-write", async () => {
    const events: SseEvent[] = [
      {
        event: "confirm_required",
        data: {
          toolUseId: "gw-1",
          kind: "generate-write",
          path: "output/minutes-2026-07-12.html",
          isNew: true,
          generate: {
            purpose: "議事録 HTML を生成する",
            instruction: "md ドラフトを HTML 化する",
            sections: ["ヘッダー", "本文"],
            contextPaths: ["output/minutes-2026-07-12.md"],
          },
        },
      },
      { event: "done", data: {} },
    ];

    const received: ToolConfirmRequiredEvent[] = [];
    await consumeAgentStream(sseResponse(events), {
      onDelta: () => {},
      onConfirmRequired: (event) => received.push(event),
    });

    expect(received).toHaveLength(1);
    expect(received[0].kind).toBe("generate-write");
    expect(received[0].generate).toEqual({
      purpose: "議事録 HTML を生成する",
      instruction: "md ドラフトを HTML 化する",
      sections: ["ヘッダー", "本文"],
      contextPaths: ["output/minutes-2026-07-12.md"],
    });
  });

  it("defaults missing generate fields instead of dropping the event", async () => {
    const events: SseEvent[] = [
      {
        event: "confirm_required",
        data: {
          toolUseId: "gw-2",
          kind: "generate-write",
          path: "output/x.html",
          isNew: true,
          generate: {},
        },
      },
      { event: "done", data: {} },
    ];

    const received: ToolConfirmRequiredEvent[] = [];
    await consumeAgentStream(sseResponse(events), {
      onDelta: () => {},
      onConfirmRequired: (event) => received.push(event),
    });

    expect(received).toHaveLength(1);
    expect(received[0].generate).toEqual({
      purpose: "",
      instruction: "",
      sections: [],
      contextPaths: [],
    });
  });

  it("rejects unknown kind immediately instead of invoking onConfirmRequired", async () => {
    const events: SseEvent[] = [
      {
        event: "confirm_required",
        data: {
          toolUseId: "unknown-1",
          kind: "some-future-kind",
          path: "workspace/demo/x.txt",
          isNew: false,
        },
      },
      { event: "done", data: {} },
    ];

    const confirmed: ToolConfirmRequiredEvent[] = [];
    const unknown: Array<{ toolUseId: string; kind: string }> = [];

    await consumeAgentStream(sseResponse(events), {
      onDelta: () => {},
      onConfirmRequired: (event) => confirmed.push(event),
      onUnknownConfirmKind: (event) => unknown.push(event),
    });

    expect(confirmed).toHaveLength(0);
    expect(unknown).toEqual([
      { toolUseId: "unknown-1", kind: "some-future-kind" },
    ]);
  });

  it("silently ignores unknown kind when no handler is registered (no throw)", async () => {
    const events: SseEvent[] = [
      {
        event: "confirm_required",
        data: {
          toolUseId: "unknown-2",
          kind: "another-future-kind",
          path: "workspace/demo/x.txt",
          isNew: false,
        },
      },
      { event: "done", data: {} },
    ];

    await expect(
      consumeAgentStream(sseResponse(events), { onDelta: () => {} }),
    ).resolves.toBeUndefined();
  });
});
