/** シリーズ・コースの安定 ID 生成（`.meta.json` の `id` フィールド用） */

const MAX_SLUG_LEN = 24;

function hashSuffix(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 6);
}

/** 表示名から ASCII slug を生成（空なら名前ハッシュの短い suffix） */
export function nameToSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LEN);
  return base.length > 0 ? base : `n-${hashSuffix(name)}`;
}

function randomSuffix(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function uniqueId(prefix: string, slug: string, usedIds?: Set<string>): string {
  let id = `${prefix}-${slug}-${randomSuffix()}`;
  while (usedIds?.has(id)) {
    id = `${prefix}-${slug}-${randomSuffix()}`;
  }
  usedIds?.add(id);
  return id;
}

export function generateSeriesId(name: string, usedIds?: Set<string>): string {
  return uniqueId("srs", nameToSlug(name), usedIds);
}

export function generateCourseId(name: string, usedIds?: Set<string>): string {
  return uniqueId("crs", nameToSlug(name), usedIds);
}

/**
 * レッスンの安定 ID（`lsn-{slug}-{random6}`）。slug 未設定なら表示名から導出する。
 * シリーズ・コースと同じく、無ければローダーが採番して `.meta.json` に書き戻す。
 */
export function generateLessonStableId(
  name: string,
  slug: string | undefined,
  usedIds?: Set<string>,
): string {
  return uniqueId("lsn", slug || nameToSlug(name), usedIds);
}

/** `.meta.json` から保存済み ID を読む */
export function readStoredId(meta: Record<string, unknown>): string | undefined {
  const id = meta.id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/** レッスン ID（現行規則。将来 stable 化予定） */
export function buildLessonId(
  seriesName: string,
  courseName: string,
  lessonName: string,
): string {
  return `lesson-${seriesName}-${courseName}-${lessonName}`;
}
