import { describe, expect, it } from "vitest";
import {
  buildContextFormatMessages,
  parseContextFormatResponse,
} from "@/lib/context-format-prompt";

describe("context-format-prompt", () => {
  it("builds messages with existing tags", () => {
    const { system, user } = buildContextFormatMessages("原文テキスト", [
      "env-setup",
      "環境構築",
    ]);
    expect(system).toContain("創作禁止");
    expect(user).toContain("原文テキスト");
    expect(user).toContain("env-setup");
    expect(user).not.toContain("環境構築");
  });

  it("parses JSON response", () => {
    const parsed = parseContextFormatResponse(
      '{"title":"環境構築手順","body":"# 見出し\\n本文","suggestedTags":["env-setup","git"],"source_last_updated_at":"2025-03-01"}',
    );
    expect(parsed).toEqual({
      title: "環境構築手順",
      body: "# 見出し\n本文",
      suggestedTags: ["env-setup", "git"],
      source_last_updated_at: "2025-03-01",
    });
  });

  it("filters invalid tag characters from suggestedTags", () => {
    const parsed = parseContextFormatResponse(
      '{"title":"手順","body":"本文","suggestedTags":["環境構築","git","Valid-Tag"],"source_last_updated_at":null}',
    );
    expect(parsed?.suggestedTags).toEqual(["git", "valid-tag"]);
  });

  it("parses JSON response without tags", () => {
    const parsed = parseContextFormatResponse(
      '{"title":"環境構築手順","body":"# 見出し\\n本文","suggestedTags":[],"source_last_updated_at":null}',
    );
    expect(parsed).toEqual({
      title: "環境構築手順",
      body: "# 見出し\n本文",
      suggestedTags: [],
      source_last_updated_at: null,
    });
  });

  it("returns null for invalid response", () => {
    expect(parseContextFormatResponse("not-json")).toBeNull();
  });
});
