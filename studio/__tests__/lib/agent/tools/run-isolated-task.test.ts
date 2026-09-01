import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  LlmProvider,
  LlmProviderRunOptions,
} from "@/lib/agent/llm/provider";
import type { LlmMessage, ProviderTurnResult } from "@/lib/agent/llm/types";

function contentText(content: LlmMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n");
}

import {
  executeRunIsolatedTask,
  ISOLATED_TASK_RESULT_CHAR_LIMIT,
  parseRunIsolatedTaskInput,
} from "@/lib/agent/tools/run-isolated-task";
import { resolveConfirmRequirement } from "@/lib/agent/tools/confirm-gate";
import { resolveToolDefinitions } from "@/lib/agent/tools/registry";
import type { ToolExecutionContext } from "@/lib/agent/tools/registry";
import {
  SCOPE,
  makeScope,
  makeScopeFile,
  scopeDisplayPath,
} from "@/__tests__/helpers/work-scope-fixture";

function makeProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-isolated-task-"));
  makeScope(tmpDir);
  const skillDir = path.join(tmpDir, "skill-zone", "my-skill");
  fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
  const projectDir = path.join(tmpDir, "contents", ...SCOPE.split("/"));
  return { tmpDir, skillDir, projectDir };
}

function makeProvider(
  turns: Array<Pick<ProviderTurnResult, "text" | "stopReason">>,
): { provider: LlmProvider; calls: LlmProviderRunOptions[] } {
  const calls: LlmProviderRunOptions[] = [];
  let index = 0;
  const runTurn = vi.fn(async (options: LlmProviderRunOptions) => {
    calls.push(options);
    const turn = turns[Math.min(index, turns.length - 1)];
    index += 1;
    return { ...turn, toolCalls: [] };
  });
  const provider: LlmProvider = {
    runTurn,
    async *streamTurn() {
      throw new Error("not used");
    },
  };
  return { provider, calls };
}

function makeContext(
  base: ReturnType<typeof makeProject>,
  provider: LlmProvider,
): ToolExecutionContext {
  return {
    projectRoot: base.tmpDir,
    workScopeKey: SCOPE,
    skillId: "my-skill",
    skillDirAbsolute: base.skillDir,
    generate: {
      provider,
      apiKey: "test-key",
      model: "claude-test",
      maxTokens: 1000,
    },
  };
}

describe("run_isolated_task tool definition", () => {
  it("is included in resolved tool definitions", () => {
    const names = resolveToolDefinitions(["run_isolated_task"]).map((d) => d.name);
    expect(names).toContain("run_isolated_task");
  });
});

describe("parseRunIsolatedTaskInput", () => {
  it("accepts minimal input without a path", () => {
    const parsed = parseRunIsolatedTaskInput({
      purpose: "評価",
      instruction: "品質を評価して",
    });
    expect(parsed).toMatchObject({
      instruction: "品質を評価して",
      path: null,
      sections: [],
      contextPaths: [],
    });
  });

  it("rejects missing instruction", () => {
    expect(parseRunIsolatedTaskInput({ purpose: "p" })).toMatchObject({
      error: expect.stringContaining("instruction"),
    });
  });
});

describe("executeRunIsolatedTask", () => {
  it("returns the result text directly when path is omitted (no file written)", async () => {
    const base = makeProject();
    const { provider, calls } = makeProvider([
      { text: "評価レポート本文", stopReason: "end_turn" },
    ]);
    const outcome = await executeRunIsolatedTask(makeContext(base, provider), {
      purpose: "議事録を評価",
      instruction: "生成済みHTMLを評価して",
      context_paths: [],
    });
    expect(outcome.result).toMatchObject({
      resultText: "評価レポート本文",
    });
    // ファイルは作られない
    expect(fs.existsSync(path.join(base.projectDir, "output"))).toBe(false);
    expect(calls).toHaveLength(1);
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("writes to a file and returns only a summary when path is given", async () => {
    const base = makeProject();
    const { provider } = makeProvider([
      { text: "レポート本文", stopReason: "end_turn" },
    ]);
    const outcome = await executeRunIsolatedTask(makeContext(base, provider), {
      purpose: "評価",
      instruction: "評価して",
      path: "output/eval.md",
    });
    expect(outcome.result).toMatchObject({
      path: scopeDisplayPath("output/eval.md"),
    });
    expect(JSON.stringify(outcome.result)).not.toContain("レポート本文");
    const written = fs.readFileSync(
      path.join(base.projectDir, "output", "eval.md"),
      "utf-8",
    );
    expect(written).toBe("レポート本文");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("diverts to the work dir instead of overwriting a framed template", async () => {
    const base = makeProject();
    const framePath = path.join(base.projectDir, "output", "report.html");
    fs.mkdirSync(path.dirname(framePath), { recursive: true });
    const frame = [
      "<html><body>",
      "<!-- BODY_START -->",
      "",
      "<!-- BODY_END -->",
      "</body></html>",
    ].join("\n");
    fs.writeFileSync(framePath, frame, "utf-8");

    const { provider } = makeProvider([
      { text: "レポート本文", stopReason: "end_turn" },
    ]);
    const outcome = await executeRunIsolatedTask(makeContext(base, provider), {
      purpose: "評価",
      instruction: "評価して",
      path: "output/report.html",
    });

    expect(fs.readFileSync(framePath, "utf-8")).toBe(frame);
    expect(outcome.result).toMatchObject({
      diverted: true,
      path: scopeDisplayPath("_work/output__report.html"),
      requestedPath: scopeDisplayPath("output/report.html"),
      markerNames: ["BODY"],
    });
    expect(
      fs.readFileSync(
        path.join(base.projectDir, "_work", "output__report.html"),
        "utf-8",
      ),
    ).toBe("レポート本文");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("does not include context_paths content in the tool_result", async () => {
    const base = makeProject();
    fs.mkdirSync(path.join(base.projectDir, "output"), { recursive: true });
    fs.writeFileSync(
      path.join(base.projectDir, "output", "minutes.html"),
      "<html>SECRET_MARKER_CONTENT</html>",
    );
    const { provider, calls } = makeProvider([
      { text: "評価結果のみ", stopReason: "end_turn" },
    ]);
    const outcome = await executeRunIsolatedTask(makeContext(base, provider), {
      purpose: "評価",
      instruction: "評価して",
      context_paths: ["output/minutes.html"],
    });
    // 子プロンプトには参照ファイルの内容が渡る
    expect(contentText(calls[0].messages[0].content)).toContain(
      "SECRET_MARKER_CONTENT",
    );
    // が、親へ返る tool_result には含まれない
    expect(JSON.stringify(outcome.result)).not.toContain(
      "SECRET_MARKER_CONTENT",
    );
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("fails with guidance when the result exceeds the char limit (no path)", async () => {
    const base = makeProject();
    const big = "x".repeat(ISOLATED_TASK_RESULT_CHAR_LIMIT + 1);
    const { provider } = makeProvider([{ text: big, stopReason: "end_turn" }]);
    const outcome = await executeRunIsolatedTask(makeContext(base, provider), {
      purpose: "評価",
      instruction: "評価して",
    });
    expect(outcome.result).toMatchObject({
      recoverable: true,
    });
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });
});

describe("resolveConfirmRequirement for run_isolated_task", () => {
  it("requires confirmation even without a path", () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ebex-isolated-task-confirm-"),
    );
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "run_isolated_task",
      input: { purpose: "評価", instruction: "評価して" },
    });
    expect(req).toMatchObject({ kind: "isolated-task" });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("marks overwrite when the target path exists", () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ebex-isolated-task-confirm-"),
    );
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "output/eval.md", "old");
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "run_isolated_task",
      input: {
        purpose: "評価",
        instruction: "評価して",
        path: "output/eval.md",
      },
    });
    expect(req).toMatchObject({ kind: "isolated-task", isNew: false });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
