import {
  DEFAULT_AI_MODEL,
  UNSUPPORTED_MODEL_ERROR,
  isUnsupportedAiModel,
} from "@/lib/ai-models";

export type ResolvedAiModel =
  | { ok: true; model: string }
  | { ok: false; error: string };

/** x-ai-model ヘッダー > AI_MODEL env > デフォルト */
export function resolveAiModelSlug(req: Request): string {
  const header = req.headers.get("x-ai-model")?.trim();
  if (header) return header;
  const env = process.env.AI_MODEL?.trim();
  if (env) return env;
  return DEFAULT_AI_MODEL;
}

export function resolveAiModel(req: Request): ResolvedAiModel {
  const model = resolveAiModelSlug(req);
  if (isUnsupportedAiModel(model)) {
    return { ok: false, error: UNSUPPORTED_MODEL_ERROR };
  }
  return { ok: true, model };
}
