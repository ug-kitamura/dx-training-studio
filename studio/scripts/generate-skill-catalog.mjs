/**
 * スキルカタログ（表示用サマリ）をビルド時に焼き込む。
 *
 * Vercel（読み取り専用デモ）のサーバーレス関数には `.claude/skills` が同梱されない
 * ため、`/api/agent/skills` はランタイム走査が空のとき本生成物へフォールバックする。
 * `npm run build` の前段で実行される（package.json の build script）。
 *
 * ⚠ 判定ロジックの正本は `lib/agent/skill-loader.ts` /
 * `lib/agent/subagent-fallback.ts` / `lib/agent/image-io-fallback.ts`。
 * このファイルは Node 単体で動かすための最小レプリカで、正本とのずれは
 * `__tests__/scripts/generate-skill-catalog.parity.test.ts` が検出する。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** ホスト規約ごとの skills ディレクトリ（skill-loader.ts の SKILL_HOST_CONVENTIONS と同値） */
const SKILL_HOST_CONVENTIONS = [".claude", ".cursor", ".agents", ".github"];

const SUBAGENT_KEYWORD = "サブエージェント";
const IMAGE_IO_KEYWORDS = [
  "画像を生成",
  "画像生成",
  "画像を読み取",
  "画像を読取",
  "画像を解析",
  "image generation",
  "generate an image",
  "generate images",
];

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function stripBom(raw) {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** skill-loader.ts の parseSkillFrontmatter の name / description / hidden 部分のレプリカ */
function parseSkillDocument(raw) {
  const text = stripBom(raw);
  const match = text.match(FRONTMATTER_RE);
  if (!match) {
    return { name: "", description: "", hidden: false, body: text.trim() };
  }

  let name = "";
  let description = "";
  let hidden = false;
  let inDescription = false;
  let descriptionIndent = 0;

  const lines = match[1].replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const line of lines) {
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

    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();

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
    body: match[2].trim(),
  };
}

/** 表示可能なスキルサマリ一覧（listVisibleSkills 相当）を作る */
export function buildSkillCatalog(projectRoot) {
  const byId = new Map();
  for (const convention of SKILL_HOST_CONVENTIONS) {
    const skillsDir = path.join(projectRoot, convention, "skills");
    if (!fs.existsSync(skillsDir)) continue;
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (byId.has(entry.name)) continue;
      const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;
      const parsed = parseSkillDocument(fs.readFileSync(skillPath, "utf-8"));
      byId.set(entry.name, {
        id: entry.name,
        name: parsed.name || entry.name,
        description: parsed.description,
        hidden: parsed.hidden,
        mentionsSubagent: parsed.body.includes(SUBAGENT_KEYWORD),
        mentionsImageIO: IMAGE_IO_KEYWORDS.some((keyword) =>
          parsed.body.toLowerCase().includes(keyword.toLowerCase()),
        ),
      });
    }
  }
  return [...byId.values()]
    .filter((skill) => !skill.hidden)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function main() {
  const studioRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  // projectRoot はランタイムの getProjectRoot()（cwd の親）と同じ入れ物直下
  const projectRoot = path.resolve(studioRoot, "..");
  const catalog = buildSkillCatalog(projectRoot);
  const target = path.join(
    studioRoot,
    "lib",
    "agent",
    "skill-catalog.generated.json",
  );
  fs.writeFileSync(target, JSON.stringify(catalog, null, 2) + "\n", "utf-8");
  console.log(
    `skill catalog: ${catalog.length} 件を焼き込みました → lib/agent/skill-catalog.generated.json`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
