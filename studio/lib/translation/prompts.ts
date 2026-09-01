/**
 * 翻訳 API（メタ・本文・changelog）のプロンプト組み立てと応答パース。
 *
 * 作法は changelog-draft と同じ: AI は値だけを返し、正本には書かない。
 * 規則の SSoT は `contracts/translation-contract.md`（翻訳スキルと共用）——
 * ここに規則を書き足さないこと。
 */
import fs from "node:fs";
import path from "node:path";
import { parseJsonObject } from "@/lib/llm-response";

export const TRANSLATION_CONTRACT_RELATIVE_PATH = "contracts/translation-contract.md";

/**
 * 翻訳契約の全文を読む。無ければ null——呼び出し側（API）はエラーで止める。
 * 契約なしの翻訳は規則ドリフトの温床なので、黙って続行しない
 */
export function readTranslationContract(projectRoot: string): string | null {
  const contractPath = path.join(
    projectRoot,
    ...TRANSLATION_CONTRACT_RELATIVE_PATH.split("/"),
  );
  if (!fs.existsSync(contractPath)) return null;
  const content = fs.readFileSync(contractPath, "utf-8");
  return content.trim() ? content : null;
}

export const TRANSLATION_CONTRACT_MISSING_ERROR =
  "翻訳契約（contracts/translation-contract.md）が見つかりません。翻訳規則なしでは実行できません";

/** 共通の出力規律（JSON のみ・前置き禁止） */
function jsonOnlyRule(shape: string): string {
  return [
    `出力は次の JSON オブジェクトのみ。前置き・後書き・コードフェンスを出力してはならない。`,
    shape,
  ].join("\n");
}

function contractSection(contract: string): string {
  return ["以下の翻訳契約に厳密に従うこと。", "", "<翻訳契約>", contract, "</翻訳契約>"].join(
    "\n",
  );
}

// ===== メタ翻訳 =====

/** 階層ごとの翻訳対象フィールド（ja キー → en キー）。author 系は含めない */
export const META_TRANSLATABLE_FIELDS: Record<
  "root" | "series" | "course" | "lesson",
  Array<{ jaLabel: string; enKey: string }>
> = {
  root: [
    { jaLabel: "サイト名 (name)", enKey: "name_en" },
    { jaLabel: "説明 (description)", enKey: "description_en" },
  ],
  series: [
    { jaLabel: "シリーズ名 (フォルダ名)", enKey: "name_en" },
    { jaLabel: "キャッチ (catch)", enKey: "catch_en" },
    { jaLabel: "説明 (description)", enKey: "description_en" },
  ],
  course: [
    { jaLabel: "コース名 (フォルダ名)", enKey: "name_en" },
    { jaLabel: "キャッチ (catch)", enKey: "catch_en" },
    { jaLabel: "説明 (description)", enKey: "description_en" },
    { jaLabel: "受講対象者 (target)", enKey: "target_en" },
  ],
  lesson: [
    { jaLabel: "レッスン名 (フォルダ名)", enKey: "name_en" },
    { jaLabel: "説明 (description)", enKey: "description_en" },
  ],
};

export function buildMetaSystemPrompt(contract: string): string {
  return [
    "あなたは DX トレーニング教材のメタ情報（名前・キャッチ・説明など）を英訳する翻訳者である。",
    jsonOnlyRule('{"fields": {"<英語フィールド名>": "<訳文>", ...}}'),
    "",
    "規則:",
    "- 指定されたフィールドだけを訳す。日本語の値が空のフィールドは空文字列を返す",
    "- 既存の英訳が与えられた場合は、それを活かし、日本語側と食い違う箇所だけ更新する",
    "",
    contractSection(contract),
  ].join("\n");
}

export function buildMetaUserPrompt(args: {
  level: keyof typeof META_TRANSLATABLE_FIELDS;
  jaValues: Array<{ jaLabel: string; enKey: string; value: string }>;
  existingEn: Record<string, string>;
}): string {
  const lines = [
    `階層: ${args.level}`,
    "",
    "## 日本語の値",
    "",
    ...args.jaValues.map(
      (f) => `- ${f.jaLabel} → ${f.enKey}: ${JSON.stringify(f.value)}`,
    ),
  ];
  const existing = Object.entries(args.existingEn).filter(([, v]) => v);
  if (existing.length > 0) {
    lines.push(
      "",
      "## 既存の英訳（活かして必要な箇所だけ更新する）",
      "",
      ...existing.map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`),
    );
  }
  return lines.join("\n");
}

export type MetaTranslationResult = { fields: Record<string, string> };

export function parseMetaResponse(
  text: string,
  allowedKeys: string[],
): MetaTranslationResult | null {
  const parsed = parseJsonObject(text);
  if (!parsed) return null;
  const fields = parsed.fields;
  if (typeof fields !== "object" || fields === null) return null;
  const allowed = new Set(allowedKeys);
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    if (!allowed.has(key)) continue;
    if (typeof value !== "string") return null;
    result[key] = value;
  }
  return { fields: result };
}

// ===== 本文翻訳 =====

export function buildBodySystemPrompt(contract: string): string {
  return [
    "あなたは DX トレーニング教材のレッスン本文（Markdown）を英訳する翻訳者である。",
    jsonOnlyRule('{"body": "<英訳した Markdown 全文>"}'),
    "",
    "規則:",
    "- Markdown の構造（見出しレベル・箇条書き・表・アラート記法・コードブロック）を保つ",
    "- 既存の英訳が与えられた場合は、それを活かし、原文の変更に対応する箇所だけ訳し直す",
    "- 原文ハッシュコメント（<!-- source: ... -->）を出力に含めてはならない（機構が別途付与する）",
    "",
    contractSection(contract),
  ].join("\n");
}

export function buildBodyUserPrompt(args: {
  jaBody: string;
  existingEnBody: string | null;
}): string {
  const lines = ["## 日本語原文（contents.md 全文）", "", args.jaBody];
  if (args.existingEnBody !== null && args.existingEnBody.trim()) {
    lines.push(
      "",
      "## 既存の英訳（活かして、原文の変更に対応する箇所だけ更新する）",
      "",
      args.existingEnBody,
    );
  }
  return lines.join("\n");
}

export type BodyTranslationResult = { body: string };

export function parseBodyResponse(text: string): BodyTranslationResult | null {
  const parsed = parseJsonObject(text);
  if (!parsed) return null;
  const body = parsed.body;
  if (typeof body !== "string" || !body.trim()) return null;
  return { body };
}

/**
 * 途中切れの弱い検査: 見出し（# 始まり行）の数が原文から大きく減っていたら疑う。
 * 厳密な検証は不可能なので、最終判断は人の差分確認に任せる（design D3）
 */
export function looksTruncated(jaBody: string, enBody: string): boolean {
  const count = (s: string): number =>
    s.split(/\r?\n/).filter((line) => /^#{1,6}\s/.test(line)).length;
  const jaHeadings = count(jaBody);
  const enHeadings = count(enBody);
  if (jaHeadings === 0) return false;
  return enHeadings < jaHeadings / 2;
}

// ===== changelog 追訳 =====

export function buildChangelogSystemPrompt(contract: string): string {
  return [
    "あなたは DX トレーニング教材の変更履歴（changelog）を英訳する翻訳者である。",
    jsonOnlyRule(
      '{"entries": "<英語側に無い新しいエントリの英訳（## YYYY-MM-DD 見出しごと）>"} または {"full": "<全文の英訳>"}',
    ),
    "",
    "規則:",
    "- 既存の英語版が与えられた場合: 英語側の先頭エントリより新しい日本語エントリ**だけ**を訳し、entries として返す。既存エントリを訳し直してはならない",
    "- 英語版が無い場合: ヘッダー部分を含む全文を訳し、full として返す",
    "- 見出し（## YYYY-MM-DD）の日付は変えない",
    "",
    contractSection(contract),
  ].join("\n");
}

export function buildChangelogUserPrompt(args: {
  jaContent: string;
  enContent: string | null;
}): string {
  const lines = ["## 日本語の変更履歴（全文）", "", args.jaContent];
  if (args.enContent !== null) {
    lines.push("", "## 既存の英語版（全文）", "", args.enContent);
  } else {
    lines.push("", "（英語版はまだ存在しない——全文を訳して full で返す）");
  }
  return lines.join("\n");
}

export type ChangelogTranslationResult =
  | { kind: "entries"; text: string }
  | { kind: "full"; text: string };

export function parseChangelogResponse(
  text: string,
): ChangelogTranslationResult | null {
  const parsed = parseJsonObject(text);
  if (!parsed) return null;
  if (typeof parsed.entries === "string" && parsed.entries.trim()) {
    return { kind: "entries", text: parsed.entries };
  }
  if (typeof parsed.full === "string" && parsed.full.trim()) {
    return { kind: "full", text: parsed.full };
  }
  return null;
}

export const TRANSLATION_RETRY_PROMPT =
  "出力が指定の JSON 形式ではありません。指定された形の JSON オブジェクトだけを出力し直してください。";
