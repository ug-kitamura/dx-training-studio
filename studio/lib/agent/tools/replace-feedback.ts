/**
 * replace_in_file / replace_between 向けの不一致ヒントと残留ワーニング。
 * テンプレ方言は解釈せず、狭いヒューリスティックのみ。
 */

const WHITESPACE_RE = /\s+/g;
const FILL_TOKEN_RE = /\{\{[A-Za-z_][A-Za-z0-9_]*\}\}/g;
const SPAN_MARKER_RE = /\{\{[A-Za-z_][A-Za-z0-9_]*(?:_START|_END)\}\}/;
const NEAR_MISS_LIMIT = 3;
const SNIPPET_MAX = 80;

export function collapseWhitespace(text: string): string {
  return text.replace(WHITESPACE_RE, " ").trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 厳密一致しない needle について、空白類の差だけで一致する断片を最大数件返す。
 * 自動置換には使わない（ヒント専用）。
 */
export function findWhitespaceOnlyNearMisses(
  haystack: string,
  needle: string,
  limit: number = NEAR_MISS_LIMIT,
): string[] {
  if (!needle || haystack.includes(needle)) return [];

  const collapsed = collapseWhitespace(needle);
  if (!collapsed) return [];

  const parts = collapsed.split(" ").filter(Boolean).map(escapeRegExp);
  if (parts.length === 0) return [];

  const pattern = new RegExp(parts.join("\\s+"), "g");
  const hits: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(haystack)) !== null && hits.length < limit) {
    const snippet = match[0];
    if (snippet !== needle) {
      hits.push(
        snippet.length > SNIPPET_MAX
          ? `${snippet.slice(0, SNIPPET_MAX)}…`
          : snippet,
      );
    }
    if (match[0].length === 0) pattern.lastIndex += 1;
  }
  return hits;
}

export function formatNotFoundError(
  label: string,
  needle: string,
  haystack: string,
): string {
  const preview = needle.slice(0, 80);
  const base = `${label}: ${preview}`;
  const near = findWhitespaceOnlyNearMisses(haystack, needle);
  if (near.length === 0) return base;
  const listed = near.map((s) => JSON.stringify(s)).join(", ");
  return `${base}\n近い候補（空白差のみ）: ${listed}`;
}

/**
 * 埋める印らしい残留。区間端トークン（*_START / *_END）と HTML コメントは対象外。
 */
export function findResidualFillTokens(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(FILL_TOKEN_RE)) {
    const token = match[0];
    if (SPAN_MARKER_RE.test(token)) continue;
    found.add(token);
  }
  return [...found].sort();
}

export function residualFillWarningMessage(tokens: string[]): string | null {
  if (tokens.length === 0) return null;
  const shown = tokens.slice(0, 8).join(", ");
  const more = tokens.length > 8 ? ` ほか ${tokens.length - 8} 件` : "";
  return `埋める印が残っています: ${shown}${more}`;
}

const MARKER_SECTION_RE =
  /<!--\s*([A-Z][A-Z0-9_]*)_START\s*-->([\s\S]*?)<!--\s*\1_END\s*-->/g;

const MARKER_NAME_RE = /^[A-Z][A-Z0-9_]*$/;
const MARKER_COMMENT_RE = /^<!--\s*([A-Za-z0-9_]+)\s*-->$/;

/**
 * 差し込み先の区間指定を素名へ正規化する。
 * 素名（`AGENDA_DETAILS`）・端トークン（`AGENDA_DETAILS_START`）・
 * 完全形（`<!-- AGENDA_DETAILS_START -->`）のいずれも受ける。
 * `replace_in_file` の `replacements` が `{{}}` 有無の双方を受けるのと同じ作法。
 */
export function normalizeMarkerName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const comment = MARKER_COMMENT_RE.exec(trimmed);
  const inner = (comment ? comment[1] : trimmed).trim();
  const name = inner.replace(/_(?:START|END)$/, "");
  return MARKER_NAME_RE.test(name) ? name : null;
}

/**
 * `<!-- NAME_START -->`〜`<!-- NAME_END -->` の間だけを差し替える
 * （マーカー自体は残す）。区間が見つからない場合は null。
 * `name` は `normalizeMarkerName` を通した素名であること。
 */
export function spliceMarkerSection(
  content: string,
  name: string,
  body: string,
): string | null {
  if (!MARKER_NAME_RE.test(name)) return null;
  const re = new RegExp(
    `(<!--\\s*${name}_START\\s*-->)([\\s\\S]*?)(<!--\\s*${name}_END\\s*-->)`,
  );
  if (!re.test(content)) return null;
  return content.replace(
    re,
    (_all, start: string, _body: string, end: string) =>
      [start, body, end].join("\n"),
  );
}

/**
 * `<!-- XXX_START -->`〜`<!-- XXX_END -->` の区間名を、中身の充填状態に
 * 関わらずすべて返す。額縁テンプレートかどうかの判定に使う。
 */
export function findMarkerSectionNames(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(MARKER_SECTION_RE)) {
    found.add(match[1]);
  }
  return [...found].sort();
}

/**
 * `<!-- XXX_START -->`〜`<!-- XXX_END -->` の区間で中身が空（空白のみ）の
 * マーカー名を返す。テンプレート規約準拠のファイルで「未充填の区間」を
 * 決定的に検出する。
 */
export function findEmptyMarkerSections(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(MARKER_SECTION_RE)) {
    if (!match[2].trim()) {
      found.add(match[1]);
    }
  }
  return [...found].sort();
}

export type TemplateResidualScan = {
  /** 未置換の {{XXX}} トークン（*_START / *_END を除く） */
  fillTokens: string[];
  /** 中身が空の <!-- XXX_START/END --> 区間名 */
  emptySections: string[];
};

/** 規約準拠テンプレートの残作業スキャン（完了ゲートの決定的シグナル）。 */
export function scanTemplateResiduals(content: string): TemplateResidualScan {
  return {
    fillTokens: findResidualFillTokens(content),
    emptySections: findEmptyMarkerSections(content),
  };
}

export function templateResidualCount(scan: TemplateResidualScan): number {
  return scan.fillTokens.length + scan.emptySections.length;
}

export function templateResidualMessage(
  scan: TemplateResidualScan,
): string | null {
  const parts: string[] = [];
  const tokenWarning = residualFillWarningMessage(scan.fillTokens);
  if (tokenWarning) parts.push(tokenWarning);
  if (scan.emptySections.length > 0) {
    const shown = scan.emptySections.slice(0, 8).join(", ");
    const more =
      scan.emptySections.length > 8
        ? ` ほか ${scan.emptySections.length - 8} 件`
        : "";
    parts.push(`未充填のマーカー区間があります: ${shown}${more}`);
  }
  return parts.length > 0 ? parts.join(" / ") : null;
}
