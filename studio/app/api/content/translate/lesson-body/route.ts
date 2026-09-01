import { z } from "zod";
import { resolveAiApiKey } from "@/lib/api-keys";
import { resolveAiModel } from "@/lib/resolve-ai-model";
import { AI_KEY_ERROR } from "@/lib/agent/llm/anthropic";
import { getProjectRoot } from "@/lib/project-root";
import {
  computeBodySourceHash,
  normalizeNewlines,
  parseEnBody,
} from "@/lib/translation/freshness";
import { runTranslationTurn } from "@/lib/translation/llm";
import {
  buildBodySystemPrompt,
  buildBodyUserPrompt,
  looksTruncated,
  parseBodyResponse,
  readTranslationContract,
  TRANSLATION_CONTRACT_MISSING_ERROR,
} from "@/lib/translation/prompts";
import { readLessonBodies, resolveUnit } from "@/lib/translation/units";

const bodySchema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  lesson: z.string().min(1),
});

/**
 * レッスン本文翻訳の下書き（studio-translation spec）。
 *
 * 原文ハッシュ行つきの `contents.en.md` 完成形を返す——ハッシュはサーバーが
 * 翻訳に使った `contents.md` から計算する。正本には書かない（適用は
 * クライアントが保存経路で行う）。既訳があれば差分翻訳を指示する。
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

  const { series, course, lesson } = parsed.data;
  const unit = resolveUnit(projectRoot, "lesson", { series, course, lesson });
  if (!unit) {
    return Response.json(
      { error: `レッスンが見つかりません: ${series}/${course}/${lesson}` },
      { status: 404 },
    );
  }

  const { jaBody, enRaw } = readLessonBodies(unit.dir);
  if (!jaBody.trim()) {
    return Response.json(
      { error: "日本語本文が空のため翻訳できません" },
      { status: 400 },
    );
  }

  const result = await runTranslationTurn({
    apiKey,
    model: model.model,
    system: buildBodySystemPrompt(contract),
    userPrompt: buildBodyUserPrompt({
      jaBody,
      existingEnBody: enRaw === null ? null : parseEnBody(enRaw).body,
    }),
    parse: parseBodyResponse,
    signal: req.signal,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const translated = normalizeNewlines(result.value.body).replace(/^\n+/, "");
  // 途中切れの弱い検査（design D3）。最終判断は人の差分確認に任せる
  if (looksTruncated(jaBody, translated)) {
    return Response.json(
      {
        error:
          "訳文の見出しが原文より大幅に少なく、途中で切れている可能性があります。もう一度試してください",
      },
      { status: 502 },
    );
  }

  // ハッシュ行は本文と分けて返す——保存（save-lesson の language: "en" ＋
  // sourceHash）がハッシュ行つきの完成形に組み立てる。エディタは body だけを見る
  return Response.json({
    body: `${translated}${translated.endsWith("\n") ? "" : "\n"}`,
    sourceHash: computeBodySourceHash(jaBody),
  });
}
