/**
 * 表示名の言語解決（studio-translation spec）。
 * 規則は「en なら name_en（trim 後非空）→ 無ければ日本語名」。
 * 公開サイトの `name_en ?? name` と同じフォールバックであることが要。
 */
import { describe, expect, it } from "vitest";
import {
  courseDisplayName,
  lessonDisplayName,
  resolveDisplayName,
  seriesDisplayName,
  workspaceDisplayName,
} from "@/lib/display-name";

describe("resolveDisplayName", () => {
  it("日本語モードでは name_en があっても日本語名", () => {
    expect(resolveDisplayName("Git基礎", "Git Basics", "ja")).toBe("Git基礎");
  });

  it("英語モードでは name_en を使う", () => {
    expect(resolveDisplayName("Git基礎", "Git Basics", "en")).toBe("Git Basics");
  });

  it("英語モードで name_en が無ければ日本語名へフォールバックする", () => {
    expect(resolveDisplayName("Git基礎", undefined, "en")).toBe("Git基礎");
  });

  it("空文字・空白だけの name_en はフォールバックする", () => {
    // ⚠ 名前が空欄になるとツリーと曼陀羅のナビが死ぬ
    expect(resolveDisplayName("Git基礎", "", "en")).toBe("Git基礎");
    expect(resolveDisplayName("Git基礎", "   ", "en")).toBe("Git基礎");
  });

  it("name_en の前後空白は落とす", () => {
    expect(resolveDisplayName("Git基礎", "  Git Basics  ", "en")).toBe(
      "Git Basics",
    );
  });
});

describe("階層ごとのヘルパー", () => {
  it("シリーズ", () => {
    expect(seriesDisplayName({ name: "はじめに", name_en: "Getting Started" }, "en")).toBe(
      "Getting Started",
    );
    expect(seriesDisplayName({ name: "はじめに", name_en: undefined }, "en")).toBe(
      "はじめに",
    );
  });

  it("コース", () => {
    expect(courseDisplayName({ name: "DX入門", name_en: "DX Intro" }, "en")).toBe(
      "DX Intro",
    );
  });

  it("レッスンは lesson フィールドが日本語名", () => {
    expect(
      lessonDisplayName({ lesson: "最初のコミット", name_en: "First commit" }, "en"),
    ).toBe("First commit");
    expect(lessonDisplayName({ lesson: "最初のコミット" }, "en")).toBe(
      "最初のコミット",
    );
  });
});

describe("workspaceDisplayName", () => {
  it("name_en → name → ワークスペース名の順", () => {
    expect(
      workspaceDisplayName({ name: "DX研修", name_en: "DX Training" }, "WS", "en"),
    ).toBe("DX Training");
    expect(workspaceDisplayName({ name: "DX研修" }, "WS", "en")).toBe("DX研修");
    expect(workspaceDisplayName({}, "WS", "en")).toBe("WS");
  });

  it("日本語モードは name → ワークスペース名", () => {
    expect(
      workspaceDisplayName({ name: "DX研修", name_en: "DX Training" }, "WS", "ja"),
    ).toBe("DX研修");
    expect(workspaceDisplayName({ name: "  " }, "WS", "ja")).toBe("WS");
  });
});
