import { describe, expect, it } from "vitest";
import {
  findHtmlCommentRanges,
  htmlCommentInnerTextAtOffset,
  stripHtmlComments,
} from "@/lib/html-comment-at-cursor";

describe("html-comment-at-cursor", () => {
  const content = `# Title

<!--
Git フロー図
4 ステップ
-->

本文`;

  it("finds comment ranges", () => {
    const ranges = findHtmlCommentRanges(content);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].innerText).toBe("Git フロー図\n4 ステップ");
  });

  it("returns inner text when cursor inside comment", () => {
    const ranges = findHtmlCommentRanges(content);
    const inner = htmlCommentInnerTextAtOffset(content, ranges[0].innerStart + 2);
    expect(inner).toBe("Git フロー図\n4 ステップ");
  });

  it("returns null when cursor outside comment", () => {
    expect(htmlCommentInnerTextAtOffset(content, 0)).toBeNull();
    expect(htmlCommentInnerTextAtOffset(content, content.length - 1)).toBeNull();
  });
});

describe("stripHtmlComments", () => {
  it("removes html comments for preview", () => {
    const body = "Before\n<!-- git branch -->\nAfter";
    expect(stripHtmlComments(body)).toBe("Before\n\nAfter");
  });
});
