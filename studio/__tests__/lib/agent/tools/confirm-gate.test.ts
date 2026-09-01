import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectWrittenPathsFromToolResult,
  resolveConfirmRequirement,
} from "@/lib/agent/tools/confirm-gate";
import {
  SCOPE,
  makeScope,
  makeScopeFile,
  scopeAbsolute,
  scopeDisplayPath,
} from "@/__tests__/helpers/work-scope-fixture";

describe("resolveConfirmRequirement", () => {
  it("does not require confirm for project-internal read tools", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "notes.md", "hello");
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "read_file",
      input: { path: "notes.md" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not confirm reads the path guard rejects", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    // 書込ルートの外は確認ダイアログではなくツール自身のエラーで止まる
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "read_file",
      input: { path: "../outside/notes.md" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not require confirm for new write inside project", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "output/new.md", content: "x" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires overwrite confirm for existing file inside project", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "notes.md", "old");
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "notes.md", content: "new" },
    });
    expect(req).toEqual({
      kind: "overwrite",
      path: scopeDisplayPath("notes.md"),
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not confirm writes the path guard rejects", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "../outside/new.md", content: "x" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires overwrite confirm for existing files in the plan tree", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const planPath = path.join(tmpDir, "contents-work", "plans", "20260811.md");
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(planPath, "old");
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "contents-work/plans/20260811.md", content: "new" },
    });
    expect(req).toEqual({
      kind: "overwrite",
      path: "contents-work/plans/20260811.md",
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not require confirm for skill-zone reads", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(path.join(skillDir, "references", "purpose.md"), "x");
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: m\n---\n");

    const req = resolveConfirmRequirement(
      tmpDir,
      SCOPE,
      {
        id: "t1",
        name: "read_file",
        input: { path: "references/purpose.md" },
      },
      {
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
      },
    );
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires overwrite confirm when copy_file target exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "dest.html", "old");
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(path.join(skillDir, "references", "base.html"), "base");

    const req = resolveConfirmRequirement(
      tmpDir,
      SCOPE,
      {
        id: "t1",
        name: "copy_file",
        input: { from: "references/base.html", to: "dest.html" },
      },
      { skillId: "minutes-maid", skillDirAbsolute: skillDir },
    );
    expect(req).toEqual({
      kind: "overwrite",
      path: scopeDisplayPath("dest.html"),
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires overwrite confirm for replace_in_file on existing file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "out.html", "{{TITLE}}");
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "replace_in_file",
      input: { path: "out.html", replacements: { TITLE: "x" } },
    });
    expect(req).toEqual({
      kind: "overwrite",
      path: scopeDisplayPath("out.html"),
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips overwrite when path was agent-created (skipOverwritePaths)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "out.html", "{{TITLE}}");
    const skip = new Set([scopeDisplayPath("out.html")]);
    const req = resolveConfirmRequirement(
      tmpDir,
      SCOPE,
      {
        id: "t1",
        name: "replace_in_file",
        input: { path: "out.html", replacements: { TITLE: "x" } },
      },
      { skipOverwritePaths: skip },
    );
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips overwrite for write_file after user approved once", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "notes.md", "old");
    const req = resolveConfirmRequirement(
      tmpDir,
      SCOPE,
      {
        id: "t1",
        name: "write_file",
        input: { path: "notes.md", content: "new" },
      },
      { skipOverwritePaths: new Set([scopeDisplayPath("notes.md")]) },
    );
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires overwrite for replace_between and append_file on existing files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "out.html", "x");
    makeScopeFile(tmpDir, "partial.txt", "a");

    expect(
      resolveConfirmRequirement(tmpDir, SCOPE, {
        id: "t1",
        name: "replace_between",
        input: {
          path: "out.html",
          start_marker: "a",
          end_marker: "b",
          content: "c",
        },
      }),
    ).toEqual({
      kind: "overwrite",
      path: scopeDisplayPath("out.html"),
      isNew: false,
    });

    expect(
      resolveConfirmRequirement(tmpDir, SCOPE, {
        id: "t2",
        name: "append_file",
        input: { path: "partial.txt", content: "b" },
      }),
    ).toEqual({
      kind: "overwrite",
      path: scopeDisplayPath("partial.txt"),
      isNew: false,
    });

    expect(
      resolveConfirmRequirement(
        tmpDir,
        SCOPE,
        {
          id: "t3",
          name: "append_file",
          input: { path: "partial.txt", content: "b" },
        },
        { skipOverwritePaths: new Set([scopeDisplayPath("partial.txt")]) },
      ),
    ).toBeNull();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not require overwrite confirm for existing files under _work/", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const workAbs = path.join(
      scopeAbsolute(tmpDir),
      "_work",
      "agenda_details_all.html",
    );
    fs.mkdirSync(path.dirname(workAbs), { recursive: true });
    fs.writeFileSync(workAbs, "old");
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "_work/agenda_details_all.html", content: "new" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("still requires overwrite confirm outside _work/ in the same project", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "_work_report.html", "old");
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "_work_report.html", content: "new" },
    });
    expect(req).toEqual({
      kind: "overwrite",
      path: scopeDisplayPath("_work_report.html"),
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not confirm app-owned files the path guard rejects", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    // コース階層の .meta.json は path guard が拒否する（確認ダイアログに回さない）
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "contents/シリーズA/コースB/.meta.json", content: "{}" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("confirms overwrite for the lesson-level .meta.json (guarded write)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, ".meta.json", "{}");
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: ".meta.json", content: "{}" },
    });
    expect(req).toEqual({
      kind: "overwrite",
      path: scopeDisplayPath(".meta.json"),
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("confirms folder creation for a brand-new series/course/lesson", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    fs.mkdirSync(path.join(tmpDir, "contents"), { recursive: true });
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "contents/新S/新C/新L/contents.md", content: "x" },
    });
    expect(req).toEqual({
      kind: "create-content-folder",
      path: "contents/新S/新C/新L/contents.md",
      isNew: true,
      createFolder: {
        folders: [
          { level: "series", name: "新S" },
          { level: "course", name: "新C" },
          { level: "lesson", name: "新L" },
        ],
      },
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("confirms only the lesson level when series and course already exist", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "contents/シリーズA/コースB/新L/contents.md", content: "x" },
    });
    expect(req).toEqual({
      kind: "create-content-folder",
      path: "contents/シリーズA/コースB/新L/contents.md",
      isNew: true,
      createFolder: { folders: [{ level: "lesson", name: "新L" }] },
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not confirm folder creation when every level exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "contents.md", content: "x" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not confirm folder creation below the lesson level", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    // レッスン配下の新規ディレクトリは構造を作らないので確認不要
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "assets/diagram.svg", content: "x" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not confirm folder creation for _ prefixed levels", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    fs.mkdirSync(path.join(tmpDir, "contents"), { recursive: true });
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "contents/_work/report.html", content: "x" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("prefers overwrite over folder creation for an existing lesson", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "contents.md", "old");
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "write_file",
      input: { path: "contents.md", content: "new" },
    });
    expect(req?.kind).toBe("overwrite");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("resolveConfirmRequirement for web_search", () => {
  it("uses web-search kind when search is available (key set)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(
      tmpDir,
      SCOPE,
      {
        id: "t1",
        name: "web_search",
        input: { query: "next.js 16", purpose: "調査" },
      },
      { searchAvailable: true },
    );
    expect(req?.kind).toBe("web-search");
    expect(req?.search).toEqual({ query: "next.js 16", purpose: "調査" });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses web-search-manual kind when search is unavailable (no key)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(
      tmpDir,
      SCOPE,
      {
        id: "t1",
        name: "web_search",
        input: { query: "next.js 16", purpose: "調査" },
      },
      { searchAvailable: false },
    );
    expect(req?.kind).toBe("web-search-manual");
    expect(req?.search).toEqual({ query: "next.js 16", purpose: "調査" });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for empty query", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(
      tmpDir,
      SCOPE,
      { id: "t1", name: "web_search", input: { query: "  " } },
      { searchAvailable: false },
    );
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("resolveConfirmRequirement for script tools", () => {
  it("requires confirmation for run_script every time (no skip)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "out.html", "old");
    const call = {
      id: "t1",
      name: "run_script",
      input: {
        purpose: "HTML の組み立て",
        code: 'const fs = require("fs");',
        writes: ["out.html", "new.txt"],
      },
    };
    const req = resolveConfirmRequirement(tmpDir, SCOPE, call, {
      skipOverwritePaths: new Set([scopeDisplayPath("out.html")]),
    });
    expect(req).not.toBeNull();
    expect(req?.kind).toBe("run-script");
    expect(req?.script?.purpose).toBe("HTML の組み立て");
    expect(req?.script?.writes).toEqual([
      { path: scopeDisplayPath("out.html"), exists: true },
      { path: scopeDisplayPath("new.txt"), exists: false },
    ]);
    expect(req?.script?.networkWarning).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("flags network access hints in run_script code", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "run_script",
      input: {
        purpose: "テスト",
        code: 'const https = require("https"); fetch("https://example.com");',
        writes: [],
      },
    });
    expect(req?.script?.networkWarning).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for run_script with empty code (broken tool_use path)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "run_script",
      input: { purpose: "テスト", code: "", writes: [] },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("builds run-skill-script confirmation with script code preview", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const skillDir = path.join(tmpDir, "skill-zone", "my-skill");
    fs.mkdirSync(path.join(skillDir, "scripts"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "scripts", "build.cjs"),
      'const fs = require("fs");',
      "utf-8",
    );
    const req = resolveConfirmRequirement(
      tmpDir,
      SCOPE,
      {
        id: "t1",
        name: "run_skill_script",
        input: {
          script_path: "scripts/build.cjs",
          args: ["out.html"],
          purpose: "スキルスクリプト",
        },
      },
      { skillId: "my-skill", skillDirAbsolute: skillDir },
    );
    expect(req?.kind).toBe("run-skill-script");
    expect(req?.path).toBe("skill/my-skill/scripts/build.cjs");
    expect(req?.script?.scriptPath).toBe("skill/my-skill/scripts/build.cjs");
    expect(req?.script?.code).toContain("require");
    expect(req?.script?.args).toEqual(["out.html"]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("resolveConfirmRequirement for generate_and_write", () => {
  it("requires confirmation every time, even for new and skip-listed paths", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const call = {
      id: "t1",
      name: "generate_and_write",
      input: {
        purpose: "図解本文の生成",
        path: "output/partial.html",
        instruction: "図解を書く",
        sections: ["導入", "本論"],
        context_paths: ["notes.md"],
      },
    };
    const req = resolveConfirmRequirement(tmpDir, SCOPE, call, {
      skipOverwritePaths: new Set([scopeDisplayPath("output/partial.html")]),
    });
    expect(req).not.toBeNull();
    expect(req?.kind).toBe("generate-write");
    expect(req?.path).toBe(scopeDisplayPath("output/partial.html"));
    expect(req?.isNew).toBe(true);
    expect(req?.generate).toEqual({
      purpose: "図解本文の生成",
      instruction: "図解を書く",
      sections: ["導入", "本論"],
      contextPaths: ["notes.md"],
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("shows the target section when marker is given", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "framed.html",
      "<!-- CONTENT_START --><!-- CONTENT_END -->",
    );
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "generate_and_write",
      input: {
        purpose: "p",
        path: "framed.html",
        instruction: "書く",
        marker: "<!-- CONTENT_START -->",
      },
    });
    expect(req?.kind).toBe("generate-write");
    // 完全形で渡されても素名で表示する
    expect(req?.generate?.marker).toBe("CONTENT");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("omits marker from the payload when not given", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "generate_and_write",
      input: { purpose: "p", path: "out.html", instruction: "書く" },
    });
    expect(req?.generate).not.toHaveProperty("marker");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("marks overwrite when the target exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    makeScopeFile(tmpDir, "out.html", "old");
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "generate_and_write",
      input: { purpose: "p", path: "out.html", instruction: "書く" },
    });
    expect(req?.kind).toBe("generate-write");
    expect(req?.isNew).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for targets the path guard rejects", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "generate_and_write",
      input: {
        purpose: "p",
        path: "../outside/out.html",
        instruction: "書く",
      },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("confirms generate-write into the plan tree", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "generate_and_write",
      input: {
        purpose: "p",
        path: "contents-work/runs/20260811-demo/design-note.md",
        instruction: "書く",
      },
    });
    expect(req?.kind).toBe("generate-write");
    expect(req?.path).toBe("contents-work/runs/20260811-demo/design-note.md");
    expect(req?.isNew).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for missing instruction (broken tool_use path)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    makeScope(tmpDir);
    const req = resolveConfirmRequirement(tmpDir, SCOPE, {
      id: "t1",
      name: "generate_and_write",
      input: { purpose: "p", path: "out.html" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("collects the generate_and_write result path for overwrite skip", () => {
    const paths = collectWrittenPathsFromToolResult({
      path: scopeDisplayPath("output/partial.html"),
      bytes: 12345,
      sections: 2,
      continuations: 1,
      durationMs: 100,
    });
    expect(paths).toEqual([scopeDisplayPath("output/partial.html")]);
  });
});

describe("collectWrittenPathsFromToolResult with writes", () => {
  it("collects run_script writes for overwrite skip", () => {
    const paths = collectWrittenPathsFromToolResult({
      writes: [scopeDisplayPath("out.html"), scopeDisplayPath("new.txt")],
      stdout: "",
      durationMs: 10,
    });
    expect(paths).toEqual([
      scopeDisplayPath("out.html"),
      scopeDisplayPath("new.txt"),
    ]);
  });
});
