import fs from "node:fs";
import path from "node:path";
import { parseWorkScope, workScopeBaseDir } from "@/lib/work-scope";
import {
  CONTENT_META_FILENAME,
  LESSON_CONTENTS_FILENAME,
  LESSON_SESSION_FILENAME,
} from "@/lib/lesson-paths";

export type ToolPathZone = "project" | "skill" | "contents";

export type ResolvedToolPath = {
  /** 実ファイルシステム上の絶対パス */
  absolutePath: string;
  /** 表示用パス（`contents/...`・`contents-work/...`・`skill/<id>/...`） */
  relativePath: string;
  /**
   * 書込許可ゾーン内かどうか（dx は 2 ルート: `contents/` 配下または `contents-work/` 配下）。
   * EBEX ではプロジェクトフォルダ単一ルートの意味だったフラグを、書込可否の意味のまま
   * 両ゾーンに立てる（下流の書込判定・確認ゲートを変えないため）。
   */
  insideProject: boolean;
  /** 実行中スキルのディレクトリ配下かどうか */
  insideSkill: boolean;
  zone: ToolPathZone;
};

export type ToolPathError = { error: string };

/** ホスト非依存の論理プレフィックス（表示・入力の正本） */
export const SKILL_LOGICAL_PREFIX = "skill/";
/** 旧形式入力の互換（実行中スキル id のみ受理） */
export const SKILL_LEGACY_PREFIX = ".claude/skills/";
/** dx の書込ルート 1: 正本ツリー（レッスン草稿の着地） */
export const CONTENTS_DIR_NAME = "contents";
export const CONTENTS_PREFIX = `${CONTENTS_DIR_NAME}/`;
/** dx の書込ルート 2: 作業ツリー（計画書・中間生成物） */
export const CONTENTS_PLAN_DIR_NAME = "contents-work";
export const CONTENTS_PLAN_PREFIX = `${CONTENTS_PLAN_DIR_NAME}/`;
/** 作業ツリー内の、agent が書けない領域（agent 自身の会話履歴） */
export const AGENT_SESSION_DIR_NAME = "sessions";
export const AGENT_SESSION_PREFIX = `${CONTENTS_PLAN_PREFIX}${AGENT_SESSION_DIR_NAME}/`;

/** レッスン本文が置かれる階層の深さ（`contents/<シリーズ>/<コース>/<レッスン>/`） */
export const LESSON_FOLDER_DEPTH = 3;

/**
 * 正本ツリー（`contents/`）への書込を検査する。
 *
 * **ファイルは階層を問わず自由に置いてよい。** 予約された名前だけを拒否する。
 *
 * - `session.json` — アプリが管理する。agent が書くと会話・id が壊れる
 * - `.meta.json` — レッスン階層（`contents/<シリーズ>/<コース>/<レッスン>/`）**のみ**
 *   検査つきで許可する（検査は書込ツール側の `lesson-meta-write-guard` が行う）。
 *   全体・シリーズ・コースの `.meta.json` は安定 id と表示順（order）を持つため拒否する
 * - `contents.md` — レッスン本文の予約名。レッスン階層以外に置くと偽のレッスン本文になる
 *
 * ディレクトリの新設はここでは拒否しない。シリーズ・コース・レッスンと誤解される
 * 階層のフォルダが生まれるときは、確認ゲート（`confirm-gate.ts`）が実行前に承認を取る。
 *
 * 判定は**書込先パスだけ**で行う。唯一の例外がレッスン `.meta.json` の内容検査で、
 * これは書込ツールが書込直前に行う（スキーマ適合・`id` の既存値保護）。
 *
 * 呼ぶのは書込系ツールのみ。読取は制限しない。
 */
export function checkContentsWritePath(
  resolved: ResolvedToolPath,
): ToolPathError | null {
  if (resolved.zone !== "contents") return null;

  // relativePath は `contents/...`。先頭の `contents` を落とす。
  const segments = resolved.relativePath.split("/").slice(1).filter(Boolean);
  const fileName = segments[segments.length - 1];
  if (!fileName) return null;

  if (fileName === LESSON_SESSION_FILENAME) {
    return {
      error: [
        `${fileName} はアプリが管理するファイルです。agent からは変更できません。`,
        `書こうとしたパス: ${resolved.relativePath}`,
      ].join("\n"),
    };
  }

  // `.meta.json` はレッスン階層のみ検査つきで許可。親階層は id・表示順が壊れるため拒否
  if (
    fileName === CONTENT_META_FILENAME &&
    segments.length - 1 !== LESSON_FOLDER_DEPTH
  ) {
    return {
      error: [
        `${CONTENT_META_FILENAME} はアプリが管理するファイルです。この階層では agent から変更できません。`,
        `書けるのはレッスン階層（${CONTENTS_PREFIX}<シリーズ>/<コース>/<レッスン>/）の ${CONTENT_META_FILENAME} だけです。`,
        "並び順（order）はペイン1・2 のドラッグで変更してください。",
        `書こうとしたパス: ${resolved.relativePath}`,
      ].join("\n"),
    };
  }

  // レッスン本文の予約名。レッスン階層以外に置くと偽の本文になる
  if (
    fileName === LESSON_CONTENTS_FILENAME &&
    segments.length - 1 !== LESSON_FOLDER_DEPTH
  ) {
    return {
      error: [
        `${LESSON_CONTENTS_FILENAME} はレッスン本文の予約名です。`,
        `置けるのは ${CONTENTS_PREFIX}<シリーズ>/<コース>/<レッスン>/ の直下だけです。`,
        `作業ファイルは別の名前にするか ${CONTENTS_PLAN_PREFIX} 配下へ書いてください。`,
        `書こうとしたパス: ${resolved.relativePath}`,
      ].join("\n"),
    };
  }

  return null;
}

/** 書込先がレッスン階層の `.meta.json` かどうか（検査つき書込の対象判定） */
export function isLessonMetaWritePath(resolved: ResolvedToolPath): boolean {
  if (resolved.zone !== "contents") return false;
  const segments = resolved.relativePath.split("/").slice(1).filter(Boolean);
  return (
    segments[segments.length - 1] === CONTENT_META_FILENAME &&
    segments.length - 1 === LESSON_FOLDER_DEPTH
  );
}

/**
 * 作業ツリー（`contents-work/`）への書込を検査する。
 *
 * 拒否するのは `contents-work/sessions/` 配下だけ。ここは agent 自身の会話履歴の
 * 保存先で、agent が書くと実行中の会話が壊れる。`plans/` `runs/` は自由に書いてよい。
 *
 * 判定は**ディレクトリ単位**で行う——ファイル名で判定すると、保存形式が変わったときに
 * 保護が漏れる。
 */
export function checkContentsPlanWritePath(
  resolved: ResolvedToolPath,
): ToolPathError | null {
  if (!resolved.relativePath.startsWith(CONTENTS_PLAN_PREFIX)) return null;

  if (`${resolved.relativePath}/`.startsWith(AGENT_SESSION_PREFIX)) {
    return {
      error: [
        `${AGENT_SESSION_PREFIX} は agent の会話履歴の保存先です。agent からは変更できません。`,
        `作業ファイルは ${CONTENTS_PLAN_PREFIX}plans/ か ${CONTENTS_PLAN_PREFIX}runs/ 配下へ書いてください。`,
        `書こうとしたパス: ${resolved.relativePath}`,
      ].join("\n"),
    };
  }

  return null;
}

export type ResolveToolPathOptions = {
  skillId?: string;
  skillDirAbsolute?: string;
  /**
   * true のとき、相対パスがスキルディレクトリに存在すればスキル側を優先する。
   * 読取・発見ツール向け。書込では false（プロジェクト側へ解決）。
   */
  preferSkillIfExists?: boolean;
  /**
   * 書込ツールから呼ぶときに true。正本ツリーへの書込を
   * レッスン本文（`<レッスン名>/contents.md`）だけに限定する。
   */
  forWrite?: boolean;
};

function isUnsafePath(raw: string): boolean {
  return (
    raw.includes("..") ||
    /^[a-zA-Z]:\//.test(raw) ||
    raw.startsWith("/") ||
    raw.startsWith("~")
  );
}

function resolveInsideSkillDir(
  skillId: string,
  skillDirAbsolute: string,
  relativeWithinSkill: string,
): ResolvedToolPath | ToolPathError {
  const rel = relativeWithinSkill.replace(/\\/g, "/").replace(/^\/+/, "");
  if (rel.includes("..")) {
    return { error: `不正なパスです: ${relativeWithinSkill}` };
  }

  const absolutePath = rel
    ? path.resolve(skillDirAbsolute, rel)
    : path.resolve(skillDirAbsolute);

  if (
    absolutePath !== skillDirAbsolute &&
    !absolutePath.startsWith(skillDirAbsolute + path.sep)
  ) {
    return { error: `不正なパスです: ${relativeWithinSkill}` };
  }

  const displayRel = rel
    ? `${SKILL_LOGICAL_PREFIX}${skillId}/${rel}`
    : `${SKILL_LOGICAL_PREFIX}${skillId}`;
  return {
    absolutePath,
    relativePath: displayRel,
    insideProject: false,
    insideSkill: true,
    zone: "skill",
  };
}

/**
 * 明示スキルパス（論理 `skill/<id>/...` または旧 `.claude/skills/<id>/...`）を解釈する。
 * 実行中スキル以外は拒否。該当しなければ null。
 */
function tryResolveExplicitSkillPath(
  raw: string,
  skillId: string,
  skillDir: string,
): ResolvedToolPath | ToolPathError | null {
  for (const prefix of [SKILL_LOGICAL_PREFIX, SKILL_LEGACY_PREFIX] as const) {
    const skillRootPrefix = `${prefix}${skillId}`;
    if (raw === skillRootPrefix || raw.startsWith(`${skillRootPrefix}/`)) {
      const within = raw.slice(skillRootPrefix.length).replace(/^\//, "");
      return resolveInsideSkillDir(skillId, skillDir, within);
    }
    // 他スキルへの明示パスは拒否（確認ダイアログにも回さない）
    if (raw.startsWith(prefix)) {
      return {
        error: `実行中スキル（${skillId}）以外のスキルファイルは参照できません: ${raw}`,
      };
    }
  }
  return null;
}

function tryResolveSkillPath(
  inputPath: string,
  options: ResolveToolPathOptions,
): ResolvedToolPath | ToolPathError | null {
  const skillId = options.skillId?.trim();
  const skillDir = options.skillDirAbsolute?.trim();
  if (!skillId || !skillDir) return null;

  const raw = inputPath.replace(/\\/g, "/").trim();

  const explicit = tryResolveExplicitSkillPath(raw, skillId, skillDir);
  if (explicit) return explicit;

  if (!options.preferSkillIfExists) return null;
  if (raw.startsWith(CONTENTS_PREFIX) || raw.startsWith(CONTENTS_PLAN_PREFIX)) {
    return null;
  }
  // 作業フォルダ直下の一覧・検索を奪わない
  if (raw === "." || raw === "") return null;

  const candidate = path.resolve(skillDir, raw);
  if (candidate !== skillDir && !candidate.startsWith(skillDir + path.sep)) {
    return null;
  }
  if (!fs.existsSync(candidate)) return null;

  return resolveInsideSkillDir(skillId, skillDir, raw);
}

function resolveUnderRoot(
  projectRoot: string,
  rootDirName: string,
  raw: string,
  zone: ToolPathZone,
  inputPath: string,
): ResolvedToolPath | ToolPathError {
  const rootDir = path.resolve(projectRoot, rootDirName);
  const absolutePath = path.resolve(projectRoot, raw);
  if (
    absolutePath !== rootDir &&
    !absolutePath.startsWith(rootDir + path.sep)
  ) {
    return { error: `不正なパスです: ${inputPath}` };
  }
  if (raw.endsWith("/")) {
    return { error: `不正なパスです: ${inputPath}` };
  }
  return {
    absolutePath,
    relativePath: raw,
    insideProject: true,
    insideSkill: false,
    zone,
  };
}

/**
 * ツール呼び出しが渡すパス文字列を実パスへ解決する。
 *
 * 対応する入力形式:
 * - 明示プレフィックスなしの相対（例: `contents.md`) → 作業フォルダ配下
 *   （フォーカス中のコンテンツフォルダ。レッスン → コース → シリーズ → `contents/`）
 * - `contents/...` → 正本ツリー配下として解釈
 * - `contents-work/...` → 作業ツリー配下として解釈（計画書・中間生成物）
 * - `skill/<実行中skillId>/...` → skillDirAbsolute（読取許可ゾーン）
 * - `.claude/skills/<実行中skillId>/...` → 互換マップ（同上）
 * - 相対パスがスキル側に実在する場合（preferSkillIfExists）→ スキル側を優先
 *
 * @param workScopeKey `serializeWorkScope` の出力。空文字は `contents/` 直下を表す。
 */
export function resolveToolTargetPath(
  projectRoot: string,
  workScopeKey: string,
  inputPath: string,
  options: ResolveToolPathOptions = {},
): ResolvedToolPath | ToolPathError {
  const raw = inputPath.replace(/\\/g, "/").trim();
  if (!raw) return { error: "path が空です" };
  if (isUnsafePath(raw)) {
    if (raw.includes("..")) return { error: `不正なパスです: ${inputPath}` };
    return {
      error: `contents/ 配下・contents-work/ 配下・実行中スキル配下のみ操作できます: ${inputPath}`,
    };
  }

  const skillResolved = tryResolveSkillPath(raw, options);
  if (skillResolved) return skillResolved;

  // 書込ルート 2: 作業ツリー（計画書・中間生成物）。明示プレフィックスでのみ届く。
  if (raw === CONTENTS_PLAN_DIR_NAME || raw.startsWith(CONTENTS_PLAN_PREFIX)) {
    const r = resolveUnderRoot(
      projectRoot,
      CONTENTS_PLAN_DIR_NAME,
      raw,
      "project",
      inputPath,
    );
    if ("error" in r) return r;
    const rule = options.forWrite ? checkContentsPlanWritePath(r) : null;
    return rule ?? r;
  }

  // 書込ルート 1: 正本ツリー。レッスン草稿の直接着地に使う。
  if (raw === CONTENTS_DIR_NAME || raw.startsWith(CONTENTS_PREFIX)) {
    const r = resolveUnderRoot(
      projectRoot,
      CONTENTS_DIR_NAME,
      raw,
      "contents",
      inputPath,
    );
    if ("error" in r) return r;
    const rule = options.forWrite ? checkContentsWritePath(r) : null;
    return rule ?? r;
  }

  // 明示プレフィックスなし → 作業フォルダ（フォーカス中のコンテンツフォルダ）相対
  const scope = parseWorkScope(workScopeKey);
  if (!scope) return { error: `不正なパスです: ${inputPath}` };
  const baseRelative = workScopeBaseDir(scope);
  const combined = `${baseRelative}/${raw}`;

  const resolved = resolveUnderRoot(
    projectRoot,
    CONTENTS_DIR_NAME,
    combined,
    "contents",
    inputPath,
  );
  if ("error" in resolved) return resolved;

  // モデルが素の相対パスを書いた場合でも、
  // 作業フォルダ側に無くスキル側にあればスキルを優先（読取時のみ）
  const rule = options.forWrite ? checkContentsWritePath(resolved) : null;
  if (rule) return rule;

  if (
    options.preferSkillIfExists &&
    options.skillId &&
    options.skillDirAbsolute &&
    !fs.existsSync(resolved.absolutePath)
  ) {
    const skillFallback = tryResolveSkillPath(raw, {
      ...options,
      preferSkillIfExists: true,
    });
    if (
      skillFallback &&
      !("error" in skillFallback) &&
      skillFallback.insideSkill
    ) {
      return skillFallback;
    }
  }

  return resolved;
}
