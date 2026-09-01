import { describe, expect, it } from "vitest";
import {
  findSearchHighlightRanges,
  normalizeSearchHighlightQuery,
} from "@/lib/search-highlight-matches";

describe("normalizeSearchHighlightQuery", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeSearchHighlightQuery("  コミット  ")).toBe("コミット");
  });

  it("treats whitespace-only and undefined as empty", () => {
    expect(normalizeSearchHighlightQuery("   ")).toBe("");
    expect(normalizeSearchHighlightQuery(undefined)).toBe("");
  });
});

describe("findSearchHighlightRanges", () => {
  it("finds every occurrence", () => {
    expect(findSearchHighlightRanges("コミットとコミット", "コミット")).toEqual([
      { from: 0, to: 4 },
      { from: 5, to: 9 },
    ]);
  });

  it("ignores case, matching the search API rule", () => {
    // API 側は小文字化して includes する。ここがずれると「ツリーはヒットと
    // 出ているのに本文に色が付かない」という説明のつかない状態になる
    expect(findSearchHighlightRanges("GitHub と github", "github")).toEqual([
      { from: 0, to: 6 },
      { from: 9, to: 15 },
    ]);
  });

  it("does not interpret the query as a regular expression", () => {
    expect(findSearchHighlightRanges("axb a.b", "a.b")).toEqual([
      { from: 4, to: 7 },
    ]);
  });

  it("returns nothing for an empty or whitespace-only query", () => {
    expect(findSearchHighlightRanges("本文", "")).toEqual([]);
    expect(findSearchHighlightRanges("本文", "   ")).toEqual([]);
  });

  it("returns nothing when there is no match", () => {
    expect(findSearchHighlightRanges("本文", "見つからない")).toEqual([]);
  });

  it("does not produce overlapping ranges for repeated characters", () => {
    expect(findSearchHighlightRanges("aaaa", "aa")).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 },
    ]);
  });
});
