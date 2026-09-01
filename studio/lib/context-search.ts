/** 社内コンテキスト全文検索用のクエリ正規化・トークン化 */

const SEARCH_QUOTE_PATTERN = /[「」『』""''""]/g;

/** 検索語から引用符を除去する */
export function stripSearchQuotes(text: string): string {
  return text.replace(SEARCH_QUOTE_PATTERN, "").trim();
}

/** 検索キーワード行の末尾説明（— / - 以降）を除いて正規化する */
export function normalizeSearchQuery(raw: string): string {
  const firstLine = raw.split(/\r?\n/)[0] ?? raw;
  const beforeDash =
    firstLine.split(/\s*[—–]\s*|\s+-\s+/)[0] ?? firstLine;
  return stripSearchQuotes(beforeDash);
}

/** 社内コンテキストの title/body/tags 等に対する OR 部分一致 */
export function matchesContextSearchText(
  haystack: string,
  rawQuery: string,
): boolean {
  const tokens = tokenizeSearchQuery(rawQuery);
  if (tokens.length === 0) return true;
  const normalizedHaystack = haystack.toLowerCase();
  return tokens.some((token) =>
    normalizedHaystack.includes(token.toLowerCase()),
  );
}

/** 空白・カンマ区切りでキーワードを分割する（OR 検索用） */
export function tokenizeSearchQuery(raw: string): string[] {
  return normalizeSearchQuery(raw)
    .split(/[\s,、]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !/^[-—–]+$/.test(token));
}
