import { z } from "zod";
import { resolveAiApiKey } from "@/lib/api-keys";
import { resolveAiModel } from "@/lib/resolve-ai-model";
import { AI_KEY_ERROR } from "@/lib/agent/llm/anthropic";
import { getProjectRoot } from "@/lib/project-root";
import { computeMetaSourceHash } from "@/lib/translation/freshness";
import { runTranslationTurn } from "@/lib/translation/llm";
import {
  buildMetaSystemPrompt,
  buildMetaUserPrompt,
  META_TRANSLATABLE_FIELDS,
  parseMetaResponse,
  readTranslationContract,
  TRANSLATION_CONTRACT_MISSING_ERROR,
} from "@/lib/translation/prompts";
import {
  readExistingEnValues,
  resolveUnit,
  unitMetaSourceFields,
} from "@/lib/translation/units";

const bodySchema = z.object({
  level: z.enum(["root", "series", "course", "lesson"]),
  series: z.string().min(1).optional(),
  course: z.string().min(1).optional(),
  lesson: z.string().min(1).optional(),
});

/**
 * メタ翻訳の下書き（studio-translation spec）。
 *
 * AI はフィールド値だけを返し、正本には書かない——フィールドへの流し込みと
 * 保存は人（クライアント＋既存の保存経路）が行う。`en_source_hash` は
 * **翻訳に使った現在の日本語フィールドからサーバーが計算**して返す——
 * モデルに生成させない（鮮度の偽装防止）。author / author_en は対象外。
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const apiKey = resolveAiApiKey(req);
  if (!apiKey) {
    return Response.json({ error: AI_KEY_ERROR }, { status: 401 });
  }

  // モデルはギアメニューの選択に従う（未対応モデルは他の AI 機能と同じエラー）
  const model = resolveAiModel(req);
  if (!model.ok) {
    return Response.json({ error: model.error }, { status: 400 });
  }

  const projectRoot = getProjectRoot();
  const contract = readTranslationContract(projectRoot);
  if (!contract) {
    return Response.json(
      { error: TRANSLATION_CONTRACT_MISSING_ERROR },
      { status: 500 },
    );
  }

  const { level, series, course, lesson } = parsed.data;
  const unit = resolveUnit(projectRoot, level, { series, course, lesson });
  if (!unit) {
    return Response.json(
      { error: `対象が見つかりません: ${[series, course, lesson].filter(Boolean).join("/") || "(root)"}` },
      { status: 404 },
    );
  }

  const sourceFields = unitMetaSourceFields(unit);
  const fieldDefs = META_TRANSLATABLE_FIELDS[level];
  const sourceValues = sourceFields as unknown as Record<string, string>;
  // prompts の定義順（= freshness の固定順）に沿って ja 値を並べる
  const jaKeysByLevel: Record<string, string[]> = {
    root: ["name", "description"],
    series: ["name", "catch", "description"],
    course: ["name", "catch", "description", "target"],
    lesson: ["name", "description"],
  };
  const jaValues = fieldDefs.map((def, i) => ({
    ...def,
    value: sourceValues[jaKeysByLevel[level][i]] ?? "",
  }));

  const result = await runTranslationTurn({
    apiKey,
    model: model.model,
    system: buildMetaSystemPrompt(contract),
    userPrompt: buildMetaUserPrompt({
      level,
      jaValues,
      existingEn: readExistingEnValues(unit),
    }),
    parse: (text) => parseMetaResponse(text, fieldDefs.map((f) => f.enKey)),
    signal: req.signal,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    fields: result.value.fields,
    // 保存時にこの値を en_source_hash として書けば「この翻訳は現在の原文由来」が記録される
    en_source_hash: computeMetaSourceHash(sourceFields),
  });
}
