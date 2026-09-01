import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  executeRegisteredTool,
  resolveToolDefinitions,
} from "@/lib/agent/tools/registry";
import { resolveConfirmRequirement } from "@/lib/agent/tools/confirm-gate";
import {
  SCOPE,
  makeScope,
  scopeAbsolute,
} from "@/__tests__/helpers/work-scope-fixture";

const SAMPLE = [
  '<!DOCTYPE html><html lang="ja"><head>',
  '<script src="https://cdn.tailwindcss.com"></script>',
  "<script>tailwind.config = { theme: { extend: { colors: { bosch: { bg: '#FFFFFF' } } } } }</script>",
  "</head><body>",
  '<div class="bg-bosch-bg md:grid-cols-3 hover:shadow-lg"><i data-lucide="file-text" class="w-6 h-6"></i></div>',
  '<script src="https://unpkg.com/lucide@latest"></script>',
  "<script>lucide.createIcons();</script>",
  "</body></html>",
].join("\n");

describe("inline_html_assets tool", () => {
  it("is exposed without requiring a skill scripts/ directory", () => {
    const names = resolveToolDefinitions(["inline_html_assets"]).map((d) => d.name);
    expect(names).toContain("inline_html_assets");
    expect(names).not.toContain("run_skill_script");
  });

  it("asks for a single confirmation covering every target", () => {
    const requirement = resolveConfirmRequirement("/root", "demo", {
      id: "1",
      name: "inline_html_assets",
      input: { paths: ["output/a.html", "output/b.html"] },
    });
    expect(requirement?.kind).toBe("inline-assets");
    expect(requirement?.inlineAssets?.targets).toEqual([
      "output/a.html",
      "output/b.html",
    ]);
  });

  it("processes multiple files in one call", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-inline-"));
    makeScope(tmpDir);
    const folder = scopeAbsolute(tmpDir);
    fs.mkdirSync(path.join(folder, "output"), { recursive: true });
    fs.writeFileSync(path.join(folder, "output", "ja.html"), SAMPLE, "utf-8");
    fs.writeFileSync(path.join(folder, "output", "en.html"), SAMPLE, "utf-8");

    const outcome = await executeRegisteredTool(
      "inline_html_assets",
      { paths: ["output/ja.html", "output/en.html"] },
      { projectRoot: tmpDir, workScopeKey: SCOPE },
    );

    expect((outcome.result as { error?: string }).error).toBeUndefined();
    const files = (outcome.result as { files: Array<Record<string, number>> })
      .files;
    expect(files).toHaveLength(2);

    for (const name of ["ja.html", "en.html"]) {
      const out = fs.readFileSync(
        path.join(folder, "output", name),
        "utf-8",
      );
      expect(out).not.toContain("cdn.tailwindcss.com");
      expect(out).not.toContain("unpkg.com/lucide");
      expect(out).not.toContain("data-lucide");
      expect(out).toContain("data-inlined-tailwind");
      expect(out).toContain(".bg-bosch-bg");
      expect(out).toContain("md\\:grid-cols-3");
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }, 30_000);

  it("rejects paths that escape the project folder", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-inline-"));
    makeScope(tmpDir);
    const outcome = await executeRegisteredTool(
      "inline_html_assets",
      { paths: ["../../etc/hosts"] },
      { projectRoot: tmpDir, workScopeKey: SCOPE },
    );
    expect((outcome.result as { error?: string }).error).toBeTruthy();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("errors when a target does not exist", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-inline-"));
    makeScope(tmpDir);
    const outcome = await executeRegisteredTool(
      "inline_html_assets",
      { paths: ["output/missing.html"] },
      { projectRoot: tmpDir, workScopeKey: SCOPE },
    );
    expect((outcome.result as { error?: string }).error).toContain("見つかりません");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
