/**
 * 翻訳 API 群（translate / translation-status）が共有する
 * ユニット解決とメタ読み取り。
 *
 * 階層ごとの翻訳対象フィールドの正本は freshness.ts の `EN_FIELDS`。
 * ここと prompts.ts（プロンプト）はそこから引く／同じ固定順に揃えること
 * （root=[name,description] / series=[名,catch,desc] /
 * course=[名,catch,desc,target] / lesson=[名,desc]）。
 */
import fs from "node:fs";
import path from "node:path";
import {
  findCourseDir,
  findSeriesDir,
  getContentsDir,
  readMetaJson,
  resolveLessonDirPath,
} from "@/lib/contents-loader";
import {
  translatedEnKeys,
  type MetaSourceFields,
} from "@/lib/translation/freshness";

export type UnitLevel = "root" | "series" | "course" | "lesson";

export type ResolvedUnit = {
  level: UnitLevel;
  /** `.meta.json` のあるディレクトリ */
  dir: string;
  /** 名前の正本（root はメタの name・他はフォルダ名） */
  name: string;
  meta: Record<string, unknown>;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 階層と名前からユニットを解決する。見つからなければ null */
export function resolveUnit(
  projectRoot: string,
  level: UnitLevel,
  names: { series?: string; course?: string; lesson?: string },
): ResolvedUnit | null {
  const contentsDir = getContentsDir(projectRoot);
  if (level === "root") {
    const meta = readMetaJson(contentsDir);
    return { level, dir: contentsDir, name: str(meta.name), meta };
  }
  if (!names.series) return null;
  const seriesDir = findSeriesDir(contentsDir, names.series);
  if (!seriesDir) return null;
  if (level === "series") {
    return {
      level,
      dir: seriesDir,
      name: names.series,
      meta: readMetaJson(seriesDir),
    };
  }
  if (!names.course) return null;
  const courseDir = findCourseDir(seriesDir, names.course);
  if (!courseDir) return null;
  if (level === "course") {
    return {
      level,
      dir: courseDir,
      name: names.course,
      meta: readMetaJson(courseDir),
    };
  }
  if (!names.lesson) return null;
  const lessonDir = resolveLessonDirPath(
    projectRoot,
    names.series,
    names.course,
    names.lesson,
  );
  if (!lessonDir) return null;
  return {
    level,
    dir: lessonDir,
    name: names.lesson,
    meta: readMetaJson(lessonDir),
  };
}

/** 鮮度ハッシュの入力（translation-freshness spec の固定順） */
export function unitMetaSourceFields(unit: ResolvedUnit): MetaSourceFields {
  const meta = unit.meta;
  switch (unit.level) {
    case "root":
      return {
        level: "root",
        name: str(meta.name),
        description: str(meta.description),
      };
    case "series":
      return {
        level: "series",
        name: unit.name,
        catch: str(meta.catch),
        description: str(meta.description),
      };
    case "course":
      return {
        level: "course",
        name: unit.name,
        catch: str(meta.catch),
        description: str(meta.description),
        target: str(meta.target),
      };
    case "lesson":
      // author は翻訳対象ではないがハッシュ以外（欠落判定）で要る
      return {
        level: "lesson",
        name: unit.name,
        description: str(meta.description),
        author: str(meta.author),
      };
  }
}

/**
 * 階層ごとの翻訳対象 `_en` フィールド名（author_en は翻訳の対象外なので含まれない）。
 * ⚠ 対応表の正本は `freshness.ts` の `EN_FIELDS`。ここで書き写さないこと。
 */
export const UNIT_EN_KEYS: Record<UnitLevel, readonly string[]> = {
  root: translatedEnKeys("root"),
  series: translatedEnKeys("series"),
  course: translatedEnKeys("course"),
  lesson: translatedEnKeys("lesson"),
};

/** 既存の英訳値（空文字列は未設定扱いで含めない） */
export function readExistingEnValues(unit: ResolvedUnit): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of UNIT_EN_KEYS[unit.level]) {
    const value = unit.meta[key];
    if (typeof value === "string" && value.length > 0) result[key] = value;
  }
  return result;
}

/** `_en` のいずれかが埋まっているか（メタ鮮度の「未翻訳」判定に使う） */
export function unitHasEnValues(unit: ResolvedUnit): boolean {
  return Object.keys(readExistingEnValues(unit)).length > 0;
}

/** `.meta.json` の `en_source_hash`（無ければ null） */
export function unitStoredEnSourceHash(unit: ResolvedUnit): string | null {
  const value = unit.meta.en_source_hash;
  return typeof value === "string" && value ? value : null;
}

/** レッスンの本文ファイル（ja / en）。en は無ければ null */
export function readLessonBodies(lessonDir: string): {
  jaBody: string;
  enRaw: string | null;
} {
  const jaPath = path.join(lessonDir, "contents.md");
  const enPath = path.join(lessonDir, "contents.en.md");
  return {
    jaBody: fs.existsSync(jaPath) ? fs.readFileSync(jaPath, "utf-8") : "",
    enRaw: fs.existsSync(enPath) ? fs.readFileSync(enPath, "utf-8") : null,
  };
}

/**
 * 保存 API 共通: `_en` 系フィールドの「省略＝保全 / 空文字＝削除 / 値＝設定」適用。
 * `en_source_hash` にも同じ規約を使う
 */
export function applyOptionalMetaFields(
  next: Record<string, unknown>,
  fields: Record<string, string | undefined>,
): void {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const trimmed = value.trim();
    if (trimmed) next[key] = trimmed;
    else delete next[key];
  }
}

/** `en_source_hash` の値検証（保存 API の zod スキーマ用） */
export const EN_SOURCE_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** changelog の日英（ja が無ければ null / en が無ければ enContent: null） */
export function readChangelogPair(projectRoot: string): {
  jaContent: string;
  enContent: string | null;
} | null {
  const contentsDir = getContentsDir(projectRoot);
  const jaPath = path.join(contentsDir, "changelog.md");
  if (!fs.existsSync(jaPath)) return null;
  const enPath = path.join(contentsDir, "changelog.en.md");
  return {
    jaContent: fs.readFileSync(jaPath, "utf-8"),
    enContent: fs.existsSync(enPath) ? fs.readFileSync(enPath, "utf-8") : null,
  };
}
