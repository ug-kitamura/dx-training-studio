import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  LlmProvider,
  LlmProviderRunOptions,
} from "@/lib/agent/llm/provider";
import type { LlmMessage, ProviderTurnResult } from "@/lib/agent/llm/types";

/** メッセージ content（文字列またはブロック配列）からテキストを結合して取り出す */
function contentText(content: LlmMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n");
}
import {
  executeGenerateAndWrite,
  GENERATE_CONTEXT_FILE_CHAR_LIMIT,
  GENERATE_MAX_SECTIONS,
  GENERATE_TOTAL_CHAR_LIMIT,
  parseGenerateWriteInput,
  stripEnclosingCodeFence,
} from "@/lib/agent/tools/generate-write";
import { resolveModelProfile } from "@/lib/agent/model-profiles";
import {
  READ_CHAR_LIMIT,
  resolveToolDefinitions,
} from "@/lib/agent/tools/registry";
import type { ToolExecutionContext } from "@/lib/agent/tools/registry";
import {
  SCOPE,
  makeScope,
  makeScopeFile,
  scopeDisplayPath,
} from "@/__tests__/helpers/work-scope-fixture";

function makeProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-generate-write-"));
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

describe("generate_and_write tool definition", () => {
  it("is included in resolved tool definitions", () => {
    const names = resolveToolDefinitions(["generate_and_write"]).map((d) => d.name);
    expect(names).toContain("generate_and_write");
  });
});

describe("parseGenerateWriteInput", () => {
  it("accepts minimal input and normalizes arrays", () => {
    const parsed = parseGenerateWriteInput({
      purpose: "p",
      path: "output/a.html",
      instruction: "書いて",
      sections: ["s1", "", 2, "s2"],
      context_paths: ["notes.md"],
    });
    expect(parsed).toMatchObject({
      path: "output/a.html",
      sections: ["s1", "s2"],
      contextPaths: ["notes.md"],
    });
  });

  it("normalizes marker to the bare section name", () => {
    for (const raw of [
      "CONTENT",
      "  CONTENT  ",
      "CONTENT_START",
      "<!-- CONTENT_START -->",
      "<!--CONTENT_END-->",
    ]) {
      expect(
        parseGenerateWriteInput({
          path: "a.html",
          instruction: "書く",
          marker: raw,
        }),
      ).toMatchObject({ marker: "CONTENT" });
    }
  });

  it("leaves marker null when not given and rejects malformed markers", () => {
    expect(
      parseGenerateWriteInput({ path: "a.html", instruction: "書く" }),
    ).toMatchObject({ marker: null });
    expect(
      parseGenerateWriteInput({
        path: "a.html",
        instruction: "書く",
        marker: "not a marker!",
      }),
    ).toMatchObject({ error: expect.stringContaining("marker") });
  });

  it("rejects missing path or instruction", () => {
    expect(parseGenerateWriteInput({ instruction: "x" })).toMatchObject({
      error: expect.stringContaining("path"),
    });
    expect(
      parseGenerateWriteInput({ path: "a.md", instruction: " " }),
    ).toMatchObject({ error: expect.stringContaining("instruction") });
  });

  it("rejects too many sections", () => {
    const sections = Array.from(
      { length: GENERATE_MAX_SECTIONS + 1 },
      (_, i) => `s${i}`,
    );
    expect(
      parseGenerateWriteInput({ path: "a.md", instruction: "x", sections }),
    ).toMatchObject({ error: expect.stringContaining("sections") });
  });
});

describe("stripEnclosingCodeFence", () => {
  it("strips a fence that wraps the whole output", () => {
    expect(stripEnclosingCodeFence("```html\n<div>a</div>\n```")).toBe(
      "<div>a</div>",
    );
  });

  it("keeps inner fences and plain text", () => {
    expect(stripEnclosingCodeFence("<p>a</p>")).toBe("<p>a</p>");
    const mixed = "before\n```js\ncode\n```\nafter";
    expect(stripEnclosingCodeFence(mixed)).toBe(mixed);
  });
});

describe("executeGenerateAndWrite", () => {
  it("keeps the generated size limit insertable via replace_between from_path", () => {
    expect(GENERATE_TOTAL_CHAR_LIMIT).toBeLessThanOrEqual(READ_CHAR_LIMIT);
  });

  it("generates sections in order and writes once with a summary result", async () => {
    const base = makeProject();
    const { provider, calls } = makeProvider([
      { text: "<section>one</section>", stopReason: "end_turn" },
      { text: "<section>two</section>", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "図解生成",
      path: "output/partial.html",
      instruction: "図解本文を書く",
      sections: ["導入", "本論"],
    });
    expect(outcome.result).toMatchObject({
      path: scopeDisplayPath("output/partial.html"),
      sections: 2,
      continuations: 0,
    });
    const written = fs.readFileSync(
      path.join(base.projectDir, "output", "partial.html"),
      "utf-8",
    );
    expect(written).toBe("<section>one</section>\n\n<section>two</section>");
    // 成果物本文は tool_result に載らない
    expect(JSON.stringify(outcome.result)).not.toContain("<section>");
    // 2 セクション = 2 回の子呼び出し、各呼び出しにセクション指示が載る
    expect(calls).toHaveLength(2);
    expect(contentText(calls[0].messages[0].content)).toContain("導入");
    expect(contentText(calls[1].messages[0].content)).toContain("本論");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("does not rewrite generate_and_write output when skill base.html exists", async () => {
    const base = makeProject();
    fs.writeFileSync(
      path.join(base.skillDir, "references", "base.html"),
      "<html>TEMPLATE</html>",
    );
    const { provider } = makeProvider([
      { text: "<html>GENERATED</html>", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "創作",
      path: "output/creative.html",
      instruction: "本文を書く",
      sections: ["全体"],
    });
    expect(outcome.result).toMatchObject({
      path: scopeDisplayPath("output/creative.html"),
    });
    const written = fs.readFileSync(
      path.join(base.projectDir, "output", "creative.html"),
      "utf-8",
    );
    expect(written).toBe("<html>GENERATED</html>");
    expect(written).not.toContain("TEMPLATE");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("keeps the invariant prefix block byte-identical across sections and continuations", async () => {
    const base = makeProject();
    const { provider, calls } = makeProvider([
      { text: "one", stopReason: "max_tokens" },
      { text: "-continued", stopReason: "end_turn" },
      { text: "two", stopReason: "end_turn" },
    ]);
    await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "p",
      path: "out.html",
      instruction: "共通の指示",
      sections: ["導入", "本論"],
    });
    // section0(max_tokens) -> continuation -> section1 = 3 呼び出し
    expect(calls).toHaveLength(3);

    function firstBlockOf(content: LlmMessage["content"]) {
      if (typeof content === "string") {
        throw new Error("expected block array content");
      }
      return content[0];
    }

    const prefixes = calls.map((call) => {
      const block = firstBlockOf(call.messages[0].content);
      return block.type === "text" ? block.text : "";
    });
    // 不変 prefix はセクション・継続をまたいでバイト同一である
    expect(new Set(prefixes).size).toBe(1);

    for (const call of calls) {
      const block = firstBlockOf(call.messages[0].content);
      expect(block.cache_control).toEqual({ type: "ephemeral" });
    }
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("continues after max_tokens and stitches the text verbatim", async () => {
    const base = makeProject();
    const { provider, calls } = makeProvider([
      { text: "<div>first-half", stopReason: "max_tokens" },
      { text: " second-half</div>", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "p",
      path: "out.html",
      instruction: "書く",
    });
    expect(outcome.result).toMatchObject({ continuations: 1 });
    expect(
      fs.readFileSync(path.join(base.projectDir, "out.html"), "utf-8"),
    ).toBe("<div>first-half second-half</div>");
    // 継続呼び出しには生成済みテキストが assistant として積まれる
    const continuation = calls[1];
    expect(continuation.messages).toHaveLength(3);
    expect(continuation.messages[1]).toMatchObject({
      role: "assistant",
      content: "<div>first-half",
    });
    expect(String(continuation.messages[2].content)).toContain("続き");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("fails without writing when the continuation limit is exceeded", async () => {
    const base = makeProject();
    const { provider, calls } = makeProvider([
      { text: "x", stopReason: "max_tokens" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "p",
      path: "out.html",
      instruction: "書く",
    });
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("継続上限"),
      completedSections: 0,
      recoverable: true,
      guidance: expect.stringContaining("sections"),
    });
    // 継続上限はモデルプロファイル（"claude-test" は未知モデル既定）から解決される
    const continuationsMax =
      resolveModelProfile("claude-test").continuations.generatePerSection;
    expect(calls).toHaveLength(continuationsMax + 1);
    expect(fs.existsSync(path.join(base.projectDir, "out.html"))).toBe(false);
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("fails without writing when the total size limit is exceeded", async () => {
    const base = makeProject();
    const { provider } = makeProvider([
      {
        text: "x".repeat(GENERATE_TOTAL_CHAR_LIMIT + 1),
        stopReason: "end_turn",
      },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "p",
      path: "out.html",
      instruction: "書く",
    });
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("上限"),
      completedSections: 0,
    });
    expect(fs.existsSync(path.join(base.projectDir, "out.html"))).toBe(false);
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("fails with completedSections when a later section errors", async () => {
    const base = makeProject();
    const calls: LlmProviderRunOptions[] = [];
    let count = 0;
    const provider: LlmProvider = {
      runTurn: async (options) => {
        calls.push(options);
        count += 1;
        if (count === 2) throw new Error("api-down");
        return { text: "ok", toolCalls: [], stopReason: "end_turn" };
      },
      async *streamTurn() {
        throw new Error("not used");
      },
    };
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "p",
      path: "out.html",
      instruction: "書く",
      sections: ["a", "b"],
    });
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("api-down"),
      completedSections: 1,
    });
    expect(fs.existsSync(path.join(base.projectDir, "out.html"))).toBe(false);
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("includes context files from project and skill zone in the prompt", async () => {
    const base = makeProject();
    makeScopeFile(base.tmpDir, "notes.md", "outline-content");
    fs.writeFileSync(
      path.join(base.skillDir, "references", "model.html"),
      "model-answer-content",
      "utf-8",
    );
    const { provider, calls } = makeProvider([
      { text: "done", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "p",
      path: "out.html",
      instruction: "書く",
      context_paths: ["notes.md", "references/model.html"],
    });
    const record = outcome.result as Record<string, unknown>;
    expect(record.error).toBeUndefined();
    const prompt = contentText(calls[0].messages[0].content);
    expect(prompt).toContain("outline-content");
    expect(prompt).toContain("model-answer-content");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("surfaces context_paths truncation in result and display", async () => {
    const base = makeProject();
    // 読取上限を超える参照ファイル（軽量モデルでの品質低下の原因切り分けに使う）
    makeScopeFile(
      base.tmpDir,
      "huge.md",
      "x".repeat(GENERATE_CONTEXT_FILE_CHAR_LIMIT + 1),
    );
    const { provider } = makeProvider([
      { text: "done", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "p",
      path: "out.html",
      instruction: "書く",
      context_paths: ["huge.md"],
    });
    const record = outcome.result as Record<string, unknown>;
    expect(record.error).toBeUndefined();
    // 子プロンプトの見出しと同じ解決後パスで示す
    expect(record.truncatedContextPaths).toEqual([scopeDisplayPath("huge.md")]);
    expect(outcome.display.display).toContain("切り詰め");
    expect(outcome.display.display).toContain("huge.md");
    // 事実の報告に留め、リトライを促さない
    expect(outcome.display.display).not.toContain("再試行");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("omits truncation info when every context file fits", async () => {
    const base = makeProject();
    makeScopeFile(base.tmpDir, "notes.md", "outline-content");
    const { provider } = makeProvider([
      { text: "done", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "p",
      path: "out.html",
      instruction: "書く",
      context_paths: ["notes.md"],
    });
    const record = outcome.result as Record<string, unknown>;
    expect(record.error).toBeUndefined();
    expect(record).not.toHaveProperty("truncatedContextPaths");
    expect(outcome.display.display).not.toContain("切り詰め");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("rejects context_paths that escape the read zones without calling the LLM", async () => {
    const base = makeProject();
    fs.mkdirSync(path.join(base.tmpDir, "outside"), { recursive: true });
    fs.writeFileSync(path.join(base.tmpDir, "outside", "secret.md"), "secret");
    const { provider, calls } = makeProvider([
      { text: "x", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "p",
      path: "out.html",
      instruction: "書く",
      context_paths: ["../../outside/secret.md"],
    });
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("不正なパスです"),
    });
    expect(calls).toHaveLength(0);
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("rejects skill-zone write targets without calling the LLM", async () => {
    const base = makeProject();
    const { provider, calls } = makeProvider([
      { text: "x", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "p",
      path: "skill/my-skill/references/out.html",
      instruction: "書く",
    });
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("スキルディレクトリ"),
    });
    expect(calls).toHaveLength(0);
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("strips an enclosing code fence from a section", async () => {
    const base = makeProject();
    const { provider } = makeProvider([
      { text: "```html\n<div>body</div>\n```", stopReason: "end_turn" },
    ]);
    await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "p",
      path: "out.html",
      instruction: "書く",
    });
    expect(
      fs.readFileSync(path.join(base.projectDir, "out.html"), "utf-8"),
    ).toBe("<div>body</div>");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("diverts to the work dir instead of overwriting a framed template", async () => {
    const base = makeProject();
    const framePath = path.join(base.projectDir, "output", "diagram.html");
    fs.mkdirSync(path.dirname(framePath), { recursive: true });
    const frame = [
      "<html><head><script src=cdn></script></head><body>",
      "<!-- CONTENT_START -->",
      "",
      "<!-- CONTENT_END -->",
      "</body></html>",
    ].join("\n");
    fs.writeFileSync(framePath, frame, "utf-8");

    const { provider } = makeProvider([
      { text: "<div>本文</div>", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "図解生成",
      path: "output/diagram.html",
      instruction: "図解本文を書く",
    });

    // 額縁は 1 バイトも変わらない
    expect(fs.readFileSync(framePath, "utf-8")).toBe(frame);
    // 生成物は退避先に残る（エラーではなく成功として返る）
    expect(outcome.result).toMatchObject({
      diverted: true,
      path: scopeDisplayPath("_work/output__diagram.html"),
      requestedPath: scopeDisplayPath("output/diagram.html"),
      markerNames: ["CONTENT"],
    });
    expect(outcome.result).not.toMatchObject({ error: expect.anything() });
    expect(
      fs.readFileSync(
        path.join(base.projectDir, "_work", "output__diagram.html"),
        "utf-8",
      ),
    ).toBe("<div>本文</div>");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("writes through when the target has no marker sections", async () => {
    const base = makeProject();
    const target = path.join(base.projectDir, "output", "plain.html");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "<html><body>旧</body></html>", "utf-8");

    const { provider } = makeProvider([
      { text: "<div>新</div>", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "上書き",
      path: "output/plain.html",
      instruction: "書く",
    });

    expect(outcome.result).toMatchObject({
      path: scopeDisplayPath("output/plain.html"),
    });
    expect(outcome.result).not.toMatchObject({ diverted: true });
    expect(fs.readFileSync(target, "utf-8")).toBe("<div>新</div>");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("splices into the named marker section and keeps the frame", async () => {
    const base = makeProject();
    const framePath = path.join(base.projectDir, "output", "diagram.html");
    fs.mkdirSync(path.dirname(framePath), { recursive: true });
    fs.writeFileSync(
      framePath,
      [
        "<html><head><script src=cdn></script></head><body>",
        "<!-- CONTENT_START -->",
        "",
        "<!-- CONTENT_END -->",
        "</body></html>",
      ].join("\n"),
      "utf-8",
    );

    const { provider } = makeProvider([
      { text: "<div>図解本文</div>", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "図解生成",
      path: "output/diagram.html",
      instruction: "図解本文を書く",
      marker: "CONTENT",
    });

    expect(outcome.result).toMatchObject({
      path: scopeDisplayPath("output/diagram.html"),
      marker: "CONTENT",
    });
    const written = fs.readFileSync(framePath, "utf-8");
    expect(written).toContain("<script src=cdn></script>");
    expect(written).toContain("</body></html>");
    expect(written).toContain("<!-- CONTENT_START -->");
    expect(written).toContain("<div>図解本文</div>");
    expect(written).toContain("<!-- CONTENT_END -->");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("replaces only the named section of a multi-section frame", async () => {
    const base = makeProject();
    const framePath = path.join(base.projectDir, "output", "minutes.html");
    fs.mkdirSync(path.dirname(framePath), { recursive: true });
    fs.writeFileSync(
      framePath,
      [
        "<!-- AGENDA_LIST_START -->",
        "<li>既存の議題</li>",
        "<!-- AGENDA_LIST_END -->",
        "<!-- AGENDA_DETAILS_START -->",
        "",
        "<!-- AGENDA_DETAILS_END -->",
        "<!-- ACTION_PLAN_START -->",
        "<tr>既存のアクション</tr>",
        "<!-- ACTION_PLAN_END -->",
      ].join("\n"),
      "utf-8",
    );

    const { provider } = makeProvider([
      { text: "<section>詳細</section>", stopReason: "end_turn" },
    ]);
    await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "議事録",
      path: "output/minutes.html",
      instruction: "詳細を書く",
      marker: "AGENDA_DETAILS",
    });

    const written = fs.readFileSync(framePath, "utf-8");
    expect(written).toContain("<li>既存の議題</li>");
    expect(written).toContain("<tr>既存のアクション</tr>");
    expect(written).toContain("<section>詳細</section>");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("accepts the bare name and the full comment form as the same section", async () => {
    const frame = ["<!-- CONTENT_START -->", "", "<!-- CONTENT_END -->"].join(
      "\n",
    );

    const results: string[] = [];
    for (const marker of ["CONTENT", "<!-- CONTENT_START -->"]) {
      const base = makeProject();
      const framePath = path.join(base.projectDir, "out.html");
      fs.writeFileSync(framePath, frame, "utf-8");
      const { provider } = makeProvider([
        { text: "<p>本文</p>", stopReason: "end_turn" },
      ]);
      await executeGenerateAndWrite(makeContext(base, provider), {
        purpose: "p",
        path: "out.html",
        instruction: "書く",
        marker,
      });
      results.push(fs.readFileSync(framePath, "utf-8"));
      fs.rmSync(base.tmpDir, { recursive: true, force: true });
    }

    expect(results[0]).toBe(results[1]);
    expect(results[0]).toContain("<p>本文</p>");
  });

  it("keeps the generated body when the named section is missing", async () => {
    const base = makeProject();
    const framePath = path.join(base.projectDir, "output", "minutes.html");
    fs.mkdirSync(path.dirname(framePath), { recursive: true });
    const frame = [
      "<!-- AGENDA_LIST_START -->",
      "",
      "<!-- AGENDA_LIST_END -->",
    ].join("\n");
    fs.writeFileSync(framePath, frame, "utf-8");

    const { provider } = makeProvider([
      { text: "<section>詳細</section>", stopReason: "end_turn" },
    ]);
    const outcome = await executeGenerateAndWrite(makeContext(base, provider), {
      purpose: "議事録",
      path: "output/minutes.html",
      instruction: "詳細を書く",
      marker: "NO_SUCH_SECTION",
    });

    // 対象は変更されず、生成本文も失われない
    expect(fs.readFileSync(framePath, "utf-8")).toBe(frame);
    expect(outcome.result).toMatchObject({
      diverted: true,
      markerNotFound: "NO_SUCH_SECTION",
      availableMarkers: ["AGENDA_LIST"],
      path: scopeDisplayPath("_work/output__minutes.html"),
    });
    expect(
      fs.readFileSync(
        path.join(base.projectDir, "_work", "output__minutes.html"),
        "utf-8",
      ),
    ).toBe("<section>詳細</section>");
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });

  it("errors when no generate config is present", async () => {
    const base = makeProject();
    const outcome = await executeGenerateAndWrite(
      {
        projectRoot: base.tmpDir,
        workScopeKey: SCOPE,
      },
      { purpose: "p", path: "out.html", instruction: "書く" },
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("LLM 設定"),
    });
    fs.rmSync(base.tmpDir, { recursive: true, force: true });
  });
});
