/**
 * 正本（`../contents`）を読み取る専用ローダー。
 *
 * 走査規則の正本は Studio 側の `lib/contents-loader.ts` / `lib/lesson-frontmatter.ts`。
 * site は独立プロジェクトなので直接 import せず、ここで同じ規則を実装する。
 * ずれの検出は `__tests__/content-source.parity.test.ts`（実 contents を両者で読んで突き合わせ）が担う。
 */
import fs from "node:fs";
import path from "node:path";

export type LessonStatus = "open" | "in_progress" | "done";

export type LessonMeta = {
  /** ディレクトリ名（表示名） */
  name: string;
  slug?: string;
  /** レッスン `.meta.json` の安定 ID（`lsn-...`） */
  id?: string;
  status: LessonStatus;
  description: string;
  tags: string[];
  estimatedMinutes: number;
  author: string;
  /** 著者の英語表記（表記が2つあるときだけ）。表示は双方向フォールバック */
  authorEn?: string;
  /** `contents.md` の本文（frontmatter は廃止済み・全文が本文） */
  body: string;
  /** 英語版本文（`contents.en.md`）。無ければ undefined */
  bodyEn?: string;
  /** 英語版タイトル（`.meta.json` の `name_en`） */
  titleEn?: string;
  /** 英語版の概要（`.meta.json` の `description_en`） */
  descriptionEn?: string;
  dir: string;
};

/** コースの受講形態。Studio の `lib/schema.ts` と同じ語彙 */
export const COURSE_STYLES = ["self-study", "lecture", "hands-on"] as const;
export type CourseStyle = (typeof COURSE_STYLES)[number];

/** 語彙内なら採用し、未設定・語彙外はどちらも undefined（Studio ローダーと同じ解釈） */
function courseStyle(value: unknown): CourseStyle | undefined {
  return typeof value === "string" &&
    (COURSE_STYLES as readonly string[]).includes(value)
    ? (value as CourseStyle)
    : undefined;
}

export type CourseMeta = {
  name: string;
  id?: string;
  slug?: string;
  description?: string;
  catch?: string;
  target?: string;
  /** 受講対象者の英語版（`.meta.json` の `target_en`）。コース専用 */
  targetEn?: string;
  style?: CourseStyle;
  nameEn?: string;
  descriptionEn?: string;
  catchEn?: string;
  crossSeriesPrev: string[];
  crossSeriesNext: string[];
  /** カリキュラムの入口・到達点の宣言。未宣言ではキーを持たない */
  isStart?: boolean;
  isGoal?: boolean;
  lessons: LessonMeta[];
  dir: string;
};

export type SeriesMeta = {
  name: string;
  id?: string;
  slug?: string;
  description?: string;
  catch?: string;
  cover?: string;
  nameEn?: string;
  descriptionEn?: string;
  catchEn?: string;
  courses: CourseMeta[];
  dir: string;
};

export type ContentsRoot = {
  /** サイト名（未設定は site.config.json の siteName にフォールバック） */
  name?: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  /** トップのヒーロー画像。正本 `images/<file>` のファイル名 */
  hero?: string;
  /** リポジトリへのリンク URL */
  githubUrl?: string;
  series: SeriesMeta[];
};

const LESSON_CONTENTS_FILENAME = "contents.md";
const LESSON_CONTENTS_EN_FILENAME = "contents.en.md";
const META_FILENAME = ".meta.json";

/** `_` / `.` 始まりは構造として解釈しない（Studio の `isContentFolderName` と同じ） */
function isContentFolderName(name: string): boolean {
  return !name.startsWith("_") && !name.startsWith(".");
}

function readMetaJson(dir: string): Record<string, unknown> {
  const metaPath = path.join(dir, META_FILENAME);
  if (!fs.existsSync(metaPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function listContentDirNames(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isContentFolderName(e.name))
    .map((e) => e.name);
}

/** `.meta.json` の order を実体と突き合わせる（order 優先、無い実体は名前順で末尾） */
function effectiveOrder(order: string[], actual: string[]): string[] {
  const actualSet = new Set(actual);
  const ordered = order.filter(
    (name) => isContentFolderName(name) && actualSet.has(name),
  );
  const seen = new Set(ordered);
  const rest = actual.filter((name) => !seen.has(name)).sort();
  return [...ordered, ...rest];
}

/** レッスンフォルダ（`contents.md` を持つディレクトリ）だけを返す */
function listLessonFolderNames(courseDir: string): string[] {
  if (!fs.existsSync(courseDir)) return [];
  return fs
    .readdirSync(courseDir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() &&
        isContentFolderName(e.name) &&
        fs.existsSync(path.join(courseDir, e.name, LESSON_CONTENTS_FILENAME)),
    )
    .map((e) => e.name);
}

function migrateStatus(value: unknown): LessonStatus {
  if (value === "draft") return "open";
  if (value === "open" || value === "in_progress" || value === "done")
    return value;
  return "open";
}

function readLesson(courseDir: string, lessonName: string): LessonMeta {
  const lessonDir = path.join(courseDir, lessonName);
  // `contents.md` は本文のみ（frontmatter は廃止済み）。メタは `.meta.json` から読む
  const body = fs.readFileSync(
    path.join(lessonDir, LESSON_CONTENTS_FILENAME),
    "utf-8",
  );
  const meta = readMetaJson(lessonDir);

  const minutes =
    typeof meta.estimated_minutes === "number"
      ? meta.estimated_minutes
      : Number.parseInt(String(meta.estimated_minutes ?? ""), 10);

  let bodyEn: string | undefined;
  const enPath = path.join(lessonDir, LESSON_CONTENTS_EN_FILENAME);
  if (fs.existsSync(enPath)) {
    bodyEn = fs.readFileSync(enPath, "utf-8");
  }

  return {
    name: lessonName,
    slug: str(meta.slug),
    id: str(meta.id),
    status: migrateStatus(meta.status),
    description: typeof meta.description === "string" ? meta.description : "",
    tags: strArray(meta.tags),
    estimatedMinutes: Number.isNaN(minutes) ? 0 : minutes,
    author: typeof meta.author === "string" ? meta.author : "",
    authorEn: str(meta.author_en),
    body,
    bodyEn,
    titleEn: str(meta.name_en),
    descriptionEn: str(meta.description_en),
    dir: lessonDir,
  };
}

function readCourse(seriesDir: string, courseName: string): CourseMeta {
  const courseDir = path.join(seriesDir, courseName);
  const meta = readMetaJson(courseDir);
  const lessonNames = effectiveOrder(
    strArray(meta.order),
    listLessonFolderNames(courseDir),
  );

  return {
    name: courseName,
    id: str(meta.id),
    slug: str(meta.slug),
    description: str(meta.description),
    catch: str(meta.catch),
    target: str(meta.target) ?? str(meta.target_audience),
    targetEn: str(meta.target_en),
    style: courseStyle(meta.style),
    nameEn: str(meta.name_en),
    descriptionEn: str(meta.description_en),
    catchEn: str(meta.catch_en),
    crossSeriesPrev: strArray(meta.cross_series_prev),
    crossSeriesNext: strArray(meta.cross_series_next),
    ...(meta.is_start === true ? { isStart: true } : {}),
    ...(meta.is_goal === true ? { isGoal: true } : {}),
    lessons: lessonNames.map((name) => readLesson(courseDir, name)),
    dir: courseDir,
  };
}

function readSeries(contentsDir: string, seriesName: string): SeriesMeta {
  const seriesDir = path.join(contentsDir, seriesName);
  const meta = readMetaJson(seriesDir);
  const courseNames = effectiveOrder(
    strArray(meta.order),
    listContentDirNames(seriesDir),
  );

  return {
    name: seriesName,
    id: str(meta.id),
    slug: str(meta.slug),
    description: str(meta.description),
    catch: str(meta.catch),
    cover: str(meta.cover),
    nameEn: str(meta.name_en),
    descriptionEn: str(meta.description_en),
    catchEn: str(meta.catch_en),
    courses: courseNames.map((name) => readCourse(seriesDir, name)),
    dir: seriesDir,
  };
}

/** `contents/` を走査して全階層を読む（読み取り専用。正本は変更しない） */
export function loadContents(contentsDir: string): ContentsRoot {
  if (!fs.existsSync(contentsDir)) {
    return { series: [] };
  }
  const rootMeta = readMetaJson(contentsDir);
  const seriesNames = effectiveOrder(
    strArray(rootMeta.order),
    listContentDirNames(contentsDir),
  );

  return {
    name: str(rootMeta.name),
    nameEn: str(rootMeta.name_en),
    description: str(rootMeta.description),
    descriptionEn: str(rootMeta.description_en),
    hero: str(rootMeta.hero),
    githubUrl: str(rootMeta.github_url),
    series: seriesNames.map((name) => readSeries(contentsDir, name)),
  };
}

export type ChangelogSource = {
  /** `contents/changelog.md` の全文（日本語） */
  body: string;
  /** `contents/changelog.en.md` の全文。無ければ undefined（日本語へフォールバック） */
  bodyEn?: string;
};

const CHANGELOG_FILENAME = "changelog.md";
const CHANGELOG_EN_FILENAME = "changelog.en.md";

/**
 * 変更履歴の正本（`contents/changelog.md`）を読む。無ければ null——
 * 履歴はオプションであり、欠落でビルドを止めない。
 *
 * ⚠ 内容はパースしない。「新しいものを上に書く」は人の作法で、機械は関与しない
 * （書式が崩れていてもそのまま配信される。これは仕様）。
 * ディレクトリ走査（`loadContents`）はファイルを見ないため、このファイルが
 * シリーズとして解釈されることはない——読み取りはこの関数だけが担う。
 */
export function loadChangelog(contentsDir: string): ChangelogSource | null {
  const jaPath = path.join(contentsDir, CHANGELOG_FILENAME);
  if (!fs.existsSync(jaPath)) return null;
  const body = fs.readFileSync(jaPath, "utf-8");
  const enPath = path.join(contentsDir, CHANGELOG_EN_FILENAME);
  const bodyEn = fs.existsSync(enPath)
    ? fs.readFileSync(enPath, "utf-8")
    : undefined;
  return { body, ...(bodyEn !== undefined ? { bodyEn } : {}) };
}
