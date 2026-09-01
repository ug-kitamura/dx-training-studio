import { describe, expect, it } from "vitest";
import {
  getDiffLineContent,
  getDiffLineMarker,
  isDiffDisplayLine,
  parseHunkHeader,
  parseUnifiedDiff,
} from "@/lib/unified-diff-hunks";

const SAMPLE = [
  "--- a/file.md",
  "+++ b/file.md",
  "@@ -1,2 +1,3 @@",
  " context",
  "-removed",
  "+added",
  "@@ -5,1 +6,1 @@",
  " second",
].join("\n");

describe("parseHunkHeader", () => {
  it("parses old and new start lines", () => {
    expect(parseHunkHeader("@@ -1,2 +1,3 @@")).toEqual({
      oldStart: 1,
      newStart: 1,
    });
  });
});

describe("parseUnifiedDiff", () => {
  it("leaves preamble without line numbers", () => {
    const lines = parseUnifiedDiff(SAMPLE);
    expect(lines[0]?.oldLineNumber).toBeNull();
    expect(lines[0]?.newLineNumber).toBeNull();
  });

  it("assigns dual line numbers inside hunks", () => {
    const lines = parseUnifiedDiff(SAMPLE);
    expect(lines[3]).toMatchObject({
      kind: "context",
      oldLineNumber: 1,
      newLineNumber: 1,
    });
    expect(lines[4]).toMatchObject({
      kind: "remove",
      oldLineNumber: 2,
      newLineNumber: null,
    });
    expect(lines[5]).toMatchObject({
      kind: "add",
      oldLineNumber: null,
      newLineNumber: 2,
    });
  });

  it("resets counters at each hunk header", () => {
    const lines = parseUnifiedDiff(SAMPLE);
    expect(lines[7]).toMatchObject({
      kind: "context",
      oldLineNumber: 5,
      newLineNumber: 6,
    });
  });

  it("filters display lines to hunk content only", () => {
    const lines = parseUnifiedDiff(SAMPLE).filter((line) =>
      isDiffDisplayLine(line),
    );
    expect(lines.map((line) => line.kind)).toEqual([
      "context",
      "remove",
      "add",
      "context",
    ]);
  });

  it("excludes diff --git preamble with quotepath escapes", () => {
    const diff = [
      'diff --git "a/contents/\\343\\201\\257.md" "b/contents/\\343\\201\\257.md"',
      "index 1234567..89abcde 100644",
      "--- a/contents/\\343\\201\\257.md",
      "+++ b/contents/\\343\\201\\257.md",
      "@@ -1,2 +1,3 @@",
      " series: はじめにシリーズ",
      "-author: old",
      "+author: 新しい作者",
    ].join("\n");
    const displayed = parseUnifiedDiff(diff).filter((line) =>
      isDiffDisplayLine(line),
    );
    expect(displayed.map((line) => getDiffLineContent(line.text, line.kind))).toEqual([
      "series: はじめにシリーズ",
      "author: old",
      "author: 新しい作者",
    ]);
  });

  it("extracts marker and content from diff lines", () => {
    expect(getDiffLineMarker("add")).toBe("+");
    expect(getDiffLineMarker("remove")).toBe("-");
    expect(getDiffLineMarker("context")).toBe("");
    expect(getDiffLineContent(" context", "context")).toBe("context");
    expect(getDiffLineContent("-removed", "remove")).toBe("removed");
    expect(getDiffLineContent("+added", "add")).toBe("added");
  });
});
