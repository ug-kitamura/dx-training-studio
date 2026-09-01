import { z } from "zod";
import { AI_KEY_ERROR, resolveAiApiKey } from "@/lib/api-keys";
import { callClaude } from "@/lib/anthropic-messages";
import {
  buildContextFormatMessages,
  parseContextFormatResponse,
} from "@/lib/context-format-prompt";
import { resolveAiModel } from "@/lib/resolve-ai-model";

const bodySchema = z.object({
  rawText: z.string().trim().min(1),
  existingTags: z.array(z.string().trim().min(1)).optional(),
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

  const { system, user } = buildContextFormatMessages(
    parsed.rawText,
    parsed.existingTags ?? [],
  );

  try {
    const raw = await callClaude(apiKey, modelResult.model, system, user, {
      maxTokens: 4096,
    });
    const formatted = parseContextFormatResponse(raw);
    if (!formatted) {
      return Response.json({ error: "整形結果を解析できませんでした" }, { status: 502 });
    }
    return Response.json(formatted);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 整形に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
