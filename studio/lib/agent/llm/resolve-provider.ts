import { UNSUPPORTED_MODEL_ERROR } from "@/lib/ai-models";
import { resolveAiModel } from "@/lib/resolve-ai-model";
import type { LlmProvider } from "@/lib/agent/llm/provider";
import { anthropicProvider } from "@/lib/agent/llm/anthropic";

export type ResolvedLlmProvider =
  | { ok: true; provider: LlmProvider; model: string }
  | { ok: false; error: string; status: number };

export function resolveLlmProvider(req: Request): ResolvedLlmProvider {
  const modelResult = resolveAiModel(req);
  if (!modelResult.ok) {
    return { ok: false, error: modelResult.error, status: 400 };
  }

  if (modelResult.model.startsWith("claude-")) {
    return { ok: true, provider: anthropicProvider, model: modelResult.model };
  }

  return { ok: false, error: UNSUPPORTED_MODEL_ERROR, status: 400 };
}
