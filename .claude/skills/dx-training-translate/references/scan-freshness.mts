/**
 * 翻訳鮮度の走査（dx-training-translate スキル同梱・読み取り専用）。
 *
 * 判定とハッシュは Studio の正本実装（studio/lib/translation/freshness.ts）を
 * import する——スキル側に第3の実装を作らない（training-translate-skill spec）。
 *
 * 実行:
 *   node --experimental-strip-types .claude/skills/dx-training-translate/references/scan-freshness.mts [シリーズ] [コース] [レッスン]
 *   （dx-training-studio/ ディレクトリを起点にパス解決するので cwd はどこでもよい）
 *
 * ⚠ **走査は常に contents/ 全体**。引数は「今回処理する対象」の印付け（`inScope`）で
 * あって走査の絞り込みではない——絞ると「あと何件残っているか」の分母が範囲ごとに
 * 変わり、進捗が読めなくなる（training-translate-skill spec）。
 *
 * 出力: 集計（全体 / 範囲内）・欠落フィールド・ユニットごとの状態と、翻訳時に
 * 書くべきハッシュ値（JSON）。
 * 状態: untranslated（未翻訳）/ stale（翻訳が古い）/ fresh（最新）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bodyFreshness,
  changelogFreshness,
  computeBodySourceHash,
  computeMetaSourceHash,
  hasAnyEnValue,
  listMissingEnFields,
  metaFreshness,
  type MetaSourceFields,
} from "../../../../studio/lib/translation/freshness.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);
const contentsDir = path.join(projectRoot, "contents");

const [argSeries, argCourse, argLesson] = process.argv.slice(2);

function readMeta(dir: string): Record<string, unknown> {
  const p = path.join(dir, ".meta.json");
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, unknown>;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."),
    )
    .map((e) => e.name)
    .sort();
}

type UnitReport = {
  unit: string;
  level: "root" | "series" | "course" | "lesson";
  /** 今回の処理対象か（引数で指定された範囲の内側か） */
  inScope: boolean;
  meta: string;
  /** 翻訳時に .meta.json の en_source_hash へ書く値 */
  metaHashToWrite: string;
  /** 未記入の `_en` フィールド（原文が非空のものだけ）。空配列なら省略 */
  missingEnFields?: string[];
  body?: string;
  /** 翻訳時に contents.en.md の1行目コメントへ書く値 */
  bodyHashToWrite?: string;
  status?: string;
};

const reports: UnitReport[] = [];

/**
 * ⚠ 階層→`_en` キーの対応と「1つでも埋まっていれば翻訳済み」の判定は
 * **正本 lib の関数を使う**（`hasAnyEnValue` / `listMissingEnFields`）。
 * ここに自前のキー一覧を持たないこと（translation-freshness spec）。
 */
function metaReport(
  unit: string,
  level: UnitReport["level"],
  fields: MetaSourceFields,
  meta: Record<string, unknown>,
  inScope: boolean,
): UnitReport {
  const stored = str(meta.en_source_hash) || null;
  const missing = listMissingEnFields(fields, meta);
  return {
    unit,
    level,
    inScope,
    meta: metaFreshness(fields, hasAnyEnValue(level, meta), stored),
    metaHashToWrite: computeMetaSourceHash(fields),
    ...(missing.length > 0 ? { missingEnFields: missing } : {}),
  };
}

/**
 * 範囲の判定。引数で指定された階層に**含まれる**ものが `inScope`。
 * 上位階層（範囲がコースなら、その親シリーズや全体）は対象外——今回訳すのは
 * 指定された階層とその配下だけ。
 */
const inScopeAt = (
  seriesName?: string,
  courseName?: string,
  lessonName?: string,
): boolean => {
  if (argSeries && seriesName !== argSeries) return false;
  if (argCourse && courseName !== argCourse) return false;
  if (argLesson && lessonName !== argLesson) return false;
  return true;
};

// 全体（範囲指定が無いときだけ処理対象）
const rootMeta = readMeta(contentsDir);
reports.push(
  metaReport(
    "(全体)",
    "root",
    {
      level: "root",
      name: str(rootMeta.name),
      description: str(rootMeta.description),
    },
    rootMeta,
    inScopeAt(),
  ),
);

for (const seriesName of listDirs(contentsDir)) {
  const seriesDir = path.join(contentsDir, seriesName);
  const seriesMeta = readMeta(seriesDir);
  reports.push(
    metaReport(
      seriesName,
      "series",
      {
        level: "series",
        name: seriesName,
        catch: str(seriesMeta.catch),
        description: str(seriesMeta.description),
      },
      seriesMeta,
      !argCourse && inScopeAt(seriesName),
    ),
  );

  for (const courseName of listDirs(seriesDir)) {
    const courseDir = path.join(seriesDir, courseName);
    const courseMeta = readMeta(courseDir);
    reports.push(
      metaReport(
        `${seriesName}/${courseName}`,
        "course",
        {
          level: "course",
          name: courseName,
          catch: str(courseMeta.catch),
          description: str(courseMeta.description),
          target: str(courseMeta.target),
        },
        courseMeta,
        !argLesson && inScopeAt(seriesName, courseName),
      ),
    );

    for (const lessonName of listDirs(courseDir)) {
      const lessonDir = path.join(courseDir, lessonName);
      const jaPath = path.join(lessonDir, "contents.md");
      if (!fs.existsSync(jaPath)) continue;
      const lessonMeta = readMeta(lessonDir);
      const jaBody = fs.readFileSync(jaPath, "utf-8");
      const enPath = path.join(lessonDir, "contents.en.md");
      const enRaw = fs.existsSync(enPath)
        ? fs.readFileSync(enPath, "utf-8")
        : null;
      const report = metaReport(
        `${seriesName}/${courseName}/${lessonName}`,
        "lesson",
        {
          level: "lesson",
          name: lessonName,
          description: str(lessonMeta.description),
        },
        lessonMeta,
        inScopeAt(seriesName, courseName, lessonName),
      );
      report.body = bodyFreshness(jaBody, enRaw);
      report.bodyHashToWrite = computeBodySourceHash(jaBody);
      report.status = str(lessonMeta.status) || "open";
      reports.push(report);
    }
  }
}

// changelog（どの範囲でも対象。日付比較なのでハッシュは無い）
const changelogJaPath = path.join(contentsDir, "changelog.md");
const changelog = fs.existsSync(changelogJaPath)
  ? changelogFreshness(
      fs.readFileSync(changelogJaPath, "utf-8"),
      fs.existsSync(path.join(contentsDir, "changelog.en.md"))
        ? fs.readFileSync(path.join(contentsDir, "changelog.en.md"), "utf-8")
        : null,
    )
  : null;

/**
 * 集計。⚠ **本文とメタを合算しない**——本文1本は数千字の翻訳、メタ1件は数フィールドで
 * 作業量が桁違い。混ぜた数は見積もりに使えない（training-translate-skill spec）。
 */
type Tally = { untranslated: number; stale: number; fresh: number; total: number };

function tally(states: string[]): Tally {
  const count = (s: string) => states.filter((x) => x === s).length;
  return {
    untranslated: count("untranslated"),
    stale: count("stale"),
    fresh: count("fresh"),
    total: states.length,
  };
}

function summarize(units: UnitReport[]) {
  return {
    body: tally(units.flatMap((r) => (r.body ? [r.body] : []))),
    meta: tally(units.map((r) => r.meta)),
  };
}

const scoped = reports.filter((r) => r.inScope);
/**
 * ⚠ 未翻訳（`untranslated`）のユニットは除く——全フィールドが空なのは当たり前で、
 * 件数は集計側に出ている。この一覧の値打ちは「**翻訳済みに見えるのに欠けている**」
 * ものを暴くことにある（`hasEnValues` は1つでも埋まっていれば真なので、部分的な
 * 記入は鮮度からは見えない）。
 */
const missingEnFields = reports
  .filter((r) => r.missingEnFields && r.meta !== "untranslated")
  .map((r) => ({ unit: r.unit, level: r.level, fields: r.missingEnFields }));

console.log(
  JSON.stringify(
    {
      /** 引数で指定された範囲（未指定＝全体） */
      scope: {
        series: argSeries ?? null,
        course: argCourse ?? null,
        lesson: argLesson ?? null,
      },
      /** contents/ 全体の集計。「あと何件残っているか」の分母 */
      total: { ...summarize(reports), changelog },
      /** 今回の処理対象（inScope）の集計 */
      inScope: summarize(scoped),
      /**
       * 「翻訳済み」でも未記入の `_en` フィールド。
       * ⚠ 鮮度が fresh でも出る——鮮度は原文への追随、こちらは記入の完全性で別軸
       */
      missingEnFields,
      changelog,
      /** 未完成レッスンも分母に含まれる（status で絞らない）ことを示す内訳 */
      lessonStatusCounts: reports.reduce<Record<string, number>>((acc, r) => {
        if (r.level === "lesson" && r.status) {
          acc[r.status] = (acc[r.status] ?? 0) + 1;
        }
        return acc;
      }, {}),
      units: reports,
    },
    null,
    2,
  ),
);
