import { z } from "zod";
import { AI_KEY_ERROR, resolveAiApiKey } from "@/lib/api-keys";
import { callClaude } from "@/lib/anthropic-messages";
import {
  buildSuggestPromptMessages,
  parseSuggestPromptResponse,
} from "@/lib/ai-image-suggest-prompt";
import { resolveAiModel } from "@/lib/resolve-ai-model";
import { lessonSchema } from "@/lib/schema";

const bodySchema = z.object({
  lesson: lessonSchema,
  /** `lesson.content`（＝編集言語の本文）に対する offset。省略は 0 */
  cursorOffset: z.number().int().min(0).optional(),
  seedPrompt: z.string().optional(),
  /** 返すプロンプトの言語（編集言語）。省略は ja */
  language: z.enum(["ja", "en"]).optional(),
});

export async function POST(req: Request) {
  const apiKey = resolveAiApiKey(req);
  if (!apiKey) {
    return Response.json({ error: AI_KEY_ERROR }, { status: 401 });
  }

  const modelResult = resolveAiModel(req);
  if (!modelResult.ok) {
    return Response.json({ error: modelResult.error }, { status: 400 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json: unknown = await req.json();
    parsed = bodySchema.parse(json);
  } catch {
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const cursorOffset = parsed.cursorOffset ?? 0;
  const { system, user } = buildSuggestPromptMessages(
    parsed.lesson,
    cursorOffset,
    parsed.seedPrompt,
    parsed.language ?? "ja",
  );

  try {
    const raw = await callClaude(apiKey, modelResult.model, system, user);
    const prompt = parseSuggestPromptResponse(raw);
    if (!prompt) {
      return Response.json({ error: "プロンプトを生成できませんでした" }, { status: 502 });
    }
    return Response.json({ prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "プロンプト生成に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
