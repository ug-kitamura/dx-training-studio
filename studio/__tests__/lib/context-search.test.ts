import { describe, expect, it } from "vitest";
import {
  normalizeSearchQuery,
  tokenizeSearchQuery,
  matchesContextSearchText,
} from "@/lib/context-search";

describe("context-search", () => {
  it("strips Japanese quotation marks", () => {
    expect(normalizeSearchQuery("「ブランチ」")).toBe("ブランチ");
  });

  it("strips quotes from keyword with explanation", () => {
    expect(normalizeSearchQuery("「Git」 — 説明")).toBe("Git");
  });

  it("strips explanation after spaced hyphen", () => {
    expect(
      normalizeSearchQuery(
        "Git インストール - このキーワードで社内コンテキストを検索します。",
      ),
    ).toBe("Git インストール");
  });

  it("tokenizes multiple keywords for OR search", () => {
    expect(tokenizeSearchQuery("Git インストール 環境構築")).toEqual([
      "Git",
      "インストール",
      "環境構築",
    ]);
  });

  it("matches haystack with quoted query tokens", () => {
    expect(
      matchesContextSearchText("NMS Git ブランチ運用ルール", "「ブランチ」"),
    ).toBe(true);
  });
});
