/**
 * 焼き込みジェネレータ（scripts/generate-skill-catalog.mjs）と
 * 正本ロジック（lib/agent/skill-loader.ts の listVisibleSkills）の突き合わせ。
 * ジェネレータは Node 単体実行のための最小レプリカなので、正本とのずれをここで検出する。
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSkillCatalog } from "../../scripts/generate-skill-catalog.mjs";
import { listVisibleSkills } from "@/lib/agent/skill-loader";

describe("generate-skill-catalog と skill-loader の parity", () => {
  it("実プロジェクトの .claude/skills で同じサマリを返す", () => {
    // studio/ の親＝入れ物直下（ランタイムの getProjectRoot() と同じ場所）
    const projectRoot = path.resolve(process.cwd(), "..");
    const baked = buildSkillCatalog(projectRoot);
    const live = listVisibleSkills([projectRoot]).map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      hidden: skill.hidden ?? false,
      mentionsSubagent: skill.mentionsSubagent ?? false,
      mentionsImageIO: skill.mentionsImageIO ?? false,
    }));
    expect(baked).toEqual(live);
    // 実スキルが存在すること（空同士の一致で緑になっていないこと）
    expect(baked.length).toBeGreaterThan(0);
  });
});
