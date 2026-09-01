import { resolveModelLabel } from "@/lib/agent/model-labels";

export const AI_MODEL_SLUGS = [
  "gpt-5-nano",
  "claude-haiku-4-5",
  "claude-sonnet-5",
  "claude-opus-5",
  "claude-fable-5",
] as const;

export type AiModelSlug = (typeof AI_MODEL_SLUGS)[number];

export const DEFAULT_AI_MODEL: AiModelSlug = "claude-sonnet-5";

export const UNSUPPORTED_AI_MODELS = new Set<AiModelSlug>(["gpt-5-nano"]);

export const UNSUPPORTED_MODEL_ERROR = "このモデルは未対応です";

export const AI_MODEL_OPTIONS: ReadonlyArray<{
  slug: AiModelSlug;
  label: string;
}> = AI_MODEL_SLUGS.map((slug) => ({
  slug,
  label: resolveModelLabel(slug),
}));

export function isAiModelSlug(value: unknown): value is AiModelSlug {
  return (
    typeof value === "string" &&
    (AI_MODEL_SLUGS as readonly string[]).includes(value)
  );
}

export function normalizeAiModel(value: unknown): AiModelSlug {
  return isAiModelSlug(value) ? value : DEFAULT_AI_MODEL;
}

export function isUnsupportedAiModel(model: string): boolean {
  return UNSUPPORTED_AI_MODELS.has(model as AiModelSlug);
}
