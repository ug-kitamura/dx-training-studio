import { describe, expect, it, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkPermissionModelSupport,
  checkScriptSyntax,
  resetPermissionModelSupportCache,
  runScriptInSandbox,
  truncateScriptOutput,
  SCRIPT_OUTPUT_CHAR_LIMIT,
} from "@/lib/agent/tools/script-sandbox";

function makeSandboxDirs() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-sandbox-"));
  const projectDir = path.join(base, "project");
  const skillDir = path.join(base, "skill");
  const outsideDir = path.join(base, "outside");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(skillDir, { recursive: true });
  fs.mkdirSync(outsideDir, { recursive: true });
  return { base, projectDir, skillDir, outsideDir };
}

/** kill 直後のハンドル解放待ちを含む一時フォルダ削除（削除失敗は握りつぶす） */
async function removeDirWithRetry(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  // 一時フォルダの残留は無害（OS が回収する）
}

describe("script-sandbox", () => {
  beforeEach(() => {
    resetPermissionModelSupportCache();
  });

  it("supports the permission model on the test environment", async () => {
    await expect(checkPermissionModelSupport()).resolves.toBe(true);
  });

  it("writes inside the project via relative path", async () => {
    const { base, projectDir } = makeSandboxDirs();
    const result = await runScriptInSandbox(
      {
        kind: "code",
        code: `const fs = require("fs"); fs.writeFileSync("out.txt", "hello"); console.log("done");`,
      },
      { projectDirAbsolute: projectDir },
    );
    expect(result.ok).toBe(true);
    expect(fs.readFileSync(path.join(projectDir, "out.txt"), "utf-8")).toBe(
      "hello",
    );
    if (result.ok) {
      expect(result.stdout).toContain("done");
    }
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("fails when writing outside the project", async () => {
    const { base, projectDir, outsideDir } = makeSandboxDirs();
    const escaped = JSON.stringify(path.join(outsideDir, "escape.txt"));
    const result = await runScriptInSandbox(
      {
        kind: "code",
        code: `const fs = require("fs"); fs.writeFileSync(${escaped}, "x");`,
      },
      { projectDirAbsolute: projectDir },
    );
    expect(result.ok).toBe(false);
    expect(fs.existsSync(path.join(outsideDir, "escape.txt"))).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("スクリプト実行エラー");
    }
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("reads the skill dir but cannot write to it", async () => {
    const { base, projectDir, skillDir } = makeSandboxDirs();
    fs.writeFileSync(
      path.join(skillDir, "base.html"),
      "<html>tpl</html>",
      "utf-8",
    );
    // ⚠ パスは path.join で組み、埋め込みは JSON.stringify に任せること。
    //    path.join が区切り文字を、JSON.stringify が文字列リテラルの escape を
    //    担う。手書きの replace(/\\/g, "\\\\") はバックスラッシュを含まない
    //    パス（Linux）では空振りし、片方の OS でだけ壊れる——CI が ubuntu で
    //    落ちた原因がこれだった。
    const skillFile = JSON.stringify(path.join(skillDir, "base.html"));
    const hackedFile = JSON.stringify(path.join(skillDir, "hacked.txt"));
    const readResult = await runScriptInSandbox(
      {
        kind: "code",
        code: `const fs = require("fs"); const t = fs.readFileSync(${skillFile}, "utf-8"); fs.writeFileSync("out.html", t); console.log("copied");`,
      },
      { projectDirAbsolute: projectDir, skillDirAbsolute: skillDir },
    );
    expect(readResult.ok).toBe(true);
    expect(fs.readFileSync(path.join(projectDir, "out.html"), "utf-8")).toBe(
      "<html>tpl</html>",
    );

    const writeResult = await runScriptInSandbox(
      {
        kind: "code",
        code: `const fs = require("fs"); fs.writeFileSync(${hackedFile}, "x");`,
      },
      { projectDirAbsolute: projectDir, skillDirAbsolute: skillDir },
    );
    expect(writeResult.ok).toBe(false);
    expect(fs.existsSync(path.join(skillDir, "hacked.txt"))).toBe(false);
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("kills scripts that exceed the timeout", async () => {
    const { base, projectDir } = makeSandboxDirs();
    const result = await runScriptInSandbox(
      { kind: "code", code: "for(;;){}" },
      { projectDirAbsolute: projectDir, timeoutMs: 1_500 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.timedOut).toBe(true);
      expect(result.error).toContain("タイムアウト");
    }
    fs.rmSync(base, { recursive: true, force: true });
  }, 15_000);

  it("aborts a running script when the signal fires (distinct from timeout)", async () => {
    const { base, projectDir } = makeSandboxDirs();
    const controller = new AbortController();
    // 長時間ループ。タイムアウト（既定 30s）より十分早く abort する
    const promise = runScriptInSandbox(
      { kind: "code", code: "for(;;){}" },
      { projectDirAbsolute: projectDir, signal: controller.signal },
    );
    setTimeout(() => controller.abort(), 300);
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.aborted).toBe(true);
      expect(result.timedOut).toBeUndefined();
      expect(result.error).toContain("中断");
    }
    // Windows では kill 直後に子プロセスのハンドル解放が遅れ、
    // 即時 rmSync が EPERM になることがある（本体挙動とは無関係の後始末競合）
    await removeDirWithRetry(base);
  }, 15_000);

  it("blocks spawning child processes", async () => {
    const { base, projectDir } = makeSandboxDirs();
    const result = await runScriptInSandbox(
      {
        kind: "code",
        code: `const cp = require("child_process"); cp.execSync("node -e 1");`,
      },
      { projectDirAbsolute: projectDir },
    );
    expect(result.ok).toBe(false);
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("runs a skill-provided script file with args", async () => {
    const { base, projectDir, skillDir } = makeSandboxDirs();
    const scriptsDir = path.join(skillDir, "scripts");
    fs.mkdirSync(scriptsDir, { recursive: true });
    const scriptPath = path.join(scriptsDir, "build.cjs");
    fs.writeFileSync(
      scriptPath,
      `const fs = require("fs"); fs.writeFileSync(process.argv[2], "built"); console.log("ok");`,
      "utf-8",
    );
    const result = await runScriptInSandbox(
      { kind: "file", scriptPathAbsolute: scriptPath, args: ["result.txt"] },
      { projectDirAbsolute: projectDir, skillDirAbsolute: skillDir },
    );
    expect(result.ok).toBe(true);
    expect(fs.readFileSync(path.join(projectDir, "result.txt"), "utf-8")).toBe(
      "built",
    );
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("detects syntax errors without executing", async () => {
    const result = await checkScriptSyntax(
      `const fs = require("fs"; fs.writeFileSync("x.txt", "boom");`,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.error).not.toContain(os.tmpdir());
    }
  });

  it("accepts valid syntax", async () => {
    const result = await checkScriptSyntax(`const fs = require("fs");`);
    expect(result.ok).toBe(true);
  });

  it("truncates long output", () => {
    const long = "a".repeat(SCRIPT_OUTPUT_CHAR_LIMIT + 100);
    const truncated = truncateScriptOutput(long);
    expect(truncated).toContain("切り詰め");
    expect(truncated.length).toBeLessThan(long.length + 100);
  });

  it("reads a skill file directly via DX_STUDIO_SKILL_DIR", async () => {
    const { base, projectDir, skillDir } = makeSandboxDirs();
    fs.writeFileSync(
      path.join(skillDir, "style.css"),
      "body { color: red; }",
      "utf-8",
    );
    const result = await runScriptInSandbox(
      {
        kind: "code",
        code: `
          const fs = require("fs");
          const path = require("path");
          const css = fs.readFileSync(
            path.join(process.env.DX_STUDIO_SKILL_DIR, "style.css"),
            "utf-8",
          );
          fs.writeFileSync("out.css", css);
          console.log("read via env");
        `,
      },
      { projectDirAbsolute: projectDir, skillDirAbsolute: skillDir },
    );
    expect(result.ok).toBe(true);
    expect(fs.readFileSync(path.join(projectDir, "out.css"), "utf-8")).toBe(
      "body { color: red; }",
    );
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("sets DX_STUDIO_PROJECT_DIR and leaves DX_STUDIO_SKILL_DIR unset outside a skill", async () => {
    const { base, projectDir } = makeSandboxDirs();
    const result = await runScriptInSandbox(
      {
        kind: "code",
        code: `
          const fs = require("fs");
          fs.writeFileSync(
            "env.json",
            JSON.stringify({
              projectDir: process.env.DX_STUDIO_PROJECT_DIR ?? null,
              hasSkillDir: "DX_STUDIO_SKILL_DIR" in process.env,
            }),
          );
        `,
      },
      { projectDirAbsolute: projectDir },
    );
    expect(result.ok).toBe(true);
    const written = JSON.parse(
      fs.readFileSync(path.join(projectDir, "env.json"), "utf-8"),
    ) as { projectDir: string | null; hasSkillDir: boolean };
    expect(written.projectDir).toBe(path.resolve(projectDir));
    expect(written.hasSkillDir).toBe(false);
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("does not inherit the server process's secret environment variables", async () => {
    const { base, projectDir } = makeSandboxDirs();
    process.env.EBEX_TEST_SECRET = "super-secret-value";
    try {
      const result = await runScriptInSandbox(
        {
          kind: "code",
          code: `
            const fs = require("fs");
            fs.writeFileSync(
              "secret.json",
              JSON.stringify({ leaked: "EBEX_TEST_SECRET" in process.env }),
            );
          `,
        },
        { projectDirAbsolute: projectDir },
      );
      expect(result.ok).toBe(true);
      const written = JSON.parse(
        fs.readFileSync(path.join(projectDir, "secret.json"), "utf-8"),
      ) as { leaked: boolean };
      expect(written.leaked).toBe(false);
    } finally {
      delete process.env.EBEX_TEST_SECRET;
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});
