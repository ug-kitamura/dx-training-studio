const MARKDOWN_OPEN_RE = /(?:^|\n)```(?:markdown|md)\s*\n/gi;
const PLAIN_OPEN_RE = /(?:^|\n)```(?!markdown|md)\s*\n/gi;
const FENCE_LINE_RE = /(?:^|\n)(```[^\n]*)/g;

function collectRegexMatches(re: RegExp, content: string): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    matches.push(match);
  }
  return matches;
}

function isBareFenceLine(line: string): boolean {
  return /^```(?:\s*)$/.test(line);
}

function hasNonEmptyLineBeforeNextFence(
  content: string,
  fromIndex: number,
): boolean {
  const fenceRe = /(?:^|\n)(```[^\n]*)/g;
  fenceRe.lastIndex = fromIndex;
  const next = fenceRe.exec(content);
  if (!next) {
    return false;
  }

  const between = content.slice(fromIndex, next.index);
  return between.split("\n").some((line) => line.trim().length > 0);
}

function extractBodyWithDepth(content: string, bodyStart: number): string | null {
  let depth = 1;
  FENCE_LINE_RE.lastIndex = bodyStart;

  let match: RegExpExecArray | null;
  while ((match = FENCE_LINE_RE.exec(content)) !== null) {
    const line = match[1];
    const lineEnd = match.index + match[0].length;

    if (isBareFenceLine(line)) {
      if (depth > 1) {
        depth -= 1;
      } else if (hasNonEmptyLineBeforeNextFence(content, lineEnd)) {
        depth += 1;
      } else {
        depth -= 1;
      }

      if (depth === 0) {
        const bodyEnd = match.index + (match[0].startsWith("\n") ? 1 : 0);
        return content.slice(bodyStart, bodyEnd);
      }
      continue;
    }

    depth += 1;
  }

  return null;
}

function extractFromOpening(content: string, match: RegExpExecArray): string | null {
  const bodyStart = match.index + match[0].length;
  const body = extractBodyWithDepth(content, bodyStart);
  if (!body?.trim()) {
    return null;
  }
  return body.trim();
}

function pickLongest(candidates: string[]): string | null {
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((longest, current) =>
    current.length >= longest.length ? current : longest,
  );
}

function extractFromOpenings(
  content: string,
  openingRe: RegExp,
): string | null {
  const bodies = collectRegexMatches(openingRe, content)
    .map((match) => extractFromOpening(content, match))
    .filter((body): body is string => body !== null);

  return pickLongest(bodies);
}

export function extractMarkdownBlock(content: string): string {
  const taggedBody = extractFromOpenings(content, MARKDOWN_OPEN_RE);
  if (taggedBody) {
    return taggedBody;
  }

  const plainBody = extractFromOpenings(content, PLAIN_OPEN_RE);
  if (plainBody) {
    return plainBody;
  }

  return content.trim();
}
