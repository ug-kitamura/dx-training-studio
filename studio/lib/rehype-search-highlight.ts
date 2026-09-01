import type { Element, Parent, Root, Text } from "hast";
import {
  findSearchHighlightRanges,
  normalizeSearchHighlightQuery,
} from "@/lib/search-highlight-matches";

const HIGHLIGHT_CLASS = "lesson-search-highlight";

function markElement(value: string): Element {
  return {
    type: "element",
    tagName: "mark",
    properties: { className: [HIGHLIGHT_CLASS] },
    children: [{ type: "text", value }],
  };
}

/** テキストノード 1 つを「素のテキスト」と `<mark>` の並びに割る */
function splitTextNode(node: Text, query: string): Array<Text | Element> {
  const ranges = findSearchHighlightRanges(node.value, query);
  if (ranges.length === 0) return [node];

  const out: Array<Text | Element> = [];
  let cursor = 0;
  for (const { from, to } of ranges) {
    if (from > cursor) {
      out.push({ type: "text", value: node.value.slice(cursor, from) });
    }
    out.push(markElement(node.value.slice(from, to)));
    cursor = to;
  }
  if (cursor < node.value.length) {
    out.push({ type: "text", value: node.value.slice(cursor) });
  }
  return out;
}

function isOwnMark(node: Element): boolean {
  const className = node.properties?.className;
  return (
    node.tagName === "mark" &&
    Array.isArray(className) &&
    className.includes(HIGHLIGHT_CLASS)
  );
}

function visit(parent: Parent, query: string): void {
  const next: Parent["children"] = [];
  for (const child of parent.children) {
    if (child.type === "text") {
      next.push(...splitTextNode(child, query));
      continue;
    }
    // 自分が作った mark の中へは降りない（多重ラップの防止）
    if (child.type === "element" && !isOwnMark(child)) {
      visit(child, query);
    }
    next.push(child);
  }
  parent.children = next;
}

/**
 * ペイン1 の中身検索の一致箇所を `<mark class="lesson-search-highlight">` で包む。
 *
 * ⚠ プラグイン列の**末尾**（`rehypeSanitize` より後段）に置くこと。前段に置くと
 * 生成した `mark` や class が sanitize に落とされ得る。既存の
 * `rehypeGithubAlerts` / `rehypeHighlight` が後段に置かれているのと同じ理屈。
 */
export function rehypeSearchHighlight(options: { query?: string } = {}) {
  const query = normalizeSearchHighlightQuery(options.query);
  return (tree: Root) => {
    if (!query) return;
    visit(tree, query);
  };
}
