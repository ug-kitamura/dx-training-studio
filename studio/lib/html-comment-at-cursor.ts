export type HtmlCommentRange = {
  start: number;
  end: number;
  innerStart: number;
  innerEnd: number;
  innerText: string;
};

const HTML_COMMENT_RE = /<!--([\s\S]*?)-->/g;

/** 本文中の HTML コメント範囲を列挙する */
export function findHtmlCommentRanges(content: string): HtmlCommentRange[] {
  const ranges: HtmlCommentRange[] = [];
  for (const match of content.matchAll(HTML_COMMENT_RE)) {
    const full = match[0];
    const inner = match[1] ?? "";
    const index = match.index;
    if (index === undefined) continue;
    ranges.push({
      start: index,
      end: index + full.length,
      innerStart: index + 4,
      innerEnd: index + 4 + inner.length,
      innerText: inner.trim(),
    });
  }
  return ranges;
}

/** カーソル offset が HTML コメント内なら内部テキスト（trim）を返す。外なら null */
export function htmlCommentInnerTextAtOffset(
  content: string,
  offset: number,
): string | null {
  for (const range of findHtmlCommentRanges(content)) {
    if (offset >= range.innerStart && offset <= range.innerEnd) {
      return range.innerText;
    }
    if (offset > range.start && offset < range.end) {
      return range.innerText;
    }
  }
  return null;
}

/** プレビュー表示用: HTML コメント（AI 画像指示）を除去する */
export function stripHtmlComments(content: string): string {
  return content.replace(HTML_COMMENT_RE, "");
}
