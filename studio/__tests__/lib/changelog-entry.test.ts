import { describe, expect, it } from "vitest";
import {
  CHANGELOG_INITIAL_TEMPLATE,
  firstEntryDate,
  insertChangelogEntry,
} from "@/lib/changelog-entry";

const EXISTING = `# 変更履歴

教材の主な更新のみを載せています。細かな修正は含みません。

## 2026-08-14

- Git シリーズを公開しました
`;

const ENTRY = `## 2026-08-21

- コンフリクト解消のレッスンを追加しました`;

describe("firstEntryDate", () => {
  it("最初の YYYY-MM-DD を返す", () => {
    expect(firstEntryDate(EXISTING)).toBe("2026-08-14");
  });

  it("無ければ null", () => {
    expect(firstEntryDate("# 変更履歴\n")).toBeNull();
  });
});

describe("insertChangelogEntry", () => {
  it("最初の ## 見出しの前（宣言文の直後）に挿入する", () => {
    const result = insertChangelogEntry(EXISTING, ENTRY);
    const first = result.indexOf("## 2026-08-21");
    const second = result.indexOf("## 2026-08-14");
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    // 既存の行は 1 文字も変わらない（追記のみ）
    expect(result).toContain("- Git シリーズを公開しました");
    expect(result).toContain("教材の主な更新のみを載せています。");
  });

  it("## が無ければ末尾に追記する", () => {
    const result = insertChangelogEntry("# 変更履歴\n\n宣言文。\n", ENTRY);
    expect(result.trimEnd().endsWith("- コンフリクト解消のレッスンを追加しました")).toBe(
      true,
    );
  });

  it("空ならテンプレートから始める", () => {
    const result = insertChangelogEntry("", ENTRY);
    expect(result.startsWith(CHANGELOG_INITIAL_TEMPLATE.split("\n")[0])).toBe(
      true,
    );
    expect(result).toContain("## 2026-08-21");
  });

  it("空のエントリでは何も変えない", () => {
    expect(insertChangelogEntry(EXISTING, "  ")).toBe(EXISTING);
  });
});
