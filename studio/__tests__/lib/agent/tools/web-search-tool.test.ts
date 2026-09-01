import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractToolErrorMessage } from "@/lib/agent/agent-loop";
import { resolveConfirmRequirement } from "@/lib/agent/tools/confirm-gate";
import {
  executeRegisteredTool,
  resolveToolDefinitions,
  type ToolExecutionContext,
} from "@/lib/agent/tools/registry";
import { SEARCH_NO_CITATION_GUIDANCE } from "@/lib/agent/tools/search-provider";
import type {
  SearchOutcome,
  SearchProvider,
  SearchSessionState,
} from "@/lib/agent/tools/search-provider";
import { SCOPE, makeScope } from "@/__tests__/helpers/work-scope-fixture";

function makeContext(
  provider: SearchProvider | null,
  session: SearchSessionState = { unavailable: false },
): {
  tmpDir: string;
  context: ToolExecutionContext;
  session: SearchSessionState;
} {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-web-search-"));
  makeScope(tmpDir);
  return {
    tmpDir,
    session,
    context: {
      projectRoot: tmpDir,
      workScopeKey: SCOPE,
      search: { provider, session },
    },
  };
}

function providerReturning(outcome: SearchOutcome): SearchProvider {
  return { search: async () => outcome };
}

describe("web_search tool", () => {
  it("is included in tool definitions", () => {
    expect(resolveToolDefinitions(["web_search"]).map((d) => d.name)).toContain(
      "web_search",
    );
  });

  it("returns normalized results on success", async () => {
    const { tmpDir, context } = makeContext(
      providerReturning({
        ok: true,
        results: [{ title: "T", url: "https://t.example", snippet: "s" }],
      }),
    );
    const outcome = await executeRegisteredTool(
      "web_search",
      { query: "EBEX", purpose: "調査" },
      context,
    );
    expect(outcome.result).toMatchObject({
      query: "EBEX",
      results: [{ title: "T", url: "https://t.example", snippet: "s" }],
    });
    // 検索が成立した以上、出典は正当なので抑止の案内は混ざらない
    expect(JSON.stringify(outcome.result)).not.toContain(
      SEARCH_NO_CITATION_GUIDANCE,
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns unconfigured notice without error key when no provider", async () => {
    const { tmpDir, context, session } = makeContext(null);
    const outcome = await executeRegisteredTool(
      "web_search",
      { query: "EBEX", purpose: "調査" },
      context,
    );
    expect(outcome.result).toMatchObject({
      unavailable: true,
      notice: expect.stringContaining("再試行せず"),
    });
    // error キーを持たない → 同一エラー連続の安全停止に到達しない
    expect(extractToolErrorMessage(outcome.result)).toBeNull();
    expect(session.unavailable).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("trips the circuit breaker on first failure", async () => {
    const { tmpDir, context, session } = makeContext(
      providerReturning({ ok: false, error: "接続できません" }),
    );
    const first = await executeRegisteredTool(
      "web_search",
      { query: "EBEX", purpose: "調査" },
      context,
    );
    expect(first.result).toMatchObject({
      unavailable: true,
      notice: expect.stringContaining("再試行せず"),
    });
    expect(extractToolErrorMessage(first.result)).toBeNull();
    expect(session.unavailable).toBe(true);

    // 2 回目はプロバイダを呼ばず即座に案内を返す
    let called = 0;
    context.search!.provider = {
      search: async () => {
        called += 1;
        return { ok: true, results: [] };
      },
    };
    const second = await executeRegisteredTool(
      "web_search",
      { query: "EBEX 2", purpose: "調査" },
      context,
    );
    expect(second.result).toMatchObject({ unavailable: true });
    expect(called).toBe(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects empty query as recoverable error", async () => {
    const { tmpDir, context } = makeContext(
      providerReturning({ ok: true, results: [] }),
    );
    const outcome = await executeRegisteredTool(
      "web_search",
      { query: "  ", purpose: "調査" },
      context,
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("query"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("resolveConfirmRequirement for web_search", () => {
  it("requires confirmation with query and purpose payload", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-web-search-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "web_search",
      input: { query: "部のパーパス", purpose: "図解の下調べ" },
    });
    expect(req).toMatchObject({
      kind: "web-search",
      path: "部のパーパス",
      search: { query: "部のパーパス", purpose: "図解の下調べ" },
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("still requires confirmation even when search is unavailable (skip happens after approval)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-web-search-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "web_search",
      input: { query: "部のパーパス", purpose: "図解の下調べ" },
    });
    expect(req).toMatchObject({
      kind: "web-search",
      search: { query: "部のパーパス", purpose: "図解の下調べ" },
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips confirmation for empty query (handled as tool error)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-web-search-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "web_search",
      input: { query: "", purpose: "x" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
