import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentLoopEmit, RunAgentLoopResult } from "@/lib/agent/agent-loop";

vi.mock("@/lib/api-keys", () => ({
  resolveAiApiKey: () => "test-key",
}));

vi.mock("@/lib/agent/skill-loader", () => ({
  loadSkill: vi.fn(),
  buildSkillSystemPrompt: vi.fn(),
  getSkillCatalogRoots: vi.fn(() => [process.cwd()]),
  resolveSkillDir: vi.fn(() => null),
}));

vi.mock("@/lib/agent/file-attachments", () => ({
  resolveAttachmentsForMessage: vi.fn(() => ({ attachments: [] })),
  enrichUserMessageWithAttachments: vi.fn((content: string) => content),
}));

vi.mock("@/lib/agent/agent-loop", () => ({
  createAgentLoopSseStream: vi.fn(
    (run: (emit: AgentLoopEmit) => Promise<RunAgentLoopResult>) => {
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          void run((event, data) => {
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
              ),
            );
          }).then((result) => {
            if (!result.ok) {
              controller.enqueue(
                encoder.encode(
                  `event: error\ndata: ${JSON.stringify({ message: result.error })}\n\n`,
                ),
              );
            }
            controller.close();
          });
        },
      });
    },
  ),
  runAgentLoop: vi.fn(async (options) => {
    options.emit("text_delta", { text: "hello" });
    options.emit("tool_start", {
      name: "search_company_context",
      input: { query: "git" },
      toolUseId: "tool-1",
    });
    options.emit("tool_end", {
      name: "search_company_context",
      toolUseId: "tool-1",
      summary: "1件",
      display: "🔍 search: git → 1件",
      result: '{"items":[]}',
    });
    options.emit("done", {});
    return { ok: true, toolEvents: [] };
  }),
}));

import { loadSkill, buildSkillSystemPrompt } from "@/lib/agent/skill-loader";
import { runAgentLoop } from "@/lib/agent/agent-loop";

describe("POST /api/agent/invoke", () => {
  beforeEach(() => {
    vi.mocked(loadSkill).mockReturnValue({
      id: "create-draft",
      name: "create-draft",
      description: "",
      variables: ["series"],
      tools: ["search_company_context", "select_company_context"],
      assets: [],
      body: "system",
    });
    vi.mocked(buildSkillSystemPrompt).mockReturnValue({
      prompt: "system prompt",
      missingVariables: [],
    });
  });

  it("streams agent events for valid request", async () => {
    const { POST } = await import("@/app/api/agent/invoke/route");
    const res = await POST(
      new Request("http://localhost/api/agent/invoke", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ai-model": "claude-sonnet-5",
        },
        body: JSON.stringify({
          skillId: "create-draft",
          variables: { series: "A" },
          messages: [{ role: "user", content: "hello" }],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: text_delta");
    expect(text).toContain("event: tool_start");
    expect(text).toContain("event: tool_end");
    expect(runAgentLoop).toHaveBeenCalled();
  });

  it("returns 400 when required variables missing", async () => {
    vi.mocked(buildSkillSystemPrompt).mockReturnValue({
      prompt: "",
      missingVariables: ["series"],
    });

    const { POST } = await import("@/app/api/agent/invoke/route");
    const res = await POST(
      new Request("http://localhost/api/agent/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          skillId: "create-draft",
          messages: [{ role: "user", content: "hello" }],
        }),
      }),
    );

    expect(res.status).toBe(400);
  });
});
