/**
 * DX Training Studio のドメインスキーマ。
 * シリーズ → コース → レッスン の 3 層構造を Zod で定義する。
 */

import { z } from "zod";

// ===== レッスンステータス =====

export const lessonStatusSchema = z.enum(["open", "in_progress", "done"]);
export type LessonStatus = z.infer<typeof lessonStatusSchema>;

export const STATUS_LABELS: Record<LessonStatus, string> = {
  open: "未着手",
  in_progress: "作成中",
  done: "完成",
};

// ===== 公開サイト向けメタ（slug / 概要 / キャッチ / 英語版）=====

/** 公開サイトの URL に使う slug。小文字英数とハイフンのみ */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .regex(SLUG_PATTERN, "slug は小文字英数とハイフンのみで構成してください");

/** 表示テキストの英語版。値の書き込みは翻訳開始後（現状は器のみ） */
const localizedTextFields = {
  name_en: z.string().optional(),
  description_en: z.string().optional(),
  catch_en: z.string().optional(),
};

/**
 * メタ翻訳の鮮度ハッシュ（`sha256:<hex>`）。翻訳対象の日本語フィールドから
 * 計算する。計算規則の正本は `lib/translation/freshness.ts`（translation-freshness spec）
 */
const enSourceHashField = {
  en_source_hash: z.string().optional(),
};

/**
 * コースの受講形態。表示ラベルは表示側が locale ごとに持つ
 * （日本語: 独習 / 講義 / ハンズオン、英語: 値そのまま小文字）
 */
export const COURSE_STYLES = ["self-study", "lecture", "hands-on"] as const;
export const courseStyleSchema = z.enum(COURSE_STYLES);
export type CourseStyle = z.infer<typeof courseStyleSchema>;

/** 語彙内なら採用し、未設定・語彙外はどちらも undefined に落とす */
export function parseCourseStyle(value: unknown): CourseStyle | undefined {
  return courseStyleSchema.safeParse(value).data;
}

/** Studio の編集 UI で出す日本語ラベル（公開サイトの表示は site 側が持つ） */
export const COURSE_STYLE_LABELS: Record<CourseStyle, string> = {
  "self-study": "独習",
  lecture: "講義",
  "hands-on": "ハンズオン",
};

/** シリーズ・コースが共通で持つ公開サイト向けフィールド */
const publishingMetaFields = {
  slug: slugSchema.optional(),
  description: z.string().optional(),
  catch: z.string().optional(),
  ...localizedTextFields,
};

// ===== レッスン（葉ノード）=====

export const lessonSchema = z.object({
  /** 実行時のパス由来キー（`lesson-{series}-{course}-{lesson}`）。正本には保存しない */
  id: z.string(),
  /** レッスン `.meta.json` の `id`。フォルダ名を変えても変わらない安定 ID（`lsn-...`） */
  stableId: z.string().optional(),
  slug: slugSchema.optional(),
  series: z.string(),
  course: z.string(),
  lesson: z.string(),
  status: lessonStatusSchema,
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  estimated_minutes: z.number().default(0),
  author: z.string().default(""),
  /** 著者名の英語表記（表記が2つあるときだけ）。表示は双方向フォールバック */
  author_en: z.string().optional(),
  /**
   * レッスン名の英語版（`.meta.json` の `name_en`）。英語モードの表示に使う。
   * ⚠ 正本はフォルダ名（`lesson`）で、これは表示用の別名にすぎない——
   * 並べ替え・選択・パス解決のキーには使わないこと（`lib/display-name.ts`）
   */
  name_en: z.string().optional(),
  /** Markdown 本文（frontmatter を含まない） */
  content: z.string().default(""),
  /**
   * 英語版の Markdown 本文（`contents.en.md`。原文ハッシュ行は含まない）。
   * 英語版が無ければ未設定。
   *
   * ⚠ 表示・編集の正本ではない——英語ビューのエディタは `use-lesson-en-body`
   * が API から個別に取得する。ここに載せているのは、画像の参照走査のように
   * **全レッスンを横断して数える処理**が日英を分け隔てなく見るため。
   * ⚠ 任意フィールドのままにすること（必須にすると全テストフィクスチャが
   * 型エラーになる。`Course.style` と同じ流儀）
   */
  content_en: z.string().optional(),
});
export type Lesson = z.infer<typeof lessonSchema>;

/**
 * `contents/<series>/<course>/<lesson>/.meta.json` の厳密スキーマ。
 * agent の検査つき書込・save-lesson-meta API の検証に使う（未知キーは拒否）。
 * 名前3つ（series / course / lesson）は持たない——フォルダ名が正本。
 */
export const lessonMetaFileSchema = z
  .object({
    id: z.string().optional(),
    slug: slugSchema.optional(),
    status: lessonStatusSchema.optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    estimated_minutes: z.number().int().min(0).max(180).optional(),
    author: z.string().optional(),
    author_en: z.string().optional(),
    name_en: z.string().optional(),
    description_en: z.string().optional(),
    ...enSourceHashField,
  })
  .strict();
export type LessonMetaFile = z.infer<typeof lessonMetaFileSchema>;

// ===== コース → レッスン（曼陀羅メタ情報を含む）=====

export const courseSchema = z.object({
  id: z.string(),
  name: z.string(),
  target: z.string().optional(),
  /** 受講対象者の英語版。コース専用（target がコース専用のため） */
  target_en: z.string().optional(),
  /** 受講形態。語彙外の値は読み込み時に未設定へ落とす */
  style: courseStyleSchema.optional().catch(undefined),
  /** 別シリーズの前コース ID のみ。同シリーズ内の前後は series.courses[] の順序で表す */
  cross_series_prev: z.array(z.string()).default([]),
  /** 別シリーズの次コース ID のみ。同シリーズ内の前後は series.courses[] の順序で表す */
  cross_series_next: z.array(z.string()).default([]),
  /** カリキュラムの入口。前のコースを持つコースでも宣言でき、複数あってよい */
  is_start: z.boolean().optional(),
  /** カリキュラムの到達点。次のコースを持つコースでも宣言でき、複数あってよい */
  is_goal: z.boolean().optional(),
  lessons: z.array(lessonSchema),
  ...publishingMetaFields,
});
export type Course = z.infer<typeof courseSchema>;

// ===== シリーズ → コース =====

export const seriesSchema = z.object({
  id: z.string(),
  name: z.string(),
  courses: z.array(courseSchema),
  ...publishingMetaFields,
  /** ヒーロー画像のファイル名（正本 `images/<file>`）。シリーズのみが持つ */
  cover: z.string().optional(),
});
export type Series = z.infer<typeof seriesSchema>;

// ===== `.meta.json` のスキーマ =====

/** `contents/.meta.json`（全体） */
export const contentsMetaSchema = z.object({
  order: z.array(z.string()).default([]),
  /** サイト名（公開サイトの navbar・メタデータに使う） */
  name: z.string().optional(),
  name_en: z.string().optional(),
  description: z.string().optional(),
  description_en: z.string().optional(),
  ...enSourceHashField,
  /** トップのヒーロー画像。正本 `images/<file>` のファイル名 */
  hero: z.string().optional(),
  /** リポジトリへのリンク URL */
  github_url: z.string().optional(),
});
export type ContentsMeta = z.infer<typeof contentsMetaSchema>;

/** `contents/<series>/.meta.json` */
export const seriesMetaSchema = z.object({
  id: z.string().optional(),
  order: z.array(z.string()).default([]),
  ...publishingMetaFields,
  ...enSourceHashField,
  cover: z.string().optional(),
});
export type SeriesMeta = z.infer<typeof seriesMetaSchema>;

/** `contents/<series>/<course>/.meta.json` */
export const courseMetaSchema = z.object({
  id: z.string().optional(),
  order: z.array(z.string()).default([]),
  target: z.string().optional(),
  target_en: z.string().optional(),
  style: courseStyleSchema.optional().catch(undefined),
  cross_series_prev: z.array(z.string()).default([]),
  cross_series_next: z.array(z.string()).default([]),
  is_start: z.boolean().optional(),
  is_goal: z.boolean().optional(),
  ...publishingMetaFields,
  ...enSourceHashField,
});
export type CourseMeta = z.infer<typeof courseMetaSchema>;

// ===== 画像アセット =====

export const imageSourceSchema = z.enum(["uploaded", "ai", "web"]);
export type ImageSource = z.infer<typeof imageSourceSchema>;

export const imageStorageModeSchema = z.enum(["local", "storage"]);
export type ImageStorageMode = z.infer<typeof imageStorageModeSchema>;

export const contextStorageModeSchema = z.enum(["local", "database"]);
export type ContextStorageMode = z.infer<typeof contextStorageModeSchema>;

export const imageAssetSchema = z.object({
  path: z.string(),
  name: z.string(),
  source: imageSourceSchema,
  uploadedAt: z.string(),
});
export type ImageAsset = z.infer<typeof imageAssetSchema>;

// ===== JSON 全体用スキーマ =====

export const seriesArraySchema = z.array(seriesSchema);
