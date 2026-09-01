/**
 * キー未設定エラーの唯一の文言。サーバー（401 応答）とクライアント（一致判定）が
 * 同じ定数を共有する——文言を重複定義すると比較が壊れる（company-context-dialog spec）。
 */
export const AI_KEY_ERROR =
  "AI API キーが未設定です。設定ダイアログから入力するか、`.env.local` に AI_API_KEY を設定してください。";

export function resolveAiApiKey(req: Request): string | null {
  const header = req.headers.get("x-ai-api-key")?.trim();
  if (header) return header;
  const env = process.env.AI_API_KEY?.trim();
  return env || null;
}

export function resolvePixabayApiKey(req: Request): string | null {
  const header = req.headers.get("x-pixabay-api-key")?.trim();
  if (header) return header;
  const env = process.env.PIXABAY_API_KEY?.trim();
  return env || null;
}

export function isAiApiKeyConfiguredOnServer(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

export function isPixabayApiKeyConfiguredOnServer(): boolean {
  return Boolean(process.env.PIXABAY_API_KEY?.trim());
}
