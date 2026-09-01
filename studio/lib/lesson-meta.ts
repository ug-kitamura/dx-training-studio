import { TAG_PATTERN } from "@/lib/lesson-tags";
import type { Lesson, LessonStatus } from "@/lib/schema";

/**
 * レッスンメタの正本はレッスンフォルダの `.meta.json`。
 * `contents.md` は本文のみで、メタの書き戻し・正規化は本文の保存経路から独立している。
 * 名前3つ（series / course / lesson）のうち保存されるものは無い——フォルダ名が正本。
 * `lesson` はここでは「表示名の現在値」としてだけ持つ（`.meta.json` には書かない）。
 */
export type LessonMetaFields = {
  lesson: string;
  status: LessonStatus;
  description: string;
  tags: string[];
  estimated_minutes: number;
  author: string;
  /** 表記が2つあるときの英語側。英語名しか無い著者は author に書けばよい */
  author_en?: string;
  /** 公開サイトの URL に使う slug。未設定なら `.meta.json` に書かない */
  slug?: string;
  /** 安定 ID（`lsn-...`）。無ければローダーが採番する */
  id?: string;
};

const VALID_STATUSES: LessonStatus[] = ["open", "in_progress", "done"];

export function migrateLegacyStatus(status: string): LessonStatus {
  if (status === "draft") return "open";
  if (VALID_STATUSES.includes(status as LessonStatus)) {
    return status as LessonStatus;
  }
  return "open";
}

export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  return tags.filter((t) => TAG_PATTERN.test(t));
}

export function normalizeLessonMeta(
  partial: Partial<LessonMetaFields>,
  fallbacks?: Partial<LessonMetaFields>,
): LessonMetaFields {
  const status = migrateLegacyStatus(
    partial.status ?? fallbacks?.status ?? "open",
  );
  let minutes = partial.estimated_minutes ?? fallbacks?.estimated_minutes ?? 0;
  if (Number.isNaN(minutes)) minutes = 0;
  minutes = Math.min(180, Math.max(0, Math.round(minutes)));

  const slug = partial.slug ?? fallbacks?.slug;
  const id = partial.id ?? fallbacks?.id;
  const authorEn = partial.author_en ?? fallbacks?.author_en;

  return {
    lesson:
      (partial.lesson ?? fallbacks?.lesson ?? "").trim() || "無題のレッスン",
    status,
    description: partial.description ?? fallbacks?.description ?? "",
    tags: normalizeTags(partial.tags ?? fallbacks?.tags),
    estimated_minutes: minutes,
    author: partial.author ?? fallbacks?.author ?? "",
    ...(authorEn ? { author_en: authorEn } : {}),
    ...(slug ? { slug } : {}),
    ...(id ? { id } : {}),
  };
}

/** Lesson の現在値を LessonMetaFields へ写す */
export function lessonToMetaFields(lesson: Lesson): LessonMetaFields {
  return {
    lesson: lesson.lesson,
    status: lesson.status,
    description: lesson.description,
    tags: lesson.tags,
    estimated_minutes: lesson.estimated_minutes,
    author: lesson.author,
    ...(lesson.author_en ? { author_en: lesson.author_en } : {}),
    ...(lesson.slug ? { slug: lesson.slug } : {}),
    ...(lesson.stableId ? { id: lesson.stableId } : {}),
  };
}

export function metaToLessonFields(
  meta: LessonMetaFields,
): Pick<
  Lesson,
  | "lesson"
  | "status"
  | "description"
  | "tags"
  | "estimated_minutes"
  | "author"
  | "author_en"
  | "slug"
  | "stableId"
> {
  return {
    lesson: meta.lesson,
    status: meta.status,
    description: meta.description,
    tags: meta.tags,
    estimated_minutes: meta.estimated_minutes,
    author: meta.author,
    author_en: meta.author_en,
    slug: meta.slug,
    stableId: meta.id,
  };
}

/**
 * `.meta.json` に書く JSON オブジェクトへ変換する。
 * 未設定の任意フィールドはキーを書かない（is_start / style と同じ流儀）。
 * `lesson`（表示名）はフォルダ名が正本なので書かない。
 */
export function lessonMetaToFile(
  meta: LessonMetaFields,
): Record<string, unknown> {
  return {
    ...(meta.id ? { id: meta.id } : {}),
    ...(meta.slug ? { slug: meta.slug } : {}),
    status: meta.status,
    description: meta.description,
    tags: meta.tags,
    estimated_minutes: meta.estimated_minutes,
    author: meta.author,
    ...(meta.author_en ? { author_en: meta.author_en } : {}),
  };
}

/**
 * `.meta.json` の生 JSON からメタを読む（寛容パース。壊れ JSON の検出は
 * `readMetaJson` 側の責務）。旧 `draft` は `open` へ読み替える。
 */
export function parseLessonMetaFile(
  raw: Record<string, unknown>,
  lessonName: string,
): LessonMetaFields {
  const minutes =
    typeof raw.estimated_minutes === "number"
      ? raw.estimated_minutes
      : Number.parseInt(String(raw.estimated_minutes ?? ""), 10);
  return normalizeLessonMeta(
    {
      lesson: lessonName,
      status:
        typeof raw.status === "string"
          ? migrateLegacyStatus(raw.status)
          : undefined,
      description:
        typeof raw.description === "string" ? raw.description : undefined,
      tags: Array.isArray(raw.tags)
        ? raw.tags.filter((t): t is string => typeof t === "string")
        : undefined,
      estimated_minutes: Number.isNaN(minutes) ? undefined : minutes,
      author: typeof raw.author === "string" ? raw.author : undefined,
      author_en:
        typeof raw.author_en === "string" && raw.author_en
          ? raw.author_en
          : undefined,
      slug: typeof raw.slug === "string" && raw.slug ? raw.slug : undefined,
      id: typeof raw.id === "string" && raw.id ? raw.id : undefined,
    },
    { lesson: lessonName },
  );
}

/** メタのみの patch を Lesson へ適用する（content には触れない） */
export function applyLessonMetaPatch(
  lesson: Lesson,
  metaPatch: Partial<LessonMetaFields>,
): Lesson {
  const normalized = normalizeLessonMeta(metaPatch, lessonToMetaFields(lesson));
  return {
    ...lesson,
    ...metaToLessonFields(normalized),
  };
}

/** :::quiz ブロックを ### 確認問題 + タスクリストへ変換（レガシー本文の読み替え） */
export function migrateQuizBlocksInBody(body: string): string {
  return body.replace(/:::quiz\r?\n([\s\S]*?):::/g, (_, inner: string) => {
    const lines = inner.trim().split(/\r?\n/);
    const qLine = lines.find((l) => /^Q:\s*/.test(l.trim()));
    const question = qLine ? qLine.replace(/^Q:\s*/, "").trim() : "";
    const choices = lines.filter((l) => /^\s*-\s+\[[ x]\]/.test(l));
    const parts = ["### 確認問題", ""];
    if (question) parts.push(question, "");
    if (choices.length) parts.push(...choices, "");
    return `${parts.join("\n")}\n`;
  });
}

export function defaultLessonBody(lessonName: string): string {
  return `# ${lessonName}\n\n（ここに本文を書いてください）\n`;
}

/** Agent 草稿の tags / estimated_minutes 補完 */

export function inferDraftTagsFromText(
  text: string,
  availableTags: string[],
): string[] {
  const lower = text.toLowerCase();
  return normalizeTags(
    availableTags.filter((tag) => lower.includes(tag.toLowerCase())),
  ).slice(0, 5);
}

export function resolveDraftTags(options: {
  parsedTags?: string[];
  fallbackTags: string[];
  availableTags: string[];
  contextItemTags: string[];
  bodyText: string;
}): string[] {
  const parsed = normalizeTags(options.parsedTags);
  if (parsed.length > 0) return parsed;

  const inferred = inferDraftTagsFromText(
    options.bodyText,
    options.availableTags,
  );
  if (inferred.length > 0) return inferred;

  const fromContext = normalizeTags([...new Set(options.contextItemTags)]);
  if (fromContext.length > 0) return fromContext.slice(0, 5);

  const fallbacks = normalizeTags(options.fallbackTags);
  if (fallbacks.length > 0) return fallbacks;

  return [];
}

/** 既存コンテンツ最短レッスン（問い合わせ先 5分）に合わせた下限 */
export const DRAFT_ESTIMATED_MINUTES_MIN = 5;
export const DRAFT_ESTIMATED_MINUTES_MAX = 180;

/**
 * 草稿本文から estimated_minutes を推定する。
 * 400文字≈1分の読了 + 見出し・箇条書き・コードブロックの実習加算を 5分刻みに丸める。
 */
export function estimateDraftMinutes(body: string): number {
  const trimmed = body.trim();
  if (!trimmed) return DRAFT_ESTIMATED_MINUTES_MIN;

  const headings = (trimmed.match(/^#{1,3}\s/gm) ?? []).length;
  const listItems = (trimmed.match(/^[\-*]\s+/gm) ?? []).length;
  const codeBlocks = Math.floor((trimmed.match(/```/g) ?? []).length / 2);

  const readingMinutes = trimmed.length / 400;
  const activityMinutes = headings * 0.5 + listItems * 0.5 + codeBlocks * 3;
  const raw = readingMinutes + activityMinutes;

  const rounded = Math.round(raw / 5) * 5;
  return Math.min(
    DRAFT_ESTIMATED_MINUTES_MAX,
    Math.max(
      DRAFT_ESTIMATED_MINUTES_MIN,
      rounded || DRAFT_ESTIMATED_MINUTES_MIN,
    ),
  );
}

export type NormalizeDraftOptions = {
  availableTags?: string[];
  contextItemTags?: string[];
};

export type DraftForLesson = {
  /** エディタへ上書きする本文（frontmatter なし） */
  body: string;
  /** 草稿受領時に `.meta.json` へ補完するメタ。空なら補完不要 */
  metaPatch: Partial<LessonMetaFields>;
};

/**
 * Agent 草稿（本文のみ）を受領し、tags / estimated_minutes の補完 patch を作る。
 * status・description は既存値を維持する（草稿は本文だけを運ぶ）。
 */
export function normalizeDraftForLesson(
  draftBody: string,
  lesson: Pick<
    Lesson,
    "lesson" | "course" | "description" | "tags" | "estimated_minutes"
  >,
  options: NormalizeDraftOptions = {},
): DraftForLesson {
  const body = migrateQuizBlocksInBody(draftBody);
  const availableTags = options.availableTags ?? [];
  const contextItemTags = options.contextItemTags ?? [];
  const bodyText = [
    lesson.description,
    lesson.course,
    lesson.lesson,
    body,
  ].join("\n");

  const metaPatch: Partial<LessonMetaFields> = {};

  if (lesson.tags.length === 0) {
    const tags = resolveDraftTags({
      fallbackTags: [],
      availableTags,
      contextItemTags,
      bodyText,
    });
    if (tags.length > 0) metaPatch.tags = tags;
  }

  if (!(lesson.estimated_minutes > 0)) {
    metaPatch.estimated_minutes = estimateDraftMinutes(body);
  }

  return { body, metaPatch };
}
