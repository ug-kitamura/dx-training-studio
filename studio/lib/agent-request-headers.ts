import type { WorkspaceSettings } from "@/lib/workspace-settings";

// キー未設定文言の正本は lib/api-keys.ts（サーバー 401 と同一文字列での一致判定に使う）
export { AI_KEY_ERROR } from "@/lib/api-keys";

export function aiRequestHeaders(
  settings: WorkspaceSettings,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  headers["x-ai-model"] = settings.aiModel;
  if (settings.aiApiKey) headers["x-ai-api-key"] = settings.aiApiKey;
  if (settings.searchApiKey)
    headers["x-search-api-key"] = settings.searchApiKey;
  return headers;
}
