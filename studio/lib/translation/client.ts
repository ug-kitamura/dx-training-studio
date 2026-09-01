"use client";

/**
 * 翻訳まわりのクライアント側フェッチヘルパー（studio-translation spec）。
 * コンポーネントを薄く保つため、API の形はここに集約する。
 */
import { aiRequestHeaders } from "@/lib/agent-request-headers";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";

export type TranslationFreshness = "untranslated" | "fresh" | "stale";
export type UnitLevel = "root" | "series" | "course" | "lesson";

export type UnitTranslationStatus = {
  meta: TranslationFreshness;
  /**
   * メタの空欄（訳が入っていない `_en` キー）。原文が非空のものだけ。
   * ⚠ レッスンでは `author_en` も入りうる——翻訳ボタンでは埋まらない
   */
  metaMissing: string[];
  /** レッスンのみ */
  body?: TranslationFreshness;
  /** レッスンのみ。本文の英訳がまだ入っていないか */
  bodyMissing?: boolean;
};

export type TranslationStatuses = {
  statuses: Partial<Record<UnitLevel, UnitTranslationStatus>>;
  changelog: TranslationFreshness | null;
  /** changelog.en.md がまだ無い・空か（日本語側にエントリがあるときだけ真） */
  changelogMissing: boolean;
};

/**
 * 赤字1行に渡す 2 値（studio-translation spec）。
 * どちらを描くかの優先順位は `TranslationNotice` が持つ。
 */
export type TranslationNoticeState = {
  /** 空欄のブロックが 1 つ以上ある */
  untranslated: boolean;
  /** 翻訳が原文より古い */
  stale: boolean;
};

/** 未取得（ロード中）は何も出さない */
export const NO_TRANSLATION_NOTICE: TranslationNoticeState = {
  untranslated: false,
  stale: false,
};

export type UnitNames = { series?: string; course?: string; lesson?: string };

function unitQuery(names: UnitNames): string {
  const params = new URLSearchParams();
  if (names.series) params.set("series", names.series);
  if (names.course) params.set("course", names.course);
  if (names.lesson) params.set("lesson", names.lesson);
  return params.toString();
}

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}

export async function fetchTranslationStatus(
  names: UnitNames,
): Promise<TranslationStatuses> {
  const res = await fetch(`/api/content/translation-status?${unitQuery(names)}`);
  return readJson<TranslationStatuses>(res);
}

export type MetaEnData = {
  ja: Record<string, string>;
  en: Record<string, string>;
  en_source_hash: string | null;
  author_en?: string;
};

export async function fetchMetaEn(
  level: UnitLevel,
  names: UnitNames,
): Promise<MetaEnData> {
  const res = await fetch(
    `/api/content/meta-en?level=${level}&${unitQuery(names)}`,
  );
  return readJson<MetaEnData>(res);
}

export async function saveMetaEn(args: {
  level: UnitLevel;
  names: UnitNames;
  fields: Record<string, string>;
  enSourceHash?: string;
}): Promise<void> {
  const res = await fetch("/api/content/meta-en", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      level: args.level,
      ...args.names,
      fields: args.fields,
      ...(args.enSourceHash !== undefined
        ? { en_source_hash: args.enSourceHash }
        : {}),
    }),
  });
  await readJson(res);
}

export async function translateMeta(
  level: UnitLevel,
  names: UnitNames,
): Promise<{ fields: Record<string, string>; en_source_hash: string }> {
  const res = await fetch("/api/content/translate/meta", {
    method: "POST",
    headers: aiRequestHeaders(loadWorkspaceSettings()),
    body: JSON.stringify({ level, ...names }),
  });
  return readJson(res);
}

export async function translateLessonBody(
  names: Required<UnitNames>,
): Promise<{ body: string; sourceHash: string }> {
  const res = await fetch("/api/content/translate/lesson-body", {
    method: "POST",
    headers: aiRequestHeaders(loadWorkspaceSettings()),
    body: JSON.stringify(names),
  });
  return readJson(res);
}

export async function translateChangelog(): Promise<{
  kind: "entries" | "full";
  text: string;
}> {
  const res = await fetch("/api/content/translate/changelog", {
    method: "POST",
    headers: aiRequestHeaders(loadWorkspaceSettings()),
    body: JSON.stringify({}),
  });
  return readJson(res);
}

export async function fetchLessonEnBody(
  names: Required<UnitNames>,
): Promise<{ exists: boolean; body: string; sourceHash: string | null }> {
  const res = await fetch(`/api/content/lesson-en?${unitQuery(names)}`);
  return readJson(res);
}

export async function saveLessonEnBody(args: {
  names: Required<UnitNames>;
  content: string;
  sourceHash?: string;
}): Promise<void> {
  const res = await fetch("/api/content/save-lesson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...args.names,
      content: args.content,
      language: "en",
      ...(args.sourceHash ? { sourceHash: args.sourceHash } : {}),
    }),
  });
  await readJson(res);
}

/**
 * 1 つのユニットのメタから赤字1行の 2 値を作る。
 * 未取得（`undefined`）のときは何も出さない。
 */
export function metaNoticeState(
  status: UnitTranslationStatus | undefined,
): TranslationNoticeState {
  if (!status) return NO_TRANSLATION_NOTICE;
  return {
    // `?? []` は保険。ここで落ちるとワークスペースの面ごと白くなるので、
    // 想定外の形が来ても「空欄なし」に倒す
    untranslated: (status.metaMissing ?? []).length > 0,
    stale: status.meta === "stale",
  };
}
