/** ATX 見出しレベル（1–6）。該当なしは null */
export function parseAtxHeading(line: string): number | null {
  const m = line.match(/^(#{1,6})\s+/);
  if (!m) return null;
  return m[1].length;
}

/**
 * 見出し行（0-based）を折ったときに隠す最終行（0-based, inclusive）。
 * 隠す行が無ければ null。
 */
export function findHeadingFoldEndLine(
  lines: string[],
  headingLineIndex: number,
  level: number,
): number | null {
  if (headingLineIndex >= lines.length - 1) return null;
  for (let i = headingLineIndex + 1; i < lines.length; i++) {
    const h = parseAtxHeading(lines[i]);
    if (h !== null && h <= level) return i - 1;
  }
  return lines.length - 1;
}

export type LineFoldRange = {
  /** 非表示にする先頭行（0-based, inclusive） */
  fromLineIndex: number;
  /** 非表示にする末尾行（0-based, inclusive） */
  toLineIndex: number;
};

/**
 * 指定行に折りたたみガターを付けられる場合の非表示行範囲。
 * 折りたたみ対象は ATX 見出しのみ（本文に frontmatter は無い）。
 */
export function getFoldRangeAtLine(
  lines: string[],
  lineIndex: number,
): LineFoldRange | null {
  if (lineIndex < 0 || lineIndex >= lines.length) return null;

  const level = parseAtxHeading(lines[lineIndex]);
  if (level === null) return null;

  const end = findHeadingFoldEndLine(lines, lineIndex, level);
  if (end === null || end < lineIndex + 1) return null;

  return { fromLineIndex: lineIndex + 1, toLineIndex: end };
}
