/** ファイルシステム禁止文字を `_` に置換してフォルダ/ファイル名として安全な文字列にする */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim();
}
