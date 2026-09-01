/**
 * 変更履歴の AI 下書き（サーバー側）。
 *
 * 材料は3点（spec: studio-changelog-editor）:
 * 1. changelog 全文 —— 基準点・重複回避・粒度と文体のお手本
 * 2. 基準日以降に mtime が動いたレッスン本文
 * 3. 現在のシリーズ・コース・レッスンのツリー
 *
 * mtime は信号として弱い（保存しただけで動く・clone で全件動く）が、
 * 下書きは差分採否で人が捨てられるため誤検出のコストがゼロ——精度要件は低い。
 */
import fs from "node:fs";
import path from "node:path";
import { getContentsDir, isContentFolderName } from "@/lib/contents-loader";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";
import { parseJsonObject } from "@/lib/llm-response";

export const CHANGELOG_FILENAME = "changelog.md";
export const CHANGELOG_EN_FILENAME = "changelog.en.md";

export type ChangelogLanguage = "ja" | "en";

/** 材料の上限。超過分は新しい順に切り、truncated で人に伝える */
export const DRAFT_MAX_LESSONS = 20;
export const DRAFT_LESSON_BODY_LIMIT = 6_000;

export function getChangelogPath(
  projectRoot: string,
  language: ChangelogLanguage = "ja",
): string {
  return path.join(
    getContentsDir(projectRoot),
    language === "en" ? CHANGELOG_EN_FILENAME : CHANGELOG_FILENAME,
  );
}

export type ChangelogFile = {
  exists: boolean;
  content: string;
  /** 楽観ロック用。無ければ null */
  mtimeMs: number | null;
};

export function readChangelogFile(
  projectRoot: string,
  language: ChangelogLanguage = "ja",
): ChangelogFile {
  const filePath = getChangelogPath(projectRoot, language);
  if (!fs.existsSync(filePath)) {
    return { exists: false, content: "", mtimeMs: null };
  }
  return {
    exists: true,
    content: fs.readFileSync(filePath, "utf-8"),
    mtimeMs: fs.statSync(filePath).mtimeMs,
  };
}

export type LessonRef = {
  series: string;
  course: string;
  lesson: string;
  filePath: string;
  mtimeMs: number;
};

/**
 * contents/ を走査してレッスン（contents.md を持つフォルダ）を列挙する。
 * 表示順は AI の材料としては重要でないため名前順（order は読まない——
 * loadContentsFolder は id 欠落時に .meta.json へ書き戻す副作用があるので使わない）。
 */
export function listLessons(projectRoot: string): LessonRef[] {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return [];
  const dirNames = (dir: string): string[] =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && isContentFolderName(e.name))
      .map((e) => e.name)
      .sort();

  const lessons: LessonRef[] = [];
  for (const series of dirNames(contentsDir)) {
    const seriesDir = path.join(contentsDir, series);
    for (const course of dirNames(seriesDir)) {
      const courseDir = path.join(seriesDir, course);
      for (const lesson of dirNames(courseDir)) {
        const filePath = path.join(courseDir, lesson, LESSON_CONTENTS_FILENAME);
        if (!fs.existsSync(filePath)) continue;
        lessons.push({
          series,
          course,
          lesson,
          filePath,
          mtimeMs: fs.statSync(filePath).mtimeMs,
        });
      }
    }
  }
  return lessons;
}

/** ツリーの見取り図（AI が「どのシリーズの話か」を言うための材料） */
export function buildTreeText(lessons: LessonRef[]): string {
  return lessons
    .map((l) => `- ${l.series} / ${l.course} / ${l.lesson}`)
    .join("\n");
}

/**
 * 基準日（JST の 0 時）を epoch ミリ秒へ。読めなければ null（全件が候補になる）。
 */
export function baselineMsFromDate(dateStr: string | null): number | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const ms = Date.parse(`${dateStr}T00:00:00+09:00`);
  return Number.isNaN(ms) ? null : ms;
}

export type UpdatedLesson = LessonRef & { body: string };

export function collectUpdatedLessons(
  projectRoot: string,
  baselineMs: number | null,
): { lessons: UpdatedLesson[]; truncated: boolean } {
  const all = listLessons(projectRoot);
  const filtered =
    baselineMs === null ? all : all.filter((l) => l.mtimeMs >= baselineMs);
  const sorted = [...filtered].sort((a, b) => b.mtimeMs - a.mtimeMs);
  const truncated = sorted.length > DRAFT_MAX_LESSONS;
  const lessons = sorted.slice(0, DRAFT_MAX_LESSONS).map((l) => {
    const raw = fs.readFileSync(l.filePath, "utf-8");
    const body =
      raw.length > DRAFT_LESSON_BODY_LIMIT
        ? `${raw.slice(0, DRAFT_LESSON_BODY_LIMIT)}\n…（以降省略）`
        : raw;
    return { ...l, body };
  });
  return { lessons, truncated };
}

export const CHANGELOG_DRAFT_SYSTEM_PROMPT = `あなたは DX トレーニング教材の変更履歴の下書きを書く執筆補助である。
出力は次の JSON オブジェクトのみ。前置き・後書き・コードフェンスを出力してはならない。
{"entry": "追記する新規エントリの Markdown", "notes": ["人向けの指摘（無ければ空配列）"]}

entry のルール:
- 見出し「## <今日の日付>」で始まる 1 節だけを書く
- 箇条書きは最大 5 点。受講者にとって特筆すべき変更だけに絞る
- 教材の話だけを書く: レッスンの追加・改訂、構成の変更、受講者に価値のあるサイトの変更
- システム・執筆ツール・スキル・メタデータの変更は書かない
- 受講者に向けた言葉で書く。実装用語・ファイルパス・フォルダ名をそのまま出さない
- 既存の履歴に書かれていることを繰り返さない。粒度と文体は既存エントリをお手本にする

notes のルール:
- 既存の履歴と教材の現状に食い違いを見つけたときだけ、人向けの短い指摘を書く（例: 追加と記録されたレッスンが見当たらない）
- 食い違いが無ければ空配列にする
- 指摘を entry（履歴本文）に書いてはならない`;

export function buildDraftUserPrompt(args: {
  todayDate: string;
  changelogContent: string;
  treeText: string;
  lessons: UpdatedLesson[];
  truncated: boolean;
}): string {
  const lessonSections = args.lessons.map(
    (l) =>
      `### ${l.series} / ${l.course} / ${l.lesson}\n\n${l.body.trim()}`,
  );
  return [
    `今日の日付: ${args.todayDate}`,
    "",
    "## 現在の教材ツリー",
    "",
    args.treeText || "（レッスンなし）",
    "",
    "## 既存の変更履歴（全文）",
    "",
    args.changelogContent.trim() || "（まだ履歴はありません）",
    "",
    `## 基準日以降に更新されたレッスン本文${args.truncated ? `（多数のため新しい順に ${DRAFT_MAX_LESSONS} 件へ絞ってあります）` : ""}`,
    "",
    ...lessonSections,
  ].join("\n");
}

export type DraftResult = { entry: string; notes: string[] };

/** モデル応答の JSON を許容的にパースする（コードフェンスは剥がす）。失敗は null */
export function parseDraftResponse(text: string): DraftResult | null {
  const parsed = parseJsonObject(text);
  if (!parsed) return null;
  const entry = parsed.entry;
  const notes = parsed.notes;
  if (typeof entry !== "string" || !entry.trim()) return null;
  const notesArr = Array.isArray(notes)
    ? notes.filter((n): n is string => typeof n === "string" && !!n.trim())
    : [];
  return { entry: entry.trim(), notes: notesArr };
}

/** 今日の日付（JST）。見出し「## YYYY-MM-DD」用 */
export function todayDateJst(now = new Date()): string {
  // en-CA は YYYY-MM-DD 形式を返す
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
