const MODEL_LABELS: Record<string, string> = {
  "claude-sonnet-5": "Claude Sonnet 5",
  "claude-opus-5": "Claude Opus 5",
  "claude-fable-5": "Claude Fable 5",
  "claude-haiku-4-5": "Claude Haiku 4.5",
  "gpt-5-nano": "GPT 5 nano",
};

export function resolveModelLabel(model: string): string {
  const trimmed = model.trim();
  return MODEL_LABELS[trimmed] ?? trimmed;
}
