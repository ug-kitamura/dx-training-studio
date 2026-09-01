import fs from "node:fs";
import path from "node:path";
import { SUBAGENT_FALLBACK_MODEL_HINT } from "@/lib/agent/subagent-fallback";
import { IMAGE_IO_FALLBACK_MODEL_HINT } from "@/lib/agent/image-io-fallback";
import { skillHasScriptsDir } from "@/lib/agent/tools/registry";
import { parseWorkScope, workScopeBaseDir } from "@/lib/work-scope";

export type SkillRuntimeFocus = {
  workScopeKey: string;
  /** 作業フォルダ根からの相対パス（例: sub/notes.md） */
  currentFileRelativePath?: string | null;
  /** 実行中スキル ID（読取許可ゾーンの案内に使う） */
  skillId?: string;
  /** 実行中スキルの絶対ディレクトリ */
  skillDirAbsolute?: string | null;
  /** frontmatter `assets:`（スキル相対パス）。未宣言は空／省略 */
  skillAssets?: string[] | null;
  /** スキル本文に「サブエージェント」が含まれるとき true */
  mentionsSubagent?: boolean;
  /** スキル本文に画像・マルチモーダルの生成/読取指示が含まれ、ユーザーがスキップを選んだとき true */
  imageIoSkipped?: boolean;
};

/** 額縁候補（スキル相対パス＋サイズ） */
export type SkillAssetCandidate = {
  relativePath: string;
  sizeBytes: number;
};

const FRAME_SCAN_DIRS = ["references", "templates"] as const;
const FRAME_EXTENSIONS = new Set([".html", ".htm", ".css", ".svg"]);
export const FRAME_CANDIDATE_LIMIT = 5;

/**
 * スキル相対パスを skillDir 配下の実ファイルへ解決する。
 * ディレクトリ外・非ファイル・不正は null。
 */
export function resolveSkillRelativeFile(
  skillDirAbsolute: string,
  relativePath: string,
): { absolutePath: string; relativePath: string; sizeBytes: number } | null {
  const normalized = relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
  if (!normalized || normalized.includes("\0")) return null;
  if (normalized.split("/").some((seg) => seg === "..")) return null;

  const absolutePath = path.resolve(skillDirAbsolute, ...normalized.split("/"));
  const root = path.resolve(skillDirAbsolute);
  if (absolutePath !== root && !absolutePath.startsWith(root + path.sep)) {
    return null;
  }
  if (!fs.existsSync(absolutePath)) return null;
  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) return null;
  return { absolutePath, relativePath: normalized, sizeBytes: stat.size };
}

/**
 * `assets:` 未宣言時の軽量スキャン。
 * `references/` / `templates/` 直下のみ（深い再帰・内容読取なし）。
 * 特定スキル名・特定ファイル名による分岐は持たない。
 */
export function scanSkillFrameCandidates(
  skillDirAbsolute: string,
  limit: number = FRAME_CANDIDATE_LIMIT,
): SkillAssetCandidate[] {
  const root = skillDirAbsolute.trim();
  if (!root || !fs.existsSync(root)) return [];

  const found: SkillAssetCandidate[] = [];
  for (const dirName of FRAME_SCAN_DIRS) {
    const dir = path.join(root, dirName);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => FRAME_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
    for (const name of files) {
      const absolutePath = path.join(dir, name);
      const sizeBytes = fs.statSync(absolutePath).size;
      found.push({
        relativePath: `${dirName}/${name}`,
        sizeBytes,
      });
      if (found.length >= limit) return found;
    }
  }
  return found;
}

/**
 * 額縁候補を決定する。`assets:` があれば実在ファイルのみ（スキャンで置き換えない）。
 * 未宣言・空ならスキャン推定。
 */
export function resolveSkillAssetCandidates(
  skillDirAbsolute: string | null | undefined,
  declaredAssets: string[] | null | undefined,
): SkillAssetCandidate[] {
  const root = skillDirAbsolute?.trim();
  if (!root) return [];

  const declared = (declaredAssets ?? []).map((p) => p.trim()).filter(Boolean);

  if (declared.length > 0) {
    const out: SkillAssetCandidate[] = [];
    for (const rel of declared) {
      const resolved = resolveSkillRelativeFile(root, rel);
      if (!resolved) continue;
      out.push({
        relativePath: resolved.relativePath,
        sizeBytes: resolved.sizeBytes,
      });
    }
    return out;
  }

  return scanSkillFrameCandidates(root);
}

function formatAssetSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes}B`;
  const kb = sizeBytes / 1024;
  if (kb < 1024) {
    const rounded = kb >= 10 ? Math.round(kb) : Math.round(kb * 10) / 10;
    return `${rounded}KB`;
  }
  const mb = kb / 1024;
  const rounded = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
  return `${rounded}MB`;
}

function formatAssetCandidateLines(
  candidates: SkillAssetCandidate[],
): string[] {
  if (candidates.length === 0) return [];
  return [
    "額縁候補（スキル内の実在ファイル・事実列挙）:",
    ...candidates.map(
      (c) => `- \`${c.relativePath}\` (${formatAssetSize(c.sizeBytes)})`,
    ),
    "額縁がある場合はまず `copy_file` で作業フォルダへコピーしてから、`replace_in_file` / `replace_between` で差し込むこと。",
  ];
}

/**
 * スキル本文を触らず、場の約束だけを添える短い説明を組み立てる。
 */
export function buildSkillRuntimeContext(focus: SkillRuntimeFocus): string {
  // 作業フォルダ = フォーカス中のコンテンツフォルダ。空文字はシリーズ 0 件（contents/ 直下）
  const workDir = workScopeBaseDir(parseWorkScope(focus.workScopeKey) ?? {});
  const current = focus.currentFileRelativePath?.trim();
  const skillId = focus.skillId?.trim();
  const sameFolder = current?.includes("/")
    ? current.slice(0, current.lastIndexOf("/"))
    : current
      ? "."
      : ".";

  const candidates = skillId
    ? resolveSkillAssetCandidates(focus.skillDirAbsolute, focus.skillAssets)
    : [];

  const lines = [
    "## ワークスペースランタイム（場の約束）",
    "",
    "スキル本文の指示を尊重すること。以下はツール側が添える薄い場の説明である。",
    "",
    "### Scope",
    `既定の舞台は作業フォルダ \`${workDir}/\` である。明示プレフィックスのない相対パスはここを基準に解決される。`,
    "計画書・中間生成物は作業ツリー（`contents-work/` 配下）へ、明示プレフィックス付きで書くこと。",
    ...(skillId
      ? [
          `実行中スキルの参照ファイル（\`SKILL.md\` と同じフォルダ配下、例: \`references/*\`）は確認なしで発見（list/glob/search）および読取できる。`,
          `スキル本文の相対パス（例: \`references/purpose.md\`）はスキル側を優先して読むこと。成果物の書込先は \`${workDir}/\` 配下である。`,
          `大きな成果物は本文を tool 引数に載せず、成果物の形で経路を選ぶこと。(1) 額縁テンプレートがスキルにあるなら \`copy_file\` で作業フォルダへコピーし、\`replace_in_file\` / \`replace_between\`（大きな本文は \`from_path\`）で 1 回数 KB の断片を差し込む（必要なら \`append_file\` で partial を積む）。可変長の差し込みは明示の開始・終了トークンを使い、手順メモには媒体のコメント構文を、埋める印にはコメント構文以外を使うこと。(2) モデルが新たに創作する長文なら \`generate_and_write\`（材料をファイルへ書き出して \`context_paths\` で渡し、\`sections\` で分割）。額縁へ差し込むなら \`path\` に額縁、\`marker\` に区間名を渡すと生成と差し込みが 1 回で済む。(3) 大量レコードの機械変換なら \`run_script\`${skillHasScriptsDir(focus.skillDirAbsolute ?? undefined) ? "（スキルの `scripts/` にスクリプトがあれば `run_skill_script`）" : ""}。`,
          ...formatAssetCandidateLines(candidates),
          "額縁や模範回答など大きな参照ファイルは、差し込み位置の把握に必要な範囲を超えて読み込まないこと。子生成へ渡す材料は `context_paths` を使う。",
          `中間ファイル（partial 等）は作業フォルダ直下の \`_work/\` に置き、成果物本体と混在させないこと。成果物の置き場がどこであっても \`_work/\` の位置は変えない。差し込み区間を持つ額縁ファイルを丸ごと上書きしようとした書込は、額縁を壊さないよう \`_work/\` へ退避される（生成物は失われないが、額縁へは \`replace_between\` か \`marker\` で差し込むこと）。`,
        ]
      : []),
    "",
    "### Focus",
    current
      ? `入力が明示されていないときの第一の焦点は、いま開いているファイル \`${current}\` である。`
      : "入力が明示されていないとき、開いているファイルは無い。作業フォルダ内の文脈から必要なら尋ねること。",
    `出力が明示されていないときの第一の焦点は、開いているファイルと同じフォルダ（\`${sameFolder === "." ? "作業フォルダ直下" : sameFolder}\`）、次点は作業フォルダ直下である。`,
    "",
    "### Boundary",
    "書込許可ルート（`contents/` と `contents-work/`）の外のパスに触れるときは、推測で進めずユーザ確認を前提とすること。",
    "場の中で出力候補が複数あるときは勝手に確定せず、候補を示して選ばせること。",
    ...(focus.mentionsSubagent
      ? ["", "### Subagent", SUBAGENT_FALLBACK_MODEL_HINT]
      : []),
    ...(focus.imageIoSkipped
      ? ["", "### Image / Multimodal", IMAGE_IO_FALLBACK_MODEL_HINT]
      : []),
  ];

  return lines.join("\n");
}

export function mergeSkillSystemPrompt(
  skillPrompt: string,
  runtimeContext: string | null | undefined,
): string {
  const runtime = runtimeContext?.trim();
  if (!runtime) return skillPrompt;
  return `${runtime}\n\n---\n\n${skillPrompt}`;
}
