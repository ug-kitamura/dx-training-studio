/**
 * 翻訳の鮮度判定（translation-freshness spec）。
 *
 * 正本実装は Studio 側の `studio/lib/translation/freshness.ts`。
 * mandala は独立プロジェクトなので直接 import せず、ここで同じ規則を実装する。
 * ずれの検出は parity テスト（実 contents を両者で判定して突き合わせ）が担う
 * ——規則を変えるときは両方直す。
 */
import { createHash } from "node:crypto";

/** 鮮度の3状態 */
export type TranslationFreshness = "untranslated" | "fresh" | "stale";

/** `contents.en.md` 1行目の原文ハッシュコメント */
const SOURCE_HASH_COMMENT_PATTERN =
  /^<!--\s*source:\s*(sha256:[0-9a-f]{64})\s*-->\s*$/;

/** CRLF→LF 正規化。Windows と git autocrlf で同一内容が別ハッシュになる事故を防ぐ */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/** 正規化済みテキストの SHA-256（`sha256:<hex>` 形式） */
export function sha256Tag(text: string): string {
  return `sha256:${createHash("sha256").update(normalizeNewlines(text), "utf-8").digest("hex")}`;
}

/** 本文（contents.md 全文）の原文ハッシュ */
export function computeBodySourceHash(jaBody: string): string {
  return sha256Tag(jaBody);
}

/** contents.en.md の1行目に書くハッシュコメント行（改行なし） */
export function formatSourceHashComment(hash: string): string {
  return `<!-- source: ${hash} -->`;
}

export type ParsedEnBody = {
  /** 1行目のハッシュ（無ければ null） */
  sourceHash: string | null;
  /** ハッシュコメント行を除いた本文 */
  body: string;
};

/** contents.en.md からハッシュコメントを解析し、本文から剥がす */
export function parseEnBody(enRaw: string): ParsedEnBody {
  const normalized = normalizeNewlines(enRaw);
  const newlineIndex = normalized.indexOf("\n");
  const firstLine =
    newlineIndex === -1 ? normalized : normalized.slice(0, newlineIndex);
  const match = SOURCE_HASH_COMMENT_PATTERN.exec(firstLine.trim());
  if (!match) return { sourceHash: null, body: enRaw };
  const rest = newlineIndex === -1 ? "" : normalized.slice(newlineIndex + 1);
  // ハッシュ行直後の空行1つまで剥がす（ハッシュ行が本文の行間を変えないように）
  return { sourceHash: match[1], body: rest.replace(/^\n/, "") };
}

/** 本文の鮮度判定。enRaw が null（contents.en.md 不在）→ untranslated */
export function bodyFreshness(
  jaBody: string,
  enRaw: string | null,
): TranslationFreshness {
  if (enRaw === null) return "untranslated";
  const { sourceHash } = parseEnBody(enRaw);
  if (sourceHash === null) return "stale";
  return sourceHash === computeBodySourceHash(jaBody) ? "fresh" : "stale";
}

// ===== メタの鮮度 =====

/** 階層別の翻訳対象フィールド（固定順）。author / author_en は含めない */
export type MetaSourceFields =
  | { level: "root"; name: string; description: string }
  | { level: "series"; name: string; catch: string; description: string }
  | {
      level: "course";
      name: string;
      catch: string;
      description: string;
      target: string;
    }
  | { level: "lesson"; name: string; description: string };

function metaSourceArray(fields: MetaSourceFields): string[] {
  switch (fields.level) {
    case "root":
      return [fields.name, fields.description];
    case "series":
      return [fields.name, fields.catch, fields.description];
    case "course":
      return [fields.name, fields.catch, fields.description, fields.target];
    case "lesson":
      return [fields.name, fields.description];
  }
}

/** メタの原文ハッシュ（固定順配列の JSON.stringify をハッシュ） */
export function computeMetaSourceHash(fields: MetaSourceFields): string {
  const normalized = metaSourceArray(fields).map((v) => normalizeNewlines(v));
  return sha256Tag(JSON.stringify(normalized));
}

/** メタの鮮度判定 */
export function metaFreshness(
  fields: MetaSourceFields,
  hasEnValues: boolean,
  storedHash: string | null,
): TranslationFreshness {
  if (!hasEnValues) return "untranslated";
  if (storedHash === null) return "stale";
  return storedHash === computeMetaSourceHash(fields) ? "fresh" : "stale";
}

// ===== changelog の鮮度 =====

const CHANGELOG_ENTRY_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/m;

/** changelog の先頭（最新）エントリ日付。無ければ null */
export function firstChangelogEntryDate(content: string): string | null {
  const match = CHANGELOG_ENTRY_HEADING.exec(normalizeNewlines(content));
  return match ? match[1] : null;
}

/** changelog の鮮度判定（日英の先頭エントリ日付比較。ハッシュは使わない） */
export function changelogFreshness(
  jaContent: string,
  enContent: string | null,
): TranslationFreshness {
  if (enContent === null) return "untranslated";
  const jaDate = firstChangelogEntryDate(jaContent);
  if (jaDate === null) return "fresh";
  const enDate = firstChangelogEntryDate(enContent);
  if (enDate === null) return "stale";
  // YYYY-MM-DD は文字列比較で日付順になる
  return enDate >= jaDate ? "fresh" : "stale";
}
