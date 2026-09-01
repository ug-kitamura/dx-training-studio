export type DiffLineKind =
  | "index"
  | "separator"
  | "file-old"
  | "file-new"
  | "hunk-header"
  | "add"
  | "remove"
  | "context";

export type ParsedDiffLine = {
  index: number;
  text: string;
  kind: DiffLineKind;
  /** HEAD（変更前）側の行番号。該当なしは null */
  oldLineNumber: number | null;
  /** 現在（変更後）側の行番号。該当なしは null */
  newLineNumber: number | null;
};

export function classifyDiffLine(text: string): DiffLineKind {
  if (text.startsWith("@@")) return "hunk-header";
  if (text.startsWith("+++")) return "file-new";
  if (text.startsWith("---")) return "file-old";
  if (text.startsWith("Index:")) return "index";
  if (text.startsWith("====")) return "separator";
  if (text.startsWith("+")) return "add";
  if (text.startsWith("-")) return "remove";
  return "context";
}

export function parseHunkHeader(
  text: string,
): { oldStart: number; newStart: number } | null {
  const match = text.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (!match) return null;
  return { oldStart: Number(match[1]), newStart: Number(match[2]) };
}

/** @@ ハンク内の add / remove / context のみ表示対象（diff --git 等の preamble は除外） */
export function isDiffDisplayLine(line: ParsedDiffLine): boolean {
  if (line.kind !== "add" && line.kind !== "remove" && line.kind !== "context") {
    return false;
  }
  return line.oldLineNumber !== null || line.newLineNumber !== null;
}

export function getDiffLineMarker(kind: DiffLineKind): string {
  switch (kind) {
    case "add":
      return "+";
    case "remove":
      return "-";
    default:
      return "";
  }
}

/** unified diff 行頭の + / - / スペースを除いた本文 */
export function getDiffLineContent(text: string, kind: DiffLineKind): string {
  if (kind === "add" || kind === "remove" || kind === "context") {
    return text.slice(1);
  }
  return text;
}

export function parseUnifiedDiff(diff: string): ParsedDiffLine[] {
  if (!diff) return [];

  const result: ParsedDiffLine[] = [];
  let oldLine: number | null = null;
  let newLine: number | null = null;

  for (const [index, text] of diff.split("\n").entries()) {
    const kind = classifyDiffLine(text);

    if (kind === "hunk-header") {
      const header = parseHunkHeader(text);
      oldLine = header?.oldStart ?? null;
      newLine = header?.newStart ?? null;
      result.push({
        index,
        text,
        kind,
        oldLineNumber: null,
        newLineNumber: null,
      });
      continue;
    }

    if (oldLine === null || newLine === null) {
      result.push({
        index,
        text,
        kind,
        oldLineNumber: null,
        newLineNumber: null,
      });
      continue;
    }

    if (kind === "remove") {
      result.push({
        index,
        text,
        kind,
        oldLineNumber: oldLine,
        newLineNumber: null,
      });
      oldLine += 1;
      continue;
    }

    if (kind === "add") {
      result.push({
        index,
        text,
        kind,
        oldLineNumber: null,
        newLineNumber: newLine,
      });
      newLine += 1;
      continue;
    }

    result.push({
      index,
      text,
      kind,
      oldLineNumber: oldLine,
      newLineNumber: newLine,
    });
    oldLine += 1;
    newLine += 1;
  }

  return result;
}

function formatLineNumber(value: number | null): string {
  return value === null ? "" : String(value);
}

export { formatLineNumber };
