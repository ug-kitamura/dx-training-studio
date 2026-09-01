/**
 * サイドバー最上部の更新日時行。
 * - 日付は Asia/Tokyo で整形（UTC のビルドマシンで前日にならないこと）
 * - タグ由来ビルドは番号を併記、それ以外は日時のみ
 * - 時・分は出さない（日付のみ。git 経路と changelog フォールバックで表示が揃う）
 * - 何も無ければ行を出さない
 */
import { describe, expect, it } from "vitest";
import {
  buildVersionLine,
  formatUpdateDate,
  resolveReleaseInfo,
} from "../lib/release-info";

describe("formatUpdateDate", () => {
  it("UTC の日時を Asia/Tokyo に換算する", () => {
    // UTC 21日 03:34 = JST 21日 12:34。実行環境の TZ に依存しないこと
    expect(formatUpdateDate("2026-08-21T03:34:00Z")).toBe("2026.08.21");
  });

  it("日付が変わる時間帯でも前日にならない", () => {
    // ⚠ 時刻を出さなくても TZ 処理は必要——UTC のままだと日付が 1 日ズレる。
    // UTC 20日 23:00 = JST 21日 08:00
    expect(formatUpdateDate("2026-08-20T23:00:00Z")).toBe("2026.08.21");
    // UTC 21日 15:30 = JST 22日 00:30（逆向きの境界）
    expect(formatUpdateDate("2026-08-21T15:30:00Z")).toBe("2026.08.22");
  });

  it("git の %cI（+09:00 オフセット付き）をそのまま扱える", () => {
    expect(formatUpdateDate("2026-08-21T12:34:56+09:00")).toBe("2026.08.21");
  });

  it("日付だけの値（changelog フォールバック）も同じ形になる", () => {
    // git 経路と表示が完全に一致する（フォールバックの継ぎ目が見えない）
    expect(formatUpdateDate("2026-08-21")).toBe(
      formatUpdateDate("2026-08-21T03:34:00Z"),
    );
  });

  it("解釈できない値・空は undefined", () => {
    expect(formatUpdateDate("")).toBeUndefined();
    expect(formatUpdateDate("   ")).toBeUndefined();
    expect(formatUpdateDate("not-a-date")).toBeUndefined();
  });
});

describe("buildVersionLine", () => {
  it("日時のみ（Vercel・ローカル・CI）", () => {
    expect(buildVersionLine("2026-08-21T03:34:00Z", undefined)).toBe(
      "2026.08.21 更新",
    );
  });

  it("タグ由来ビルドは番号を併記する（Pages）", () => {
    expect(buildVersionLine("2026-08-21T03:34:00Z", "v1.2.3")).toBe(
      "2026.08.21 更新 (v1.2.3)",
    );
  });

  it("空白だけのタグは併記しない（ワークフローが env を空で渡す場合）", () => {
    expect(buildVersionLine("2026-08-21T03:34:00Z", "   ")).toBe(
      "2026.08.21 更新",
    );
  });

  it("changelog フォールバック（日付のみ）でも成立する", () => {
    expect(buildVersionLine("2026-08-21", "v1.2.3")).toBe(
      "2026.08.21 更新 (v1.2.3)",
    );
  });

  it("日時が無ければタグ名があっても行を出さない（偽の日時をでっち上げない）", () => {
    expect(buildVersionLine(undefined, "v1.2.3")).toBeUndefined();
    expect(buildVersionLine("", "v1.2.3")).toBeUndefined();
  });

  it("日時もタグも無ければ行を出さない", () => {
    expect(buildVersionLine(undefined, undefined)).toBeUndefined();
    expect(buildVersionLine("", "  ")).toBeUndefined();
  });

  it("英語ページは Updated on 表記になる", () => {
    expect(buildVersionLine("2026-08-21T03:34:00Z", undefined, "en")).toBe(
      "Updated on 2026.08.21",
    );
  });

  it("英語でもタグ番号の併記は同じ形式", () => {
    expect(buildVersionLine("2026-08-21T03:34:00Z", "v1.2.3", "en")).toBe(
      "Updated on 2026.08.21 (v1.2.3)",
    );
  });

  it("日付の値と整形は日英で同一（語の並びだけが違う）", () => {
    // ⚠ TZ 換算・区切りを言語で分岐させていないことの担保
    const ja = buildVersionLine("2026-08-20T23:00:00Z", undefined, "ja");
    const en = buildVersionLine("2026-08-20T23:00:00Z", undefined, "en");
    expect(ja).toBe("2026.08.21 更新");
    expect(en).toBe("Updated on 2026.08.21");
  });

  it("英語でも日時が無ければ行を出さない", () => {
    expect(buildVersionLine(undefined, "v1.2.3", "en")).toBeUndefined();
    expect(buildVersionLine("", undefined, "en")).toBeUndefined();
  });

  it("locale 省略時は日本語表記", () => {
    expect(buildVersionLine("2026-08-21", undefined)).toBe("2026.08.21 更新");
  });
});

describe("resolveReleaseInfo", () => {
  it("日英の line と release とリポジトリ URL を返す", () => {
    const info = resolveReleaseInfo("v0.1.0", "2026-08-21T03:34:00Z");
    expect(info.lineJa).toBe("2026.08.21 更新 (v0.1.0)");
    expect(info.lineEn).toBe("Updated on 2026.08.21 (v0.1.0)");
    expect(info.release).toBe("v0.1.0");
    expect(info.repositoryUrl).toMatch(/^https:\/\//);
  });

  it("タグ無しでは日時だけの行になる", () => {
    const info = resolveReleaseInfo(undefined, "2026-08-21T03:34:00Z");
    expect(info.lineJa).toBe("2026.08.21 更新");
    expect(info.lineEn).toBe("Updated on 2026.08.21");
    expect(info.release).toBeUndefined();
  });

  it("何も無ければ日英とも line を持たない", () => {
    // ⚠ 片方の言語だけ行が出る状態を作らない（spec: publishing-site-deployment）
    const info = resolveReleaseInfo("", "");
    expect(info.lineJa).toBeUndefined();
    expect(info.lineEn).toBeUndefined();
  });
});
