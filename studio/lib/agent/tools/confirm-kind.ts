/**
 * サーバ（confirm-gate.ts）とクライアント（stream-client.ts）が共有する
 * confirm_required の kind 一覧。fs 等サーバ専用の依存を持たず、
 * "use client" ファイルから安全に import できる。
 */
export const CONFIRM_KINDS = [
  "overwrite",
  "create-content-folder",
  "run-script",
  "run-skill-script",
  "generate-write",
  "isolated-task",
  "inline-assets",
  "web-search",
  "web-search-manual",
] as const;

export type ConfirmKind = (typeof CONFIRM_KINDS)[number];

export function isConfirmKind(value: unknown): value is ConfirmKind {
  return (
    typeof value === "string" &&
    (CONFIRM_KINDS as readonly string[]).includes(value)
  );
}
