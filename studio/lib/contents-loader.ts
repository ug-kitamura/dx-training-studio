import fs from "node:fs";
import path from "node:path";
import { sanitizeFilename } from "@/lib/content-filename";
import { readBakedMeta } from "@/lib/contents-meta-baked";
import { getProjectRoot } from "@/lib/project-root";
import {
  generateCourseId,
  generateLessonStableId,
  generateSeriesId,
  readStoredId,
  buildLessonId,
} from "@/lib/content-ids";
import {
  defaultLessonBody,
  metaToLessonFields,
  migrateQuizBlocksInBody,
  parseLessonMetaFile,
} from "@/lib/lesson-meta";
import type { Course, CourseStyle, Lesson, Series } from "@/lib/schema";
import { parseCourseStyle } from "@/lib/schema";
import {
  CONTENT_META_FILENAME,
  LESSON_CONTENTS_EN_FILENAME,
  LESSON_CONTENTS_FILENAME,
  LESSON_SESSION_FILENAME,
} from "@/lib/lesson-paths";
import { parseEnBody } from "@/lib/translation/freshness";

export { LESSON_CONTENTS_FILENAME, LESSON_SESSION_FILENAME };

export const CONTENTS_DIR_NAME = "contents";

export function getContentsDir(projectRoot: string): string {
  return path.join(projectRoot, CONTENTS_DIR_NAME);
}

export function contentsExists(projectRoot: string): boolean {
  return fs.existsSync(getContentsDir(projectRoot));
}

/**
 * `.meta.json` が存在するのにパースできない（構文エラー・BOM 等）ことを表すエラー。
 * 「存在しない」と同一視して静かに再採番すると id / slug が失われるため、
 * ローダーは読み進めず、このエラーを表へ出す（2026-08-14 の BOM 事故の再発防止）。
 */
export class MetaJsonParseError extends Error {
  readonly metaPath: string;

  constructor(metaPath: string, cause: unknown) {
    super(
      `.meta.json を読み取れません（JSON として不正です）: ${metaPath}\n` +
        `原因: ${cause instanceof Error ? cause.message : String(cause)}\n` +
        `修復するまでロードを中断します（このファイルの id / slug を守るため上書きしません）。` +
        `BOM 付きで保存されていないか確認してください。`,
    );
    this.name = "MetaJsonParseError";
    this.metaPath = metaPath;
  }
}

/**
 * `.meta.json` を読み込んで返す。存在しない場合は空オブジェクト（自己修復に委ねる）。
 * 存在するのにパースできない場合は {@link MetaJsonParseError} を投げる。
 *
 * ⚠ デプロイ先（Vercel の読み取り専用デモ）ではファイルが同梱されないため、
 * ビルド時の焼き込みへフォールバックする（`lib/contents-meta-baked.ts`）。
 * ここで空を返すと、閲覧系 API が全滅するだけでなく `loadContentsFolder` が
 * id 未設定と判断して書き込みに走り、読み取り専用 fs で 500 になる。
 */
export function readMetaJson(dir: string): Record<string, unknown> {
  const metaPath = path.join(dir, CONTENT_META_FILENAME);
  if (!fs.existsSync(metaPath)) {
    return readBakedMeta(getContentsDir(getProjectRoot()), dir) ?? {};
  }
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch (cause) {
    throw new MetaJsonParseError(metaPath, cause);
  }
}

/** `.meta.json` に data を書き込む */
export function writeMetaJson(
  dir: string,
  data: Record<string, unknown>,
): void {
  fs.writeFileSync(
    path.join(dir, CONTENT_META_FILENAME),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

/**
 * シリーズ表示名に一致するフォルダの絶対パスを返す。
 * 見つからない場合は null を返す。
 */
export function findSeriesDir(
  contentsDir: string,
  seriesName: string,
): string | null {
  if (!fs.existsSync(contentsDir)) return null;
  const dir = path.join(contentsDir, seriesName);
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : null;
}

/**
 * コース表示名に一致するフォルダの絶対パスを返す。
 * 見つからない場合は null を返す。
 */
export function findCourseDir(
  seriesDir: string,
  courseName: string,
): string | null {
  if (!fs.existsSync(seriesDir)) return null;
  const dir = path.join(seriesDir, courseName);
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : null;
}

/** series/course/lesson の表示名からレッスン contents.md の絶対パスを返す */
export function resolveLessonFilePath(
  projectRoot: string,
  seriesName: string,
  courseName: string,
  lessonName: string,
): string | null {
  const contentsDir = getContentsDir(projectRoot);
  const seriesDir = findSeriesDir(contentsDir, seriesName);
  if (!seriesDir) return null;
  const courseDir = findCourseDir(seriesDir, courseName);
  if (!courseDir) return null;

  const candidates = [lessonName, sanitizeFilename(lessonName)].filter(
    (name, index, arr) => arr.indexOf(name) === index,
  );
  for (const name of candidates) {
    const lessonFile = path.join(courseDir, name, LESSON_CONTENTS_FILENAME);
    if (fs.existsSync(lessonFile)) return lessonFile;
  }
  return null;
}

/** レッスンフォルダの絶対パスを返す */
export function resolveLessonDirPath(
  projectRoot: string,
  seriesName: string,
  courseName: string,
  lessonName: string,
): string | null {
  const contentsDir = getContentsDir(projectRoot);
  const seriesDir = findSeriesDir(contentsDir, seriesName);
  if (!seriesDir) return null;
  const courseDir = findCourseDir(seriesDir, courseName);
  if (!courseDir) return null;
  const lessonDir = path.join(courseDir, sanitizeFilename(lessonName));
  return fs.existsSync(lessonDir) ? lessonDir : null;
}

/** contents/ 以下の全ファイル・フォルダの最新 mtime（ミリ秒）を返す */
export function getContentsLatestMtime(projectRoot: string): number {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return 0;
  let latest = fs.statSync(contentsDir).mtimeMs;
  function scan(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === LESSON_SESSION_FILENAME) continue;
      const p = path.join(dir, e.name);
      try {
        if (e.isDirectory()) {
          scan(p);
        } else {
          const mtime = fs.statSync(p).mtimeMs;
          if (mtime > latest) latest = mtime;
        }
      } catch {
        /* ignore */
      }
    }
  }
  scan(contentsDir);
  return latest;
}

/**
 * contents/ ツリーのスナップショット指紋。
 * リネームは mtime が変わらないことがあるため、パス一覧で変化を検知する。
 */
export function getContentsFingerprint(projectRoot: string): string {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return "";
  const lines: string[] = [];

  function walk(dir: string, rel: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.name === LESSON_SESSION_FILENAME) continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      const childPath = path.join(dir, e.name);
      try {
        if (e.isDirectory()) {
          walk(childPath, childRel);
        } else {
          const stat = fs.statSync(childPath);
          lines.push(`${childRel}\t${stat.size}\t${stat.mtimeMs}`);
        }
      } catch {
        /* ignore */
      }
    }
  }

  walk(contentsDir, "");
  return lines.join("\n");
}

/**
 * `.meta.json` の order 配列と FS の実態を突き合わせて補完する（副作用: JSON 書き換えのみ、FS は変更しない）。
 * - order に存在するが FS にないエントリを除去する
 * - FS にあるが order にないエントリを末尾に追加する
 * ロード前に呼ぶことで「直接追加・削除されたフォルダ/ファイル」を自動的に反映できる。
 */
/**
 * 正本ツリーの構造（シリーズ・コース・レッスン）として解釈してよいディレクトリ名か。
 *
 * `_` / `.` 始まりは予約とみなして除外する。中間ファイル置き場（`_work/`）は
 * フォーカス中のフォルダ直下に作られるため、シリーズ階層や `contents/` 直下に
 * フォーカスした状態では、除外しないと幻のコース・幻のシリーズとして画面に現れる。
 *
 * 判定はディレクトリ名だけで行う（中身・作成者を問わない）。ファイルには適用しない
 * ——`.meta.json` は従来どおり読む。
 */
export function isContentFolderName(name: string): boolean {
  return !name.startsWith("_") && !name.startsWith(".");
}

/** 構造として解釈してよいサブディレクトリ名の一覧 */
function listContentDirNames(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isContentFolderName(e.name))
    .map((e) => e.name);
}

export function reconcileOrderFiles(projectRoot: string): void {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return;

  const actualSeries = new Set(listContentDirNames(contentsDir));
  const contentsMeta = readMetaJson(contentsDir);
  const seriesOrder = Array.isArray(contentsMeta.order)
    ? (contentsMeta.order as string[])
    : [];
  const reconciledSeries = reconcileOrder(seriesOrder, actualSeries);
  const effectiveSeries = reconciledSeries ?? seriesOrder;
  if (reconciledSeries !== null) {
    writeMetaJson(contentsDir, { ...contentsMeta, order: effectiveSeries });
  }

  for (const seriesName of effectiveSeries) {
    const seriesDir = path.join(contentsDir, seriesName);
    if (!fs.existsSync(seriesDir)) continue;

    const actualCourses = new Set(listContentDirNames(seriesDir));
    const seriesMeta = readMetaJson(seriesDir);
    const courseOrder = Array.isArray(seriesMeta.order)
      ? (seriesMeta.order as string[])
      : [];
    const reconciledCourses = reconcileOrder(courseOrder, actualCourses);
    const effectiveCourses = reconciledCourses ?? courseOrder;
    if (reconciledCourses !== null) {
      writeMetaJson(seriesDir, { ...seriesMeta, order: effectiveCourses });
    }

    for (const courseName of effectiveCourses) {
      const courseDir = path.join(seriesDir, courseName);
      if (!fs.existsSync(courseDir)) continue;

      const actualLessons = listLessonFolderNames(courseDir);
      const courseMeta = readMetaJson(courseDir);
      const lessonOrder = Array.isArray(courseMeta.order)
        ? (courseMeta.order as string[])
        : [];
      const reconciledLessons = reconcileOrder(lessonOrder, actualLessons);
      if (reconciledLessons !== null) {
        writeMetaJson(courseDir, { ...courseMeta, order: reconciledLessons });
      }

      // .meta.json が存在しない場合は空ファイルを生成
      const metaPath = path.join(courseDir, ".meta.json");
      if (!fs.existsSync(metaPath)) {
        writeMetaJson(courseDir, {
          order: [...actualLessons].sort(),
          target: "",
          cross_series_prev: [],
          cross_series_next: [],
        });
      }
    }
  }
}

/** `contents/` フォルダを走査して `Series[]` を構築する */
export function loadContentsFolder(projectRoot: string): Series[] {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return [];

  const contentsMeta = readMetaJson(contentsDir);
  const seriesOrder = Array.isArray(contentsMeta.order)
    ? (contentsMeta.order as string[])
    : [];

  const actualSeriesDirs = listContentDirNames(contentsDir);

  const effectiveSeries =
    seriesOrder.length > 0
      ? seriesOrder.filter(
          (name) =>
            isContentFolderName(name) &&
            fs.existsSync(path.join(contentsDir, name)),
        )
      : [...actualSeriesDirs].sort();

  const result: Series[] = [];

  const usedIds = new Set<string>();

  for (const seriesDirName of effectiveSeries) {
    const seriesDir = path.join(contentsDir, seriesDirName);
    const seriesName = seriesDirName;
    const seriesMeta = readMetaJson(seriesDir);
    let seriesId = readStoredId(seriesMeta);
    if (!seriesId) {
      seriesId = generateSeriesId(seriesName, usedIds);
      writeMetaJson(seriesDir, { ...seriesMeta, id: seriesId });
    } else {
      usedIds.add(seriesId);
    }

    const courseOrder = Array.isArray(seriesMeta.order)
      ? (seriesMeta.order as string[])
      : [];

    const actualCourseDirs = listContentDirNames(seriesDir);

    const effectiveCourses =
      courseOrder.length > 0
        ? courseOrder.filter(
            (name) =>
              isContentFolderName(name) &&
              fs.existsSync(path.join(seriesDir, name)),
          )
        : [...actualCourseDirs].sort();

    const courses: Course[] = [];

    for (const courseDirName of effectiveCourses) {
      const courseDir = path.join(seriesDir, courseDirName);
      const courseName = courseDirName;
      const courseMetaRaw = readMetaJson(courseDir);
      let courseId = readStoredId(courseMetaRaw);
      if (!courseId) {
        courseId = generateCourseId(courseName, usedIds);
        writeMetaJson(courseDir, { ...courseMetaRaw, id: courseId });
      } else {
        usedIds.add(courseId);
      }
      const courseMeta = loadCourseMeta(courseDir);

      const actualLessons = listLessonFolderNames(courseDir);

      const effectiveLessons =
        courseMeta.order.length > 0
          ? courseMeta.order.filter((name) => actualLessons.has(name))
          : [...actualLessons].sort();

      const lessons: Lesson[] = [];

      for (const lessonName of effectiveLessons) {
        const lessonDir = path.join(courseDir, lessonName);
        const lessonFilePath = path.join(lessonDir, LESSON_CONTENTS_FILENAME);
        let content = fs.readFileSync(lessonFilePath, "utf-8");

        const lessonMetaRaw = readMetaJson(lessonDir);
        const normalized = parseLessonMetaFile(lessonMetaRaw, lessonName);

        // 安定 ID はシリーズ・コースと同じ流儀で自己修復する
        // （`.meta.json` はアプリ管理ファイルなので、本文のオートセーブと競合しない）
        if (!normalized.id) {
          normalized.id = generateLessonStableId(
            lessonName,
            normalized.slug,
            usedIds,
          );
          writeMetaJson(lessonDir, { ...lessonMetaRaw, id: normalized.id });
        } else {
          usedIds.add(normalized.id);
        }

        // 英語版は存在しないことが普通なので、読めなくてもロードを止めない
        // （日本語本文と違い、既定値の書き戻しもしない——正本は翻訳の実行が作る）
        let enBody: string | null = null;
        try {
          const enPath = path.join(lessonDir, LESSON_CONTENTS_EN_FILENAME);
          if (fs.existsSync(enPath)) {
            enBody = parseEnBody(fs.readFileSync(enPath, "utf-8")).body;
          }
        } catch {
          enBody = null;
        }

        if (!content.trim()) {
          content = defaultLessonBody(lessonName);
          fs.writeFileSync(lessonFilePath, content, "utf-8");
        } else if (/^-{3,}\s*$/.test(content.split(/\r?\n/, 1)[0] ?? "")) {
          // frontmatter は廃止済み。検出しても本文として扱う（自動修復はしない）
          console.warn(
            `[contents-loader] frontmatter らしき区切りを検出しました（本文として扱います）: ${lessonFilePath}`,
          );
        }

        lessons.push({
          id: buildLessonId(seriesName, courseName, lessonName),
          series: seriesName,
          course: courseName,
          ...metaToLessonFields(normalized),
          lesson: lessonName,
          // 英語モードの表示名。⚠ 名前の正本はフォルダ名のままで、これは別名
          ...(typeof lessonMetaRaw.name_en === "string" && lessonMetaRaw.name_en
            ? { name_en: lessonMetaRaw.name_en }
            : {}),
          content: migrateQuizBlocksInBody(content),
          // 英語版本文。⚠ 表示・編集の経路ではない——全レッスンを横断して数える
          // 処理（画像の参照走査）が日英を分け隔てなく見るために載せている。
          // 読めない・存在しないときは未設定のままにし、ロードは止めない
          ...(enBody === null ? {} : { content_en: enBody }),
        });
      }

      courses.push({
        id: courseId,
        name: courseName,
        target: courseMeta.target,
        ...(typeof courseMetaRaw.target_en === "string" &&
        courseMetaRaw.target_en
          ? { target_en: courseMetaRaw.target_en }
          : {}),
        ...(courseMeta.style ? { style: courseMeta.style } : {}),
        cross_series_prev: courseMeta.cross_series_prev,
        cross_series_next: courseMeta.cross_series_next,
        // 未宣言はキーを書かない（style と同じ流儀）
        ...(courseMeta.is_start ? { is_start: true } : {}),
        ...(courseMeta.is_goal ? { is_goal: true } : {}),
        lessons,
        ...readPublishingMeta(courseMetaRaw),
      });
    }

    result.push({
      id: seriesId,
      name: seriesName,
      courses,
      ...readPublishingMeta(seriesMeta),
      ...(typeof seriesMeta.cover === "string"
        ? { cover: seriesMeta.cover }
        : {}),
    });
  }

  return result;
}

/** `.meta.json` の公開サイト向けフィールド（未設定のキーは含めない） */
const PUBLISHING_META_KEYS = [
  "slug",
  "description",
  "catch",
  "name_en",
  "description_en",
  "catch_en",
] as const;

export function readPublishingMeta(
  meta: Record<string, unknown>,
): Partial<Record<(typeof PUBLISHING_META_KEYS)[number], string>> {
  const result: Record<string, string> = {};
  for (const key of PUBLISHING_META_KEYS) {
    const value = meta[key];
    if (typeof value === "string" && value.length > 0) result[key] = value;
  }
  return result;
}

/** `contents/.meta.json`（全体）の公開サイト向けメタ */
export function loadContentsMeta(projectRoot: string): {
  description?: string;
  description_en?: string;
} {
  const meta = readMetaJson(getContentsDir(projectRoot));
  const { description, description_en } = readPublishingMeta(meta);
  return {
    ...(description ? { description } : {}),
    ...(description_en ? { description_en } : {}),
  };
}

function loadCourseMeta(courseDir: string): {
  target: string;
  style?: CourseStyle;
  cross_series_prev: string[];
  cross_series_next: string[];
  is_start: boolean;
  is_goal: boolean;
  order: string[];
} {
  const meta = readMetaJson(courseDir);

  return {
    target: typeof meta.target === "string" ? meta.target : "",
    style: parseCourseStyle(meta.style),
    cross_series_prev: Array.isArray(meta.cross_series_prev)
      ? (meta.cross_series_prev as string[])
      : [],
    cross_series_next: Array.isArray(meta.cross_series_next)
      ? (meta.cross_series_next as string[])
      : [],
    is_start: meta.is_start === true,
    is_goal: meta.is_goal === true,
    order: Array.isArray(meta.order) ? (meta.order as string[]) : [],
  };
}

function listLessonFolderNames(courseDir: string): Set<string> {
  const names = new Set<string>();
  if (!fs.existsSync(courseDir)) return names;
  for (const entry of fs.readdirSync(courseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!isContentFolderName(entry.name)) continue;
    const contentsPath = path.join(
      courseDir,
      entry.name,
      LESSON_CONTENTS_FILENAME,
    );
    if (fs.existsSync(contentsPath)) {
      names.add(entry.name);
    }
  }
  return names;
}

export function findLessonLocationById(
  projectRoot: string,
  lessonId: string,
): {
  seriesName: string;
  courseName: string;
  lessonName: string;
  lessonDir: string;
} | null {
  for (const series of loadContentsFolder(projectRoot)) {
    for (const course of series.courses) {
      for (const lesson of course.lessons) {
        if (lesson.id !== lessonId) continue;
        const lessonDir = path.join(
          getContentsDir(projectRoot),
          series.name,
          course.name,
          lesson.lesson,
        );
        return {
          seriesName: series.name,
          courseName: course.name,
          lessonName: lesson.lesson,
          lessonDir,
        };
      }
    }
  }
  return null;
}

/**
 * order 配列と actual Set を突き合わせる。
 * 変更がなければ null、変更があれば新しい配列を返す。
 */
function reconcileOrder(
  ordered: string[],
  actual: Set<string>,
): string[] | null {
  const filtered = ordered.filter((name) => actual.has(name));
  const inOrder = new Set(filtered);
  const added = [...actual].filter((name) => !inOrder.has(name)).sort();
  if (added.length === 0 && filtered.length === ordered.length) return null;
  return [...filtered, ...added];
}
