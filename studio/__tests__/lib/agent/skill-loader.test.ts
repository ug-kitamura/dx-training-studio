import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  buildSkillSystemPrompt,
  getSkillCatalogRoots,
  injectSkillVariables,
  listSkills,
  listVisibleSkills,
  loadSkill,
  parseSkillDocument,
  resolveSkillDir,
} from "@/lib/agent/skill-loader";

function writeSkill(
  root: string,
  id: string,
  frontmatter: string,
  body: string,
  convention: ".claude" | ".cursor" | ".agents" | ".github" = ".claude",
) {
  const dir = path.join(root, convention, "skills", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `---\n${frontmatter}\n---\n\n${body}`,
    "utf-8",
  );
}

describe("skill-loader", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-loader-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses frontmatter name, description, and variables", () => {
    const parsed = parseSkillDocument(`---
name: create-draft
description: |
  選択中レッスンの草稿を生成する
variables:
  - series
  - course
---

Generate a draft for {{series}} / {{course}}.`);

    expect(parsed.name).toBe("create-draft");
    expect(parsed.description).toBe("選択中レッスンの草稿を生成する");
    expect(parsed.variables).toEqual(["series", "course"]);
    expect(parsed.body).toContain("Generate a draft");
  });

  it("parses frontmatter even when SKILL.md starts with UTF-8 BOM", () => {
    const parsed = parseSkillDocument(
      `\uFEFF---
name: minutes-maid
description: |
  月例会議の音声文字起こしデータをもとに議事録を生成するスキル。
  「議事録を作って」と依頼された際に使用する。
---

# Minutes Maid`,
    );

    expect(parsed.name).toBe("minutes-maid");
    expect(parsed.description).toContain("月例会議の音声文字起こし");
    expect(parsed.description).toContain("議事録を作って");
  });

  it("normalizes CRLF in multiline description without leftover CR", () => {
    const parsed = parseSkillDocument(
      [
        "---",
        "name: minutes-maid",
        "description: |",
        "  月例会議の音声文字起こしデータをもとに議事録を生成するスキル。",
        "  「議事録を作って」と依頼された際に使用する。",
        "---",
        "",
        "# Body",
      ].join("\r\n"),
    );

    expect(parsed.description).toContain("月例会議の音声文字起こし");
    expect(parsed.description).toContain("議事録を作って");
    expect(parsed.description).not.toMatch(/\r/);
  });

  it("injects variables into skill body", () => {
    const result = injectSkillVariables("Series: {{series}}", {
      series: "DX基礎",
    });
    expect(result).toBe("Series: DX基礎");
  });

  it("lists skills in alphabetical order", () => {
    writeSkill(tmpDir, "create-draft", "name: draft\ndescription: d", "body");
    writeSkill(
      tmpDir,
      "create-structure",
      "name: structure\ndescription: s",
      "body",
    );
    writeSkill(tmpDir, "alpha-skill", "name: alpha\ndescription: a", "body");

    const skills = listSkills(tmpDir);
    expect(skills.map((skill) => skill.id)).toEqual([
      "alpha-skill",
      "create-draft",
      "create-structure",
    ]);
  });

  it("returns null when skill is missing", () => {
    expect(loadSkill(tmpDir, "missing-skill")).toBeNull();
  });

  it("flags mentionsImageIO when the skill body mentions image generation", () => {
    writeSkill(
      tmpDir,
      "image-skill",
      "name: image\ndescription: i",
      "Step1: 画像を生成してスライドに貼る",
    );
    writeSkill(tmpDir, "text-skill", "name: text\ndescription: t", "本文のみ");

    const skills = listSkills(tmpDir);
    expect(
      skills.find((skill) => skill.id === "image-skill")?.mentionsImageIO,
    ).toBe(true);
    expect(
      skills.find((skill) => skill.id === "text-skill")?.mentionsImageIO,
    ).toBe(false);
  });

  it("reports missing variables before invoke", () => {
    const skill = {
      id: "create-draft",
      name: "draft",
      description: "",
      variables: ["series", "course"],
      tools: ["search_company_context"],
      assets: [],
      body: "{{series}}",
    };
    const { missingVariables } = buildSkillSystemPrompt(skill, {
      series: "A",
    });
    expect(missingVariables).toEqual(["course"]);
  });

  it("parses tools frontmatter", () => {
    const parsed = parseSkillDocument(`---
name: create-draft
description: d
variables:
  - series
tools:
  - search_company_context
  - select_company_context
---

Body`);
    expect(parsed.tools).toEqual([
      "search_company_context",
      "select_company_context",
    ]);
  });

  it("parses assets frontmatter as a string list", () => {
    const parsed = parseSkillDocument(`---
name: demo
description: d
assets:
  - references/base.html
  - references/style.css
---

Body`);
    expect(parsed.assets).toEqual([
      "references/base.html",
      "references/style.css",
    ]);
  });

  it("parses inline assets array", () => {
    const parsed = parseSkillDocument(`---
name: demo
description: d
assets: [references/base.html, templates/card.svg]
---

Body`);
    expect(parsed.assets).toEqual([
      "references/base.html",
      "templates/card.svg",
    ]);
  });

  it("treats missing or invalid assets as empty", () => {
    expect(
      parseSkillDocument(`---
name: demo
description: d
---

Body`).assets,
    ).toEqual([]);
    expect(
      parseSkillDocument(`---
name: demo
description: d
assets: true
---

Body`).assets,
    ).toEqual([]);
    expect(
      parseSkillDocument(`---
name: demo
description: d
assets:
  - { path: references/base.html }
---

Body`).assets,
    ).toEqual([]);
  });

  it("loads assets onto LoadedSkill", () => {
    writeSkill(
      tmpDir,
      "with-assets",
      "name: a\ndescription: d\nassets:\n  - references/base.html",
      "body",
    );
    expect(loadSkill(tmpDir, "with-assets")?.assets).toEqual([
      "references/base.html",
    ]);
  });

  it("parses hidden frontmatter", () => {
    const parsed = parseSkillDocument(`---
name: general-chat
description: hidden chat
hidden: true
---

Body`);
    expect(parsed.hidden).toBe(true);
  });

  it("excludes hidden skills from listVisibleSkills", () => {
    writeSkill(tmpDir, "create-draft", "name: draft\ndescription: d", "body");
    writeSkill(
      tmpDir,
      "general-chat",
      "name: chat\ndescription: c\nhidden: true",
      "body",
    );

    expect(listSkills(tmpDir).map((skill) => skill.id)).toEqual([
      "create-draft",
      "general-chat",
    ]);
    expect(listVisibleSkills(tmpDir).map((skill) => skill.id)).toEqual([
      "create-draft",
    ]);
  });

  it("loads hidden skill via loadSkill", () => {
    writeSkill(
      tmpDir,
      "general-chat",
      "name: chat\ndescription: c\nhidden: true",
      "body",
    );
    const skill = loadSkill(tmpDir, "general-chat");
    expect(skill?.hidden).toBe(true);
  });

  it("merges ebex and host skill roots without duplicating the same path", () => {
    // dx は単一ルート（差分台帳 #2）。下位の複ルートマージは維持しているため
    // roots 配列を直接渡して検証する
    expect(getSkillCatalogRoots(tmpDir)).toEqual([path.resolve(tmpDir)]);

    const ebexRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-ebex-"));
    const hostRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-host-"));
    try {
      writeSkill(
        ebexRoot,
        "create-draft",
        "name: draft-ebex\ndescription: from ebex",
        "ebex body",
      );
      writeSkill(
        hostRoot,
        "report",
        "name: report\ndescription: from host",
        "host body",
      );
      writeSkill(
        hostRoot,
        "create-draft",
        "name: draft-host\ndescription: from host",
        "host draft",
      );

      const roots = [path.resolve(ebexRoot), path.resolve(hostRoot)];

      const skills = listSkills(roots);
      expect(skills.map((skill) => skill.id).sort()).toEqual([
        "create-draft",
        "report",
      ]);
      expect(skills.find((skill) => skill.id === "create-draft")?.name).toBe(
        "draft-host",
      );
      expect(loadSkill(roots, "create-draft")?.body).toContain("host draft");
      expect(loadSkill(roots, "report")?.description).toBe("from host");
    } finally {
      fs.rmSync(ebexRoot, { recursive: true, force: true });
      fs.rmSync(hostRoot, { recursive: true, force: true });
    }
  });

  it("orders host skills before ebex skills, id ascending within each root", () => {
    const ebexRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-ebex-ord-"));
    const hostRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-host-ord-"));
    try {
      writeSkill(ebexRoot, "alpha", "name: alpha\ndescription: e", "b");
      writeSkill(ebexRoot, "delta", "name: delta\ndescription: e", "b");
      writeSkill(hostRoot, "zeta", "name: zeta\ndescription: h", "b");
      writeSkill(hostRoot, "beta", "name: beta\ndescription: h", "b");

      const roots = [path.resolve(ebexRoot), path.resolve(hostRoot)];
      expect(listSkills(roots).map((skill) => skill.id)).toEqual([
        "beta",
        "zeta",
        "alpha",
        "delta",
      ]);
    } finally {
      fs.rmSync(ebexRoot, { recursive: true, force: true });
      fs.rmSync(hostRoot, { recursive: true, force: true });
    }
  });

  it("keeps a single id-ascending section when standalone", () => {
    writeSkill(tmpDir, "beta", "name: beta\ndescription: d", "b");
    writeSkill(tmpDir, "alpha", "name: alpha\ndescription: d", "b");

    const roots = getSkillCatalogRoots(tmpDir);
    expect(listSkills(roots).map((skill) => skill.id)).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("discovers skills under .cursor/skills", () => {
    writeSkill(
      tmpDir,
      "minutes-maid",
      "name: minutes\ndescription: from cursor",
      "cursor body",
      ".cursor",
    );
    expect(listSkills(tmpDir).map((s) => s.id)).toEqual(["minutes-maid"]);
    expect(loadSkill(tmpDir, "minutes-maid")?.body).toContain("cursor body");
    expect(resolveSkillDir(tmpDir, "minutes-maid")).toBe(
      path.join(tmpDir, ".cursor", "skills", "minutes-maid"),
    );
  });

  it("discovers skills under .agents/skills", () => {
    writeSkill(
      tmpDir,
      "minutes-maid",
      "name: minutes\ndescription: from agents",
      "agents body",
      ".agents",
    );
    expect(listSkills(tmpDir).map((s) => s.id)).toEqual(["minutes-maid"]);
    expect(loadSkill(tmpDir, "minutes-maid")?.body).toContain("agents body");
    expect(resolveSkillDir(tmpDir, "minutes-maid")).toBe(
      path.join(tmpDir, ".agents", "skills", "minutes-maid"),
    );
  });

  it("ignores the singular .agent convention", () => {
    const dir = path.join(tmpDir, ".agent", "skills", "legacy-skill");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "SKILL.md"),
      "---\nname: legacy\ndescription: d\n---\n\nlegacy body",
      "utf-8",
    );
    expect(listSkills(tmpDir)).toEqual([]);
    expect(loadSkill(tmpDir, "legacy-skill")).toBeNull();
    expect(resolveSkillDir(tmpDir, "legacy-skill")).toBeNull();
  });

  it("prefers .claude over .cursor for same id in one root", () => {
    writeSkill(
      tmpDir,
      "demo",
      "name: claude\ndescription: c",
      "claude body",
      ".claude",
    );
    writeSkill(
      tmpDir,
      "demo",
      "name: cursor\ndescription: u",
      "cursor body",
      ".cursor",
    );
    expect(loadSkill(tmpDir, "demo")?.name).toBe("claude");
    expect(resolveSkillDir(tmpDir, "demo")).toBe(
      path.join(tmpDir, ".claude", "skills", "demo"),
    );
  });
});
