import { describe, expect, it } from "vitest";
import {
  findEmptyMarkerSections,
  findResidualFillTokens,
  scanTemplateResiduals,
  templateResidualCount,
  templateResidualMessage,
} from "@/lib/agent/tools/replace-feedback";

describe("findEmptyMarkerSections", () => {
  it("detects empty START/END sections", () => {
    const html = [
      "<!-- AGENDA_ITEMS_START -->",
      "  ",
      "<!-- AGENDA_ITEMS_END -->",
      "<!-- ACTION_ROWS_START --><tr><td>done</td></tr><!-- ACTION_ROWS_END -->",
    ].join("\n");
    expect(findEmptyMarkerSections(html)).toEqual(["AGENDA_ITEMS"]);
  });

  it("returns empty for content without markers", () => {
    expect(findEmptyMarkerSections("<p>plain html</p>")).toEqual([]);
  });

  it("handles multiple empty sections sorted by name", () => {
    const html = [
      "<!-- ZULU_START --><!-- ZULU_END -->",
      "<!-- ALPHA_START -->\n<!-- ALPHA_END -->",
    ].join("\n");
    expect(findEmptyMarkerSections(html)).toEqual(["ALPHA", "ZULU"]);
  });
});

describe("scanTemplateResiduals", () => {
  it("combines fill tokens and empty sections", () => {
    const html = [
      "<title>{{MEETING_TITLE}}</title>",
      "<!-- AGENDA_ITEMS_START -->",
      "<!-- AGENDA_ITEMS_END -->",
    ].join("\n");
    const scan = scanTemplateResiduals(html);
    expect(scan.fillTokens).toEqual(["{{MEETING_TITLE}}"]);
    expect(scan.emptySections).toEqual(["AGENDA_ITEMS"]);
    expect(templateResidualCount(scan)).toBe(2);
    const message = templateResidualMessage(scan);
    expect(message).toContain("{{MEETING_TITLE}}");
    expect(message).toContain("AGENDA_ITEMS");
  });

  it("reports zero residuals for a completed template", () => {
    const html = [
      "<title>3月定例</title>",
      "<!-- AGENDA_ITEMS_START --><li>議題</li><!-- AGENDA_ITEMS_END -->",
    ].join("\n");
    const scan = scanTemplateResiduals(html);
    expect(templateResidualCount(scan)).toBe(0);
    expect(templateResidualMessage(scan)).toBeNull();
  });

  it("keeps span-marker exclusion of findResidualFillTokens", () => {
    expect(
      findResidualFillTokens("{{TITLE}} {{BLOCK_START}} {{BLOCK_END}}"),
    ).toEqual(["{{TITLE}}"]);
  });
});
