import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveToolTargetPath } from "@/lib/agent/tools/fs-guard";
import { SCOPE, makeScope } from "@/__tests__/helpers/work-scope-fixture";

describe("resolveToolTargetPath", () => {
  it("resolves project-relative paths inside the project folder", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    makeScope(tmpDir);
    const resolved = resolveToolTargetPath(tmpDir, SCOPE, "notes.md");
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.relativePath).toBe(`contents/${SCOPE}/notes.md`);
    expect(resolved.insideProject).toBe(true);
    expect(resolved.insideSkill).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("workspace/ は特別扱いされず作業フォルダ配下へ閉じる", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    makeScope(tmpDir);
    const resolved = resolveToolTargetPath(
      tmpDir,
      SCOPE,
      "workspace/other/notes.md",
    );
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.relativePath).toBe(
      `contents/${SCOPE}/workspace/other/notes.md`,
    );
    expect(resolved.insideProject).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects parent traversal", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    const resolved = resolveToolTargetPath(tmpDir, SCOPE, "../secret.md");
    expect(resolved).toEqual({ error: "不正なパスです: ../secret.md" });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects absolute paths outside the write roots", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    const resolved = resolveToolTargetPath(
      tmpDir,
      SCOPE,
      "C:/Windows/system.ini",
    );
    expect("error" in resolved).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves skill-relative references when preferSkillIfExists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    makeScope(tmpDir);
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "purpose.md"),
      "purpose",
    );
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: m\n---\n");

    const resolved = resolveToolTargetPath(
      tmpDir,
      SCOPE,
      "references/purpose.md",
      {
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
        preferSkillIfExists: true,
      },
    );
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.insideSkill).toBe(true);
    expect(resolved.insideProject).toBe(false);
    expect(resolved.relativePath).toBe(
      "skill/minutes-maid/references/purpose.md",
    );
    expect(fs.readFileSync(resolved.absolutePath, "utf-8")).toBe("purpose");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not steal project root listing via preferSkillIfExists on '.'", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    makeScope(tmpDir);
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: m\n---\n");

    const resolved = resolveToolTargetPath(tmpDir, SCOPE, ".", {
      skillId: "minutes-maid",
      skillDirAbsolute: skillDir,
      preferSkillIfExists: true,
    });
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.insideProject).toBe(true);
    expect(resolved.insideSkill).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("明示 contents/ パスはスキル側へフォールバックしない", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    makeScope(tmpDir);
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "purpose.md"),
      "purpose",
    );
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: m\n---\n");

    const resolved = resolveToolTargetPath(
      tmpDir,
      SCOPE,
      "contents/references/purpose.md",
      {
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
        preferSkillIfExists: true,
      },
    );
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    // 明示プレフィックスは正本ツリーを指す意思表示なので、スキル側に同名があっても奪われない
    expect(resolved.insideSkill).toBe(false);
    expect(resolved.zone).toBe("contents");
    expect(resolved.relativePath).toBe("contents/references/purpose.md");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("accepts legacy .claude path for running skill mapped to skillDirAbsolute", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    makeScope(tmpDir);
    const skillDir = path.join(tmpDir, ".cursor", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "purpose.md"),
      "purpose",
    );
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: m\n---\n");

    const resolved = resolveToolTargetPath(
      tmpDir,
      SCOPE,
      ".claude/skills/minutes-maid/references/purpose.md",
      {
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
        preferSkillIfExists: true,
      },
    );
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.insideSkill).toBe(true);
    expect(resolved.relativePath).toBe(
      "skill/minutes-maid/references/purpose.md",
    );
    expect(resolved.absolutePath).toBe(
      path.join(skillDir, "references", "purpose.md"),
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("accepts logical skill/<id>/ path", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    makeScope(tmpDir);
    const skillDir = path.join(tmpDir, ".cursor", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(path.join(skillDir, "references", "base.html"), "html");
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: m\n---\n");

    const resolved = resolveToolTargetPath(
      tmpDir,
      SCOPE,
      "skill/minutes-maid/references/base.html",
      {
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
      },
    );
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.relativePath).toBe(
      "skill/minutes-maid/references/base.html",
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects other skill ids", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    makeScope(tmpDir);
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(skillDir, { recursive: true });
    const legacy = resolveToolTargetPath(
      tmpDir,
      SCOPE,
      ".claude/skills/other/references/x.md",
      {
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
        preferSkillIfExists: true,
      },
    );
    expect("error" in legacy).toBe(true);
    const logical = resolveToolTargetPath(
      tmpDir,
      SCOPE,
      "skill/other/references/x.md",
      {
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
        preferSkillIfExists: true,
      },
    );
    expect("error" in logical).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
