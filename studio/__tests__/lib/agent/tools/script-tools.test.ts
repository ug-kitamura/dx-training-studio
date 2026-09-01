import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  executeRegisteredTool,
  isLikelyBlockedToolName,
  normalizeScriptToolCall,
  preflightScriptToolCall,
  resolveToolDefinitions,
} from "@/lib/agent/tools/registry";
import {
  SCOPE,
  makeScope,
  scopeDisplayPath,
} from "@/__tests__/helpers/work-scope-fixture";

function makeProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-script-tools-"));
  makeScope(tmpDir);
  const skillDir = path.join(tmpDir, "skill-zone", "my-skill");
  fs.mkdirSync(path.join(skillDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
  const context = {
    projectRoot: tmpDir,
    workScopeKey: SCOPE,
    skillId: "my-skill",
    skillDirAbsolute: skillDir,
  };
  const projectDir = path.join(tmpDir, "contents", ...SCOPE.split("/"));
  return { tmpDir, skillDir, context, projectDir };
}

describe("script tool definitions", () => {
  it("always includes run_script but gates run_skill_script on scripts/", () => {
    const withoutScripts = resolveToolDefinitions(["run_script", "run_skill_script"]).map((d) => d.name);
    expect(withoutScripts).toContain("run_script");
    expect(withoutScripts).not.toContain("run_skill_script");

    const withScripts = resolveToolDefinitions(["run_script", "run_skill_script"], {
      hasSkillScripts: true,
    }).map((d) => d.name);
    expect(withScripts).toContain("run_skill_script");
  });

  it("does not treat registered script tools as blocked names", () => {
    expect(isLikelyBlockedToolName("run_script")).toBe(false);
    expect(isLikelyBlockedToolName("run_skill_script")).toBe(false);
    expect(isLikelyBlockedToolName("run_shell")).toBe(true);
  });
});

describe("executeRegisteredTool run_script", () => {
  it("writes a file via sandboxed code and returns summary only", async () => {
    const { tmpDir, context, projectDir } = makeProject();
    const outcome = await executeRegisteredTool(
      "run_script",
      {
        purpose: "テスト成果物の生成",
        code: `const fs = require("fs"); fs.writeFileSync("output.html", "<html>" + "x".repeat(1000) + "</html>"); console.log("built");`,
        writes: ["output.html"],
      },
      context,
    );
    expect(outcome.result).toMatchObject({
      writes: [scopeDisplayPath("output.html")],
    });
    const record = outcome.result as Record<string, unknown>;
    expect(record.error).toBeUndefined();
    expect(String(record.stdout)).toContain("built");
    // 成果物本文は tool_result に載らない
    expect(JSON.stringify(outcome.result)).not.toContain("<html>");
    expect(fs.existsSync(path.join(projectDir, "output.html"))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects writes declared outside the write roots", async () => {
    const { tmpDir, context } = makeProject();
    // 実行中スキル配下は読取専用ゾーン。書込ルート（contents/ と contents-work/）の外側
    const outcome = await executeRegisteredTool(
      "run_script",
      {
        purpose: "テスト",
        code: `const fs = require("fs");`,
        writes: ["skill/my-skill/scripts/escape.cjs"],
      },
      context,
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("プロジェクト内のパスのみ"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns stderr and exit code on runtime failure", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await executeRegisteredTool(
      "run_script",
      {
        purpose: "テスト",
        code: `throw new Error("boom-runtime");`,
        writes: [],
      },
      context,
    );
    const record = outcome.result as Record<string, unknown>;
    expect(String(record.error)).toContain("スクリプト実行エラー");
    expect(String(record.stderr)).toContain("boom-runtime");
    expect(record.recoverable).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("executeRegisteredTool run_skill_script", () => {
  it("runs a script bundled in the running skill", async () => {
    const { tmpDir, skillDir, context, projectDir } = makeProject();
    fs.writeFileSync(
      path.join(skillDir, "scripts", "build.cjs"),
      `const fs = require("fs"); fs.writeFileSync(process.argv[2] ?? "out.txt", "built-by-skill");`,
      "utf-8",
    );
    const outcome = await executeRegisteredTool(
      "run_skill_script",
      {
        script_path: "scripts/build.cjs",
        args: ["result.txt"],
        purpose: "スキルスクリプトの実行",
      },
      context,
    );
    expect(outcome.result).toMatchObject({
      script: "skill/my-skill/scripts/build.cjs",
    });
    expect(fs.readFileSync(path.join(projectDir, "result.txt"), "utf-8")).toBe(
      "built-by-skill",
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects scripts outside the running skill scripts dir", async () => {
    const { tmpDir, skillDir, context } = makeProject();
    fs.writeFileSync(
      path.join(skillDir, "references", "not-a-script.cjs"),
      "1;",
      "utf-8",
    );
    const outcome = await executeRegisteredTool(
      "run_skill_script",
      { script_path: "references/not-a-script.cjs", purpose: "テスト" },
      context,
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("scripts/ 配下"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects missing scripts", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await executeRegisteredTool(
      "run_skill_script",
      { script_path: "scripts/missing.cjs", purpose: "テスト" },
      context,
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("見つかりません"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects when no skill is running", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-script-tools-"));
    makeScope(tmpDir);
    const outcome = await executeRegisteredTool(
      "run_skill_script",
      { script_path: "scripts/build.cjs", purpose: "テスト" },
      { projectRoot: tmpDir, workScopeKey: SCOPE },
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("実行中スキルがない"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("preflightScriptToolCall", () => {
  it("returns syntax error outcome before confirmation", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await preflightScriptToolCall(
      "run_script",
      {
        purpose: "テスト",
        code: `const fs = require("fs"; broken`,
        writes: [],
      },
      context,
    );
    expect(outcome).not.toBeNull();
    expect(outcome?.result).toMatchObject({
      error: expect.stringContaining("構文エラー"),
      recoverable: true,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes valid code through to confirmation", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await preflightScriptToolCall(
      "run_script",
      { purpose: "テスト", code: `const fs = require("fs");`, writes: [] },
      context,
    );
    expect(outcome).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("blocks run_script network access before confirmation", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await preflightScriptToolCall(
      "run_script",
      {
        purpose: "テスト",
        code: `fetch("https://example.com/api").then(() => {});`,
        writes: [],
      },
      context,
    );
    expect(outcome).not.toBeNull();
    expect(outcome?.result).toMatchObject({
      blocked: true,
      reason: expect.stringContaining("ネットワーク"),
      recoverable: true,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects missing skill scripts before confirmation", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await preflightScriptToolCall(
      "run_skill_script",
      { script_path: "scripts/missing.cjs", purpose: "テスト" },
      context,
    );
    expect(outcome).not.toBeNull();
    expect(outcome?.result).toMatchObject({
      error: expect.stringContaining("見つかりません"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for non-script tools", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await preflightScriptToolCall(
      "write_file",
      { path: "a.md", content: "x" },
      context,
    );
    expect(outcome).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("normalizeScriptToolCall", () => {
  it("keeps valid run_script input unchanged", () => {
    const input = { purpose: "p", code: "const fs = 1;", writes: [] };
    const normalized = normalizeScriptToolCall("run_script", input);
    expect(normalized.name).toBe("run_script");
    expect(normalized.input).toBe(input);
  });

  it("salvages code from alias keys", () => {
    for (const alias of ["script", "content", "source", "js"]) {
      const normalized = normalizeScriptToolCall("run_script", {
        purpose: "p",
        [alias]: "const x = 1;",
        writes: [],
      });
      expect(normalized.name).toBe("run_script");
      expect(normalized.input.code).toBe("const x = 1;");
    }
  });

  it("redirects run_script with script_path to run_skill_script", () => {
    const normalized = normalizeScriptToolCall("run_script", {
      purpose: "p",
      script_path: "scripts/build.cjs",
    });
    expect(normalized.name).toBe("run_skill_script");
  });

  it("redirects run_skill_script with code to run_script", () => {
    const normalized = normalizeScriptToolCall("run_skill_script", {
      purpose: "p",
      code: "const x = 1;",
      writes: [],
    });
    expect(normalized.name).toBe("run_script");
    expect(normalized.input.code).toBe("const x = 1;");
  });

  it("leaves truly empty input for the broken tool_use path", () => {
    const normalized = normalizeScriptToolCall("run_script", {
      purpose: "p",
      writes: ["out.html"],
    });
    expect(normalized.name).toBe("run_script");
    expect(normalized.input.code).toBeUndefined();
  });

  it("does not touch non-script tools", () => {
    const input = { path: "a.md", content: "x" };
    const normalized = normalizeScriptToolCall("write_file", input);
    expect(normalized).toEqual({ name: "write_file", input });
  });
});
