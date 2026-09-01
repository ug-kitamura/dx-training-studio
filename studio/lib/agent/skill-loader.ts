import fs from "node:fs";
import path from "node:path";
import { skillMentionsSubagent } from "@/lib/agent/subagent-fallback";
import { skillMentionsImageIO } from "@/lib/agent/image-io-fallback";
import { getProjectRoot } from "@/lib/project-root";

export type SkillSummary = {
  id: string;
  name: string;
  description: string;
  hidden?: boolean;
  /** SKILL.md 本文に「サブエージェント」が含まれる */
  mentionsSubagent?: boolean;
  /** SKILL.md 本文に画像・マルチモーダルの生成/読取指示が含まれる */
  mentionsImageIO?: boolean;
};

export type LoadedSkill = SkillSummary & {
  body: string;
  variables: string[];
  tools: string[];
  /** プロジェクトへコピーして使う材料（スキル相対パス）。未宣言・不正は空配列 */
  assets: string[];
};

/**
 * ホスト規約ごとの skills ディレクトリ（同一ルート内の優先順）。
 * Discovery のみがこの列挙を知る。Execution は skillDirAbsolute を正本とする。
 */
export const SKILL_HOST_CONVENTIONS = [
  ".claude",
  ".cursor",
  ".agents",
  ".github",
] as const;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Windows エディタ由来の UTF-8 BOM を除去する（frontmatter 先頭 `---` 照合のため）。 */
function stripBom(raw: string): string {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

function skillsDirForConvention(
  projectRoot: string,
  convention: (typeof SKILL_HOST_CONVENTIONS)[number],
): string {
  return path.join(projectRoot, convention, "skills");
}

/**
 * スキルカタログの探索ルート。
 * dx-training-studio は単体起動のみのため、EBEX の複ルートカタログ
 * （appRoot + projectRoot の和集合）は持たず、リポ直下の単一ルートで解決する。
 * 下位の list / load 系は複ルート引数のまま維持し、EBEX との diff を保つ。
 */
export function getSkillCatalogRoots(
  hostRoot: string = getProjectRoot(),
): string[] {
  return [path.resolve(hostRoot)];
}

/** @deprecated Discovery は複ホスト規約。互換のため `.claude/skills` を返す。 */
export function getSkillsDir(projectRoot: string): string {
  return skillsDirForConvention(projectRoot, ".claude");
}

function normalizeRoots(
  projectRootOrRoots: string | readonly string[],
): string[] {
  const list = Array.isArray(projectRootOrRoots)
    ? projectRootOrRoots
    : [projectRootOrRoots];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const root of list) {
    const resolved = path.resolve(root);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    unique.push(resolved);
  }
  return unique;
}

/** 同一ルート内: 規約優先順で先に見つかった id のみ（決定的）。 */
function listSkillIdsInRoot(projectRoot: string): string[] {
  const byId = new Map<string, true>();
  for (const convention of SKILL_HOST_CONVENTIONS) {
    const skillsDir = skillsDirForConvention(projectRoot, convention);
    if (!fs.existsSync(skillsDir)) continue;
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (byId.has(entry.name)) continue;
      if (!fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")))
        continue;
      byId.set(entry.name, true);
    }
  }
  return [...byId.keys()].sort((a, b) => a.localeCompare(b));
}

function resolveSkillDirInRoot(
  projectRoot: string,
  skillId: string,
): string | null {
  for (const convention of SKILL_HOST_CONVENTIONS) {
    const dir = path.join(
      skillsDirForConvention(projectRoot, convention),
      skillId,
    );
    if (fs.existsSync(path.join(dir, "SKILL.md"))) return dir;
  }
  return null;
}

function loadSkillFromRoot(
  projectRoot: string,
  skillId: string,
): LoadedSkill | null {
  const skillDir = resolveSkillDirInRoot(projectRoot, skillId);
  if (!skillDir) return null;

  const raw = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf-8");
  const parsed = parseSkillDocument(raw);
  return {
    id: skillId,
    name: parsed.name || skillId,
    description: parsed.description,
    hidden: parsed.hidden,
    variables: parsed.variables,
    tools: parsed.tools,
    assets: parsed.assets,
    body: parsed.body,
  };
}

export function listSkills(
  projectRootOrRoots: string | readonly string[],
): SkillSummary[] {
  const roots = normalizeRoots(projectRootOrRoots);
  // roots は ebex → host の順。同 id は後勝ち（ホスト優先）で rootIndex も更新される。
  const byId = new Map<string, { summary: SkillSummary; rootIndex: number }>();

  for (const [rootIndex, root] of roots.entries()) {
    for (const id of listSkillIdsInRoot(root)) {
      const skill = loadSkillFromRoot(root, id);
      if (!skill) continue;
      byId.set(skill.id, {
        rootIndex,
        summary: {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          hidden: skill.hidden,
          mentionsSubagent: skillMentionsSubagent(skill.body),
          mentionsImageIO: skillMentionsImageIO(skill.body),
        },
      });
    }
  }

  // 表示は host → ebex の区画順（roots の逆順）。区画内は id 昇順。
  return [...byId.values()]
    .sort(
      (a, b) =>
        b.rootIndex - a.rootIndex || a.summary.id.localeCompare(b.summary.id),
    )
    .map((entry) => entry.summary);
}

export function listVisibleSkills(
  projectRootOrRoots: string | readonly string[],
): SkillSummary[] {
  return listSkills(projectRootOrRoots).filter((skill) => !skill.hidden);
}

export function loadSkill(
  projectRootOrRoots: string | readonly string[],
  skillId: string,
): LoadedSkill | null {
  const roots = normalizeRoots(projectRootOrRoots);
  // ホスト優先: 後ろのルートから探す
  for (let i = roots.length - 1; i >= 0; i--) {
    const skill = loadSkillFromRoot(roots[i]!, skillId);
    if (skill) return skill;
  }
  return null;
}

/** 実行中スキルのディレクトリ絶対パス（SKILL.md があるフォルダ）。見つからなければ null。 */
export function resolveSkillDir(
  projectRootOrRoots: string | readonly string[],
  skillId: string,
): string | null {
  const roots = normalizeRoots(projectRootOrRoots);
  // ホスト優先: 後ろのルートから探す。同一ルート内は規約固定順。
  for (let i = roots.length - 1; i >= 0; i--) {
    const dir = resolveSkillDirInRoot(roots[i]!, skillId);
    if (dir) return dir;
  }
  return null;
}

export function injectSkillVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return variables[key] ?? "";
    }
    return match;
  });
}

export function buildSkillSystemPrompt(
  skill: LoadedSkill,
  variables: Record<string, string>,
): { prompt: string; missingVariables: string[] } {
  const missingVariables = skill.variables.filter(
    (name) => !Object.prototype.hasOwnProperty.call(variables, name),
  );
  return {
    prompt: injectSkillVariables(skill.body, variables),
    missingVariables,
  };
}

export function parseSkillDocument(raw: string): {
  name: string;
  description: string;
  hidden: boolean;
  variables: string[];
  tools: string[];
  assets: string[];
  body: string;
} {
  const text = stripBom(raw);
  const match = text.match(FRONTMATTER_RE);
  if (!match) {
    return {
      name: "",
      description: "",
      hidden: false,
      variables: [],
      tools: [],
      assets: [],
      body: text.trim(),
    };
  }

  const frontmatter = parseSkillFrontmatter(match[1]);
  return {
    name: frontmatter.name,
    description: frontmatter.description,
    hidden: frontmatter.hidden,
    variables: frontmatter.variables,
    tools: frontmatter.tools,
    assets: frontmatter.assets,
    body: match[2].trim(),
  };
}

/** YAML インライン配列 `[a, b]` をパース。非文字列・空要素は捨てる。不正なら null。 */
function parseInlineStringList(inline: string): string[] | null {
  const trimmed = inline.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  const values: string[] = [];
  for (const item of inner.split(",")) {
    const value = stripQuotes(item.trim());
    if (!value) continue;
    // オブジェクト等の不正要素は無視して空扱い（配列自体は採用しない）
    if (value.startsWith("{") || value.includes(":")) return null;
    values.push(value);
  }
  return values;
}

function parseSkillFrontmatter(yaml: string): {
  name: string;
  description: string;
  hidden: boolean;
  variables: string[];
  tools: string[];
  assets: string[];
} {
  let name = "";
  let description = "";
  let hidden = false;
  const variables: string[] = [];
  const tools: string[] = [];
  const assets: string[] = [];
  let inDescription = false;
  let inVariables = false;
  let inTools = false;
  let inAssets = false;
  let assetsValid = true;
  let descriptionIndent = 0;

  // Windows CRLF を LF に正規化し、description 行末の \r 残留を防ぐ
  const lines = yaml.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (inDescription) {
      const indent = line.length - line.trimStart().length;
      if (indent > descriptionIndent && line.trimStart().length > 0) {
        description += (description ? "\n" : "") + line.trimStart();
        continue;
      }
      inDescription = false;
    }

    if (inVariables) {
      if (/^-\s+/.test(trimmed)) {
        variables.push(trimmed.slice(2).trim());
        continue;
      }
      inVariables = false;
    }

    if (inTools) {
      if (/^-\s+/.test(trimmed)) {
        tools.push(trimmed.slice(2).trim());
        continue;
      }
      inTools = false;
    }

    if (inAssets) {
      if (/^-\s+/.test(trimmed)) {
        const item = stripQuotes(trimmed.slice(2).trim());
        if (!item || item.startsWith("{") || item.includes(": ")) {
          assetsValid = false;
        } else if (assetsValid) {
          assets.push(item);
        }
        continue;
      }
      inAssets = false;
    }

    if (trimmed.startsWith("variables:")) {
      const inline = trimmed.slice("variables:".length).trim();
      if (inline.startsWith("[") && inline.endsWith("]")) {
        const inner = inline.slice(1, -1);
        for (const item of inner.split(",")) {
          const value = item.trim();
          if (value) variables.push(value);
        }
      } else if (!inline) {
        inVariables = true;
      }
      continue;
    }

    if (trimmed.startsWith("tools:")) {
      const inline = trimmed.slice("tools:".length).trim();
      if (inline.startsWith("[") && inline.endsWith("]")) {
        const inner = inline.slice(1, -1);
        for (const item of inner.split(",")) {
          const value = item.trim();
          if (value) tools.push(value);
        }
      } else if (!inline) {
        inTools = true;
      }
      continue;
    }

    if (trimmed.startsWith("assets:")) {
      const inline = trimmed.slice("assets:".length).trim();
      if (inline) {
        const parsed = parseInlineStringList(inline);
        if (parsed) {
          assets.push(...parsed);
        } else {
          // スカラー・不正インラインは無視（空扱い）
          assetsValid = false;
        }
      } else {
        inAssets = true;
      }
      continue;
    }

    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const rawValue = trimmed.slice(colon + 1);
    const value = rawValue.trim();

    switch (key) {
      case "name":
        name = value;
        break;
      case "hidden":
        hidden = value === "true";
        break;
      case "description":
        if (value === "|" || value === ">") {
          inDescription = true;
          descriptionIndent = line.length - line.trimStart().length;
          description = "";
        } else {
          description = stripQuotes(value);
        }
        break;
      default:
        break;
    }
  }

  return {
    name,
    description: description.trim(),
    hidden,
    variables,
    tools,
    assets: assetsValid ? assets : [],
  };
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
