/**
 * 翻訳の鮮度判定（translation-freshness spec の正本実装）。
 *
 * 判定はファイルの内容だけから行い、mtime・git に依存しない。
 * mandala 側にも最小実装があり（scripts/lib/translation-freshness.mts）、
 * parity テストが実 contents/ で両者の一致を検証する——規則を変えるときは両方直す。
 */
import { createHash } from "node:crypto";

/** 鮮度の3状態 */
export type TranslationFreshness = "untranslated" | "fresh" | "stale";

/** `contents.en.md` 1行目の原文ハッシュコメント */
const SOURCE_HASH_COMMENT_PATTERN = /^<!--\s*source:\s*(sha256:[0-9a-f]{64})\s*-->\s*$/;

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
  const firstLine = newlineIndex === -1 ? normalized : normalized.slice(0, newlineIndex);
  const match = SOURCE_HASH_COMMENT_PATTERN.exec(firstLine.trim());
  if (!match) return { sourceHash: null, body: enRaw };
  const rest = newlineIndex === -1 ? "" : normalized.slice(newlineIndex + 1);
  // ハッシュ行直後の空行1つまで剥がす（ハッシュ行が本文の行間を変えないように）
  return { sourceHash: match[1], body: rest.replace(/^\n/, "") };
}

/**
 * 本文の鮮度判定。
 * enRaw が null（contents.en.md 不在）→ untranslated。
 * ハッシュ未記録・不一致 → stale（鮮度不明は保守的に古い扱い）。
 */
export function bodyFreshness(
  jaBody: string,
  enRaw: string | null,
): TranslationFreshness {
  if (enRaw === null) return "untranslated";
  const { sourceHash } = parseEnBody(enRaw);
  if (sourceHash === null) return "stale";
  return sourceHash === computeBodySourceHash(jaBody) ? "fresh" : "stale";
}

/**
 * レッスン本文の英訳が「まだ入っていない」か（赤字1行の未翻訳判定・studio-translation spec）。
 *
 * ファイル不在・空・**ハッシュ行だけ**のいずれも空とみなす。日本語本文が空なら
 * 訳しようがないので対象外——書きかけのレッスンを未翻訳として責めない。
 */
export function isBodyUntranslated(
  jaBody: string,
  enRaw: string | null,
): boolean {
  if (jaBody.trim() === "") return false;
  if (enRaw === null) return true;
  return isBlankEnText(parseEnBody(enRaw).body);
}

// ===== メタの鮮度 =====

/**
 * 階層別のメタ原文（固定順）。
 * 名前の正本がフォルダ名の階層（シリーズ・コース・レッスン）は name にフォルダ名を渡す。
 * レッスンの `author` は**翻訳しないが欠落判定には要る**ので受け取る（`EN_FIELDS` 参照）。
 */
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
  | { level: "lesson"; name: string; description: string; author: string };

export type EnFieldDef = {
  /** `.meta.json` の英訳側のキー */
  enKey: string;
  /** 対応する日本語原文のキー（`MetaSourceFields` のプロパティ名） */
  jaKey: string;
  /**
   * 翻訳の対象か。`true` のフィールドだけが
   * **原文ハッシュの入力**・**メタ英訳 API で書けるフィールド**・
   * **「英訳が1つでもあるか」の判定**に入る。
   */
  translated: boolean;
};

/**
 * 階層別のフィールド対応表。**この表がこの capability の正本**
 * （translation-freshness spec）。走査スクリプトや Studio の英語ビューに
 * 書き写さず、ここから引くこと。
 *
 * ⚠ **並びを変えてはならない。** `translated: true` のフィールドの並びが
 * そのまま原文ハッシュの入力配列になるので、順を入れ替えると既存の
 * `en_source_hash` がすべて不一致になり、翻訳済みユニットが一斉に stale へ落ちる。
 *
 * ⚠ `author_en` が `translated: false` なのは意図的な非対称:
 * - **欠落判定には入れる**——空欄が「意図した空白」か「入れ忘れ」か区別できず、
 *   執筆者に手入力を促す合図が要る
 * - **ハッシュ入力には入れない**——入れると既存の `en_source_hash` が全部無効になる。
 *   加えて `author` の差し替えは英訳の鮮度と無関係
 * - **翻訳ボタンは触らない**——人名の英字表記は本人の流儀。機械に推測させると
 *   `Andreas → Andrew` のようにもっともらしく誤った綴りが入り、レビューで見抜けない
 */
export const EN_FIELDS: Record<
  MetaSourceFields["level"],
  readonly EnFieldDef[]
> = {
  root: [
    { enKey: "name_en", jaKey: "name", translated: true },
    { enKey: "description_en", jaKey: "description", translated: true },
  ],
  series: [
    { enKey: "name_en", jaKey: "name", translated: true },
    { enKey: "catch_en", jaKey: "catch", translated: true },
    { enKey: "description_en", jaKey: "description", translated: true },
  ],
  course: [
    { enKey: "name_en", jaKey: "name", translated: true },
    { enKey: "catch_en", jaKey: "catch", translated: true },
    { enKey: "description_en", jaKey: "description", translated: true },
    { enKey: "target_en", jaKey: "target", translated: true },
  ],
  lesson: [
    { enKey: "name_en", jaKey: "name", translated: true },
    { enKey: "description_en", jaKey: "description", translated: true },
    { enKey: "author_en", jaKey: "author", translated: false },
  ],
};

/** 翻訳対象キー（`_en` 側の名前）を固定順で返す。メタ英訳 API の許可リストでもある */
export function translatedEnKeys(
  level: MetaSourceFields["level"],
): readonly string[] {
  return EN_FIELDS[level].filter((f) => f.translated).map((f) => f.enKey);
}

/** 原文を `jaKey` で引ける形にする（表と突き合わせるため） */
function jaValues(fields: MetaSourceFields): Record<string, string> {
  switch (fields.level) {
    case "root":
      return { name: fields.name, description: fields.description };
    case "series":
      return {
        name: fields.name,
        catch: fields.catch,
        description: fields.description,
      };
    case "course":
      return {
        name: fields.name,
        catch: fields.catch,
        description: fields.description,
        target: fields.target,
      };
    case "lesson":
      return {
        name: fields.name,
        description: fields.description,
        author: fields.author,
      };
  }
}

/** 翻訳対象フィールドの固定順配列（未設定は空文字列） */
function metaSourceArray(fields: MetaSourceFields): string[] {
  const ja = jaValues(fields);
  return EN_FIELDS[fields.level]
    .filter((f) => f.translated)
    .map((f) => ja[f.jaKey] ?? "");
}

/**
 * メタの原文ハッシュ。固定順配列を JSON.stringify した文字列のハッシュ
 * （区切り文字の曖昧さ ["a\nb"] vs ["a","b"] を避ける）。各要素は CRLF→LF 正規化。
 */
export function computeMetaSourceHash(fields: MetaSourceFields): string {
  const normalized = metaSourceArray(fields).map((v) => normalizeNewlines(v));
  return sha256Tag(JSON.stringify(normalized));
}

/**
 * メタの鮮度判定。
 * hasEnValues: `_en` フィールドのいずれかが非空か。
 * storedHash: `.meta.json` の `en_source_hash`（無ければ null）。
 */
export function metaFreshness(
  fields: MetaSourceFields,
  hasEnValues: boolean,
  storedHash: string | null,
): TranslationFreshness {
  if (!hasEnValues) return "untranslated";
  if (storedHash === null) return "stale";
  return storedHash === computeMetaSourceHash(fields) ? "fresh" : "stale";
}

/**
 * 「訳が入っている」の唯一の判定。
 *
 * ⚠ **キーが無い・空文字・空白のみを区別しない**（translation-freshness spec）。
 * `.meta.json` にキーごと無い状態も `""` も「訳が入っていない」という同じ事実を指す
 * ので、片方だけ拾うと `.meta.json` の書かれ方で赤字が出たり出なかったりする。
 */
const isNonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

/** ファイル本文が「訳が入っていない」か。不在（null）も空とみなす */
export function isBlankEnText(text: string | null): boolean {
  return text === null || text.trim() === "";
}

/**
 * `_en` フィールドが1つでも埋まっているか（`metaFreshness` の `hasEnValues` 用）。
 * 呼び出し側が階層ごとのキー一覧を自前で持たなくて済むよう、ここで提供する。
 *
 * ⚠ 翻訳対象（`translated: true`）だけを見る。`author_en` を数えると、
 * 著者名を手で入れただけのユニットが「英訳あり」になり鮮度3状態の意味が濁る。
 */
export function hasAnyEnValue(
  level: MetaSourceFields["level"],
  enValues: Readonly<Record<string, unknown>>,
): boolean {
  return translatedEnKeys(level).some((key) => isNonEmpty(enValues[key]));
}

/**
 * 未記入の `_en` フィールドを列挙する（translation-freshness spec）。
 *
 * ⚠ **鮮度（3状態）とは独立した情報。** 鮮度は「原文に追随しているか」、欠落は
 * 「フィールドが埋まっているか」を見ており、欠落があることを理由に鮮度を
 * 変えてはならない——変えると既存の翻訳済みユニットが一斉に stale 化して
 * Studio の赤字表示と差分翻訳の対象が膨れる。
 *
 * ⚠ 判定は**原文側が非空のフィールドに限る**。原文が空なら訳しようがなく、
 * 数えると未完成の日本語メタを欠落として誤検出する。
 *
 * ⚠ 翻訳対象でない `author_en` も列挙する（`EN_FIELDS` の非対称の理由を参照）。
 * つまりここに挙がるキーが翻訳ボタンで必ず埋まるとは限らない。
 *
 * `metaFreshness` が `fresh` を返すユニットでも欠落は出うる——`hasEnValues` は
 * 「1つでも埋まっていれば真」なので、部分的な記入は鮮度からは見えない。
 */
export function listMissingEnFields(
  fields: MetaSourceFields,
  enValues: Readonly<Record<string, unknown>>,
): string[] {
  const ja = jaValues(fields);
  return EN_FIELDS[fields.level]
    .filter((f) => isNonEmpty(ja[f.jaKey]) && !isNonEmpty(enValues[f.enKey]))
    .map((f) => f.enKey);
}

// ===== changelog の鮮度 =====

const CHANGELOG_ENTRY_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/m;

/** changelog の先頭（最新）エントリ日付。無ければ null */
export function firstChangelogEntryDate(content: string): string | null {
  const match = CHANGELOG_ENTRY_HEADING.exec(normalizeNewlines(content));
  return match ? match[1] : null;
}

/**
 * changelog の鮮度判定（ハッシュは使わない・日英の先頭エントリ日付比較）。
 * enContent が null（changelog.en.md 不在）→ untranslated。
 * 英語側に日付が無い・日本語側より古い → stale。
 * 日本語側に日付が無い（履歴が空）なら英語版があれば fresh とみなす。
 */
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

/**
 * changelog の英訳が「まだ入っていない」か（ホームの赤字1行・studio-translation spec）。
 *
 * `changelog.en.md` の不在・空のいずれも空とみなす。日本語側にエントリが 1 つも
 * 無ければ対象外——訳す中身が無い状態を未翻訳として責めない。
 */
export function isChangelogUntranslated(
  jaContent: string | null,
  enContent: string | null,
): boolean {
  if (jaContent === null || firstChangelogEntryDate(jaContent) === null) {
    return false;
  }
  return isBlankEnText(enContent);
}
