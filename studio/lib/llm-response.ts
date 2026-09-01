/**
 * モデル応答の共通後処理。コードフェンス剥がしと許容的 JSON パースの正本。
 * 以前は 3 種類の正規表現が 6 ファイルに散在していた——ここ以外に再実装しない。
 * （ネストしたフェンスを深さ追跡で抜き出す lib/extract-markdown-block.ts は別物）
 */

/**
 * 応答全体を包むコードフェンス（言語タグ任意・単一行フェンス可）を剥がす。
 * フェンスで包まれていなければ trim だけして返す。
 */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[\w-]*[ \t]*\r?\n?([\s\S]*?)\r?\n?```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * フェンスを剥がして JSON オブジェクトとしてパースする。
 * 失敗・非オブジェクト（配列含む）は null。
 */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const candidate = stripCodeFences(text);
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
