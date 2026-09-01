/**
 * ペイン1 の中身検索でヒットした語を本文中から探す。
 *
 * 判定規則は検索 API（`/api/content/search`）と揃えて「小文字化して部分一致」。
 * ここがずれると「ツリーにはヒットと出ているのに本文に色が付かない」という
 * 説明のつかない状態が生まれる。正規表現としては解釈しない。
 */

export type SearchHighlightRange = { from: number; to: number };

/** 空白のみ・空文字は一致なし扱い。呼び出し側はこれで有効性を判定する */
export function normalizeSearchHighlightQuery(query: string | undefined): string {
  return query?.trim() ?? "";
}

/**
 * `text` 内の `query` 一致範囲を返す。重なりは生まないよう、一致の直後から探し直す。
 * `query` が空なら空配列。
 */
export function findSearchHighlightRanges(
  text: string,
  query: string,
): SearchHighlightRange[] {
  const needle = normalizeSearchHighlightQuery(query).toLowerCase();
  if (!needle) return [];

  const haystack = text.toLowerCase();
  const ranges: SearchHighlightRange[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    ranges.push({ from: index, to: index + needle.length });
    index = haystack.indexOf(needle, index + needle.length);
  }
  return ranges;
}
