import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  extractToolErrorMessage,
  isBrokenToolUse,
  runAgentLoop,
  runTurnWithMaxTokensContinuation,
} from "@/lib/agent/agent-loop";
import {
  AGENT_BROKEN_TOOL_USE_ERROR,
  AGENT_MISSING_GENERATE_INPUT_ERROR,
  AGENT_MISSING_PATH_ERROR,
  AGENT_MISSING_SCRIPT_INPUT_ERROR,
  AGENT_REPEATED_TOOL_ERROR,
  AGENT_TEXT_CONTINUATION_LIMIT_NOTICE,
  MAX_TEXT_CONTINUATIONS_PER_TURN,
} from "@/lib/agent/llm/types";
import type { ProviderTurnResult, StreamEvent } from "@/lib/agent/llm/types";
import type { LlmProvider } from "@/lib/agent/llm/provider";

vi.mock("@/lib/api-keys", () => ({
  resolveAiApiKey: () => "test-key",
}));

vi.mock("@/lib/agent/llm/resolve-provider", () => ({
  resolveLlmProvider: vi.fn(),
}));

vi.mock("@/lib/agent/tools/registry", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/agent/tools/registry")
  >("@/lib/agent/tools/registry");
  return {
    ...actual,
    executeRegisteredTool: vi.fn(),
  };
});

vi.mock("@/lib/agent/work-scope-guard", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/agent/work-scope-guard")>();
  return {
    ...actual,
    checkWorkScopeExists: vi.fn(() => null),
  };
});

import { resolveLlmProvider } from "@/lib/agent/llm/resolve-provider";
import { executeRegisteredTool } from "@/lib/agent/tools/registry";
import {
  checkWorkScopeExists,
  AGENT_WORK_SCOPE_MISSING_ERROR,
} from "@/lib/agent/work-scope-guard";
import { SCOPE, scopeDisplayPath } from "@/__tests__/helpers/work-scope-fixture";

function mockProvider(turns: ProviderTurnResult[]) {
  let index = 0;
  return {
    async *streamTurn(): AsyncGenerator<StreamEvent> {
      const result = turns[index] ?? {
        text: "",
        toolCalls: [],
        stopReason: "end_turn" as const,
      };
      index += 1;
      // 実プロバイダと同様に text は text_delta として流す
      if (result.text) {
        yield { type: "text_delta", text: result.text };
      }
      yield { type: "turn_complete", result };
    },
    async runTurn() {
      return turns[0]!;
    },
  };
}

describe("isBrokenToolUse", () => {
  it("detects inputParseError", () => {
    expect(
      isBrokenToolUse({
        id: "1",
        name: "write_file",
        input: {},
        inputParseError: true,
      }),
    ).toBe(AGENT_BROKEN_TOOL_USE_ERROR);
  });

  it("detects missing path on path-required tools", () => {
    expect(isBrokenToolUse({ id: "1", name: "write_file", input: {} })).toBe(
      AGENT_MISSING_PATH_ERROR,
    );
    expect(
      isBrokenToolUse({ id: "1", name: "read_file", input: { path: "  " } }),
    ).toBe(AGENT_MISSING_PATH_ERROR);
    expect(
      isBrokenToolUse({ id: "1", name: "list_files", input: {} }),
    ).toBeNull();
  });

  it("detects missing code / script_path on script tools", () => {
    expect(
      isBrokenToolUse({ id: "1", name: "run_script", input: { writes: [] } }),
    ).toBe(AGENT_MISSING_SCRIPT_INPUT_ERROR);
    expect(
      isBrokenToolUse({ id: "1", name: "run_skill_script", input: {} }),
    ).toBe(AGENT_MISSING_SCRIPT_INPUT_ERROR);
    expect(
      isBrokenToolUse({
        id: "1",
        name: "run_script",
        input: { code: 'const fs = require("fs");', writes: [] },
      }),
    ).toBeNull();
    expect(
      isBrokenToolUse({
        id: "1",
        name: "run_skill_script",
        input: { script_path: "scripts/build.cjs" },
      }),
    ).toBeNull();
  });

  it("detects missing path / instruction on generate_and_write", () => {
    expect(
      isBrokenToolUse({
        id: "1",
        name: "generate_and_write",
        input: { path: "out.html" },
      }),
    ).toBe(AGENT_MISSING_GENERATE_INPUT_ERROR);
    expect(
      isBrokenToolUse({
        id: "1",
        name: "generate_and_write",
        input: { instruction: "書く" },
      }),
    ).toBe(AGENT_MISSING_GENERATE_INPUT_ERROR);
    expect(
      isBrokenToolUse({
        id: "1",
        name: "generate_and_write",
        input: { path: "out.html", instruction: "書く" },
      }),
    ).toBeNull();
  });
});

describe("extractToolErrorMessage", () => {
  it("reads error string from tool result", () => {
    expect(extractToolErrorMessage({ error: "path が空です" })).toBe(
      "path が空です",
    );
    expect(extractToolErrorMessage({ path: "ok" })).toBeNull();
  });
});

type Step = {
  text: string;
  stopReason: ProviderTurnResult["stopReason"];
  toolCalls?: ProviderTurnResult["toolCalls"];
};

/** streamTurn が text_delta → turn_complete を順に返す最小のプロバイダスタブ */
function streamingProvider(steps: Step[]): {
  provider: LlmProvider;
  callCount: () => number;
} {
  let index = 0;
  const provider: LlmProvider = {
    async runTurn() {
      throw new Error("not used");
    },
    async *streamTurn(): AsyncGenerator<StreamEvent> {
      const step = steps[Math.min(index, steps.length - 1)];
      index += 1;
      if (step.text) {
        yield { type: "text_delta", text: step.text };
      }
      yield {
        type: "turn_complete",
        result: {
          text: step.text,
          toolCalls: step.toolCalls ?? [],
          stopReason: step.stopReason,
        },
      };
    },
  };
  return { provider, callCount: () => index };
}

describe("runTurnWithMaxTokensContinuation", () => {
  it("continues automatically after a max_tokens turn and stitches the text", async () => {
    const { provider, callCount } = streamingProvider([
      { text: "first-half", stopReason: "max_tokens" },
      { text: "-second-half", stopReason: "end_turn" },
    ]);
    const emit = vi.fn();

    const outcome = await runTurnWithMaxTokensContinuation({
      provider,
      apiKey: "key",
      model: "claude-test",
      system: "sys",
      baseMessages: [{ role: "user", content: "hi" }],
      tools: [],
      emit,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toBe("first-half-second-half");
    expect(outcome.result.stopReason).toBe("end_turn");
    expect(callCount()).toBe(2);
    expect(emit).toHaveBeenCalledWith("text_delta", { text: "first-half" });
    expect(emit).toHaveBeenCalledWith("text_delta", { text: "-second-half" });
    expect(outcome.text).not.toContain(AGENT_TEXT_CONTINUATION_LIMIT_NOTICE);
  });

  it("stops after the continuation limit and appends a truncation notice", async () => {
    const steps: Step[] = Array.from(
      { length: MAX_TEXT_CONTINUATIONS_PER_TURN + 1 },
      (_, i) => ({ text: `chunk${i}`, stopReason: "max_tokens" as const }),
    );
    const { provider, callCount } = streamingProvider(steps);
    const emit = vi.fn();

    const outcome = await runTurnWithMaxTokensContinuation({
      provider,
      apiKey: "key",
      model: "claude-test",
      system: "sys",
      baseMessages: [{ role: "user", content: "hi" }],
      tools: [],
      emit,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // 初回 + 継続 4 回 = 5 回で打ち切り、6 回目は呼ばれない
    expect(callCount()).toBe(MAX_TEXT_CONTINUATIONS_PER_TURN + 1);
    expect(outcome.text).toContain("chunk0");
    expect(outcome.text).toContain(`chunk${MAX_TEXT_CONTINUATIONS_PER_TURN}`);
    expect(outcome.text).toContain(AGENT_TEXT_CONTINUATION_LIMIT_NOTICE);
    expect(emit).toHaveBeenCalledWith("text_delta", {
      text: AGENT_TEXT_CONTINUATION_LIMIT_NOTICE,
    });
  });

  it("does not continue when the turn completes normally without tool calls", async () => {
    const { provider, callCount } = streamingProvider([
      { text: "done", stopReason: "end_turn" },
    ]);
    const outcome = await runTurnWithMaxTokensContinuation({
      provider,
      apiKey: "key",
      model: "claude-test",
      system: "sys",
      baseMessages: [{ role: "user", content: "hi" }],
      tools: [],
      emit: vi.fn(),
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toBe("done");
    expect(callCount()).toBe(1);
  });

  it("does not continue when a max_tokens turn already carries tool calls", async () => {
    const toolCalls: ProviderTurnResult["toolCalls"] = [
      { id: "t1", name: "read_file", input: { path: "a.md" } },
    ];
    const { provider, callCount } = streamingProvider([
      { text: "planning", stopReason: "max_tokens", toolCalls },
    ]);
    const outcome = await runTurnWithMaxTokensContinuation({
      provider,
      apiKey: "key",
      model: "claude-test",
      system: "sys",
      baseMessages: [{ role: "user", content: "hi" }],
      tools: [],
      emit: vi.fn(),
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(callCount()).toBe(1);
    expect(outcome.result.toolCalls).toEqual(toolCalls);
  });

  it("stops continuing once a later continuation turn returns tool calls", async () => {
    const toolCalls: ProviderTurnResult["toolCalls"] = [
      { id: "t1", name: "write_file", input: { path: "out.md", content: "x" } },
    ];
    const { provider, callCount } = streamingProvider([
      { text: "first-half", stopReason: "max_tokens" },
      { text: "", stopReason: "tool_use", toolCalls },
    ]);
    const outcome = await runTurnWithMaxTokensContinuation({
      provider,
      apiKey: "key",
      model: "claude-test",
      system: "sys",
      baseMessages: [{ role: "user", content: "hi" }],
      tools: [],
      emit: vi.fn(),
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(callCount()).toBe(2);
    expect(outcome.text).toBe("first-half");
    expect(outcome.result.toolCalls).toEqual(toolCalls);
  });
});

describe("runAgentLoop safety valves", () => {
  beforeEach(() => {
    vi.mocked(resolveLlmProvider).mockReset();
    vi.mocked(executeRegisteredTool).mockReset();
    vi.mocked(checkWorkScopeExists).mockReset();
    vi.mocked(checkWorkScopeExists).mockReturnValue(null);
  });

  it("returns broken tool_use as recoverable tool_result and continues", async () => {
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-5",
      provider: mockProvider([
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [
            {
              id: "tu1",
              name: "write_file",
              input: {},
              inputParseError: true,
            },
          ],
        },
        {
          text: "switched approach",
          stopReason: "end_turn",
          toolCalls: [],
        },
      ]),
    });

    const emit = vi.fn();
    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      toolNames: [],
      emit,
      workScopeKey: SCOPE,
    });

    expect(result.ok).toBe(true);
    expect(executeRegisteredTool).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      "tool_end",
      expect.objectContaining({
        toolUseId: "tu1",
        result: expect.stringContaining("recoverable"),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "tool_end",
      expect.objectContaining({
        result: expect.stringContaining("copy_file"),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "tool_end",
      expect.objectContaining({
        result: expect.stringContaining("replace_between"),
      }),
    );
  });

  it("returns missing path as recoverable tool_result without executing", async () => {
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-5",
      provider: mockProvider([
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [
            { id: "tu1", name: "write_file", input: { content: "x" } },
          ],
        },
        {
          text: "ok",
          stopReason: "end_turn",
          toolCalls: [],
        },
      ]),
    });

    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      toolNames: [],
      emit: vi.fn(),
      workScopeKey: SCOPE,
    });

    expect(result.ok).toBe(true);
    expect(executeRegisteredTool).not.toHaveBeenCalled();
  });

  it("returns generate_and_write schema guidance for missing instruction", async () => {
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-5",
      provider: mockProvider([
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [
            {
              id: "tu1",
              name: "generate_and_write",
              input: { path: "out.html" },
            },
          ],
        },
        {
          text: "ok",
          stopReason: "end_turn",
          toolCalls: [],
        },
      ]),
    });

    const emit = vi.fn();
    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      toolNames: [],
      emit,
      workScopeKey: SCOPE,
    });

    expect(result.ok).toBe(true);
    expect(executeRegisteredTool).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      "tool_end",
      expect.objectContaining({
        toolUseId: "tu1",
        result: expect.stringContaining("generate_and_write の入力は"),
      }),
    );
  });

  it("continues after 2 identical tool errors then stops on the 3rd", async () => {
    const errorResult = {
      error: `ファイルが見つかりません: ${scopeDisplayPath("x.md")}`,
    };
    vi.mocked(executeRegisteredTool).mockResolvedValue({
      result: errorResult,
      display: { summary: "error", display: "✗ err" },
    });

    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-5",
      provider: mockProvider([
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [{ id: "1", name: "read_file", input: { path: "x.md" } }],
        },
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [{ id: "2", name: "read_file", input: { path: "x.md" } }],
        },
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [{ id: "3", name: "read_file", input: { path: "x.md" } }],
        },
      ]),
    });

    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      toolNames: [],
      emit: vi.fn(),
      workScopeKey: SCOPE,
    });

    expect(executeRegisteredTool).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(AGENT_REPEATED_TOOL_ERROR);
    expect(result.error).toContain("ファイルが見つかりません");
  });

  it("aborts immediately when the work scope folder is missing", async () => {
    vi.mocked(checkWorkScopeExists).mockReturnValue(
      `${AGENT_WORK_SCOPE_MISSING_ERROR} (${scopeDisplayPath()})`,
    );
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-5",
      provider: mockProvider([
        {
          text: "hi",
          stopReason: "end_turn",
          toolCalls: [],
        },
      ]),
    });

    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      toolNames: [],
      emit: vi.fn(),
      workScopeKey: SCOPE,
    });

    expect(result).toEqual({
      ok: false,
      error: `${AGENT_WORK_SCOPE_MISSING_ERROR} (${scopeDisplayPath()})`,
      status: 409,
    });
    expect(executeRegisteredTool).not.toHaveBeenCalled();
  });
});

describe("runAgentLoop auto-nudge (3値判定)", () => {
  beforeEach(() => {
    vi.mocked(resolveLlmProvider).mockReset();
    vi.mocked(executeRegisteredTool).mockReset();
    vi.mocked(checkWorkScopeExists).mockReset();
    vi.mocked(checkWorkScopeExists).mockReturnValue(null);
    delete process.env.EBEX_AUTO_NUDGE;
  });

  function toolStep(id: string): ProviderTurnResult {
    return {
      text: "",
      stopReason: "tool_use",
      toolCalls: [{ id, name: "read_file", input: { path: "output/x.html" } }],
    };
  }

  function toolOutcome(remaining: string[]) {
    return {
      result: {
        path: "output/x.html",
        templateStatus: {
          complete: remaining.length === 0,
          remainingPlaceholders: remaining,
          emptySections: [],
        },
      },
      display: { summary: "ok", display: "ok" },
    };
  }

  it("auto-continues a stalled turn until artifacts are complete", async () => {
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-5",
      provider: mockProvider([
        toolStep("t1"),
        // 埋め残しがある状態での自発的終了 → stalled → 自動 nudge
        {
          text: "ここまで作成しました。",
          stopReason: "end_turn",
          toolCalls: [],
        },
        toolStep("t2"),
        { text: "完了しました。", stopReason: "end_turn", toolCalls: [] },
      ]),
    });
    vi.mocked(executeRegisteredTool)
      .mockResolvedValueOnce(toolOutcome(["{{TITLE}}"]))
      .mockResolvedValueOnce(toolOutcome([]));

    const emit = vi.fn();
    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "作って" }],
      toolNames: [],
      emit,
      workScopeKey: SCOPE,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // nudge により 2 回目のツール実行まで自動で進む
    expect(executeRegisteredTool).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith("done", {});
    const texts = result.toolTurns.map((t) => t.text).filter(Boolean);
    expect(texts).toContain("ここまで作成しました。");
    expect(texts).toContain("完了しました。");
  });

  it("emits token_usage per turn with the visible output token count", async () => {
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-5",
      provider: mockProvider([
        {
          text: "完了しました。",
          stopReason: "end_turn",
          toolCalls: [],
          outputTokens: 123,
        },
      ]),
    });

    const emit = vi.fn();
    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      toolNames: [],
      emit,
      workScopeKey: SCOPE,
    });

    expect(result.ok).toBe(true);
    expect(emit).toHaveBeenCalledWith("token_usage", { outputTokens: 123 });
  });

  it("executes multiple tool calls within a turn sequentially (not in parallel)", async () => {
    const order: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(executeRegisteredTool).mockImplementation(
      async (_name, input) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        order.push(String((input as { path?: string }).path));
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return toolOutcome([]);
      },
    );
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-5",
      provider: mockProvider([
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [
            { id: "a", name: "read_file", input: { path: "output/a.html" } },
            { id: "b", name: "read_file", input: { path: "output/b.html" } },
          ],
        },
        { text: "完了しました。", stopReason: "end_turn", toolCalls: [] },
      ]),
    });

    const emit = vi.fn();
    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "作って" }],
      toolNames: [],
      emit,
      workScopeKey: SCOPE,
    });

    expect(result.ok).toBe(true);
    // 宣言順に 1 つずつ実行され、並行実行されない
    expect(order).toEqual(["output/a.html", "output/b.html"]);
    expect(maxInFlight).toBe(1);
  });

  it("does not nudge when the model is waiting for user confirmation", async () => {
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-5",
      provider: mockProvider([
        toolStep("t1"),
        {
          text: "ドラフトを保存しました。問題なければ「OK」とお知らせください。",
          stopReason: "end_turn",
          toolCalls: [],
        },
      ]),
    });
    vi.mocked(executeRegisteredTool).mockResolvedValueOnce(
      toolOutcome(["{{TITLE}}"]),
    );

    const emit = vi.fn();
    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "作って" }],
      toolNames: [],
      emit,
      workScopeKey: SCOPE,
    });

    expect(result.ok).toBe(true);
    // 埋め残しがあっても確認待ちは nudge しない
    expect(executeRegisteredTool).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("done", {});
  });

  it("skips nudging entirely when EBEX_AUTO_NUDGE=disabled", async () => {
    process.env.EBEX_AUTO_NUDGE = "disabled";
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-5",
      provider: mockProvider([
        toolStep("t1"),
        {
          text: "ここまで作成しました。",
          stopReason: "end_turn",
          toolCalls: [],
        },
      ]),
    });
    vi.mocked(executeRegisteredTool).mockResolvedValueOnce(
      toolOutcome(["{{TITLE}}"]),
    );

    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "作って" }],
      toolNames: [],
      emit: vi.fn(),
      workScopeKey: SCOPE,
    });

    expect(result.ok).toBe(true);
    expect(executeRegisteredTool).toHaveBeenCalledTimes(1);
  });

  it("stops with a notice when the nudge limit is exhausted without progress", async () => {
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-5", // nudgeMax = 2
      provider: mockProvider([
        toolStep("t1"),
        { text: "同じ報告です。", stopReason: "end_turn", toolCalls: [] },
        { text: "同じ報告です。", stopReason: "end_turn", toolCalls: [] },
        { text: "同じ報告です。", stopReason: "end_turn", toolCalls: [] },
        { text: "同じ報告です。", stopReason: "end_turn", toolCalls: [] },
      ]),
    });
    vi.mocked(executeRegisteredTool).mockResolvedValueOnce(
      toolOutcome(["{{TITLE}}"]),
    );

    const emit = vi.fn();
    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "作って" }],
      toolNames: [],
      emit,
      workScopeKey: SCOPE,
    });

    expect(result.ok).toBe(true);
    // 進捗なし 2 連続で打ち切り、打ち切りの注記が emit される
    expect(emit).toHaveBeenCalledWith(
      "text_delta",
      expect.objectContaining({
        text: expect.stringContaining("自動続行を打ち切りました"),
      }),
    );
    expect(emit).toHaveBeenCalledWith("done", {});
  });
});
