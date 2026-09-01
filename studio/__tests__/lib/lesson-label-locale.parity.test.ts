/**
 * プレビューのラベル語彙が公開サイトとずれていないかを検出する。
 *
 * Studio のプレビューは「デザインは公開サイトのレッスンページのラベル行と同一」を
 * 宣言している。語彙が割れると、英語プレビューがサイトと違う英語を出して宣言が嘘になる。
 *
 * ⚠ **このテストが落ちたら、片方だけ直さないこと。** 語彙は日英とも
 * `studio/lib/lesson-label-locale.ts` と `mandala/lib/site-labels.ts` の**両方**が
 * 正本で、変更は同時に入れる。
 *
 * ⚠ import はテストからだけ。アプリの実行時に studio が mandala へ依存しては
 * ならない（mandala の独立性は CI が検証する）。
 *
 * ⚠ 読む先は `mandala/lib/site-labels.ts`（生成物に依存しない語彙モジュール）に
 * 限ること。`site-data.ts` を読むと、それが import する `content/site-data.json`
 * まで studio の型検査プログラムに入り、`@/*` が studio 側を指すため解決に失敗して
 * **`next build` が落ちる**。Next はテスト自身のエラーは捨てるが、テストが
 * 引きずり込んだ `__tests__` の外のファイルのエラーは捨てない。
 * vitest の alias で塞いでも `tsc` には効かない（project-layout の越境要件）。
 */
import { describe, expect, it } from "vitest";
import {
  formatCourseStyle,
  formatLessonStatus,
  formatMinutes,
  type CourseStyle as SiteCourseStyle,
  type LessonStatus as SiteLessonStatus,
} from "../../../mandala/lib/site-labels";
import {
  formatCourseStyleLabel,
  formatLessonStatusLabel,
  formatMinutesLabel,
} from "@/lib/lesson-label-locale";
import { COURSE_STYLES, type CourseStyle } from "@/lib/schema";

const STATUSES: SiteLessonStatus[] = ["open", "in_progress", "done"];
const MINUTES = [1, 5, 10, 15, 30, 45, 90, 180];

describe("ラベル語彙が公開サイトと一致する", () => {
  it("状態（全 status × 日英）", () => {
    for (const status of STATUSES) {
      for (const locale of ["ja", "en"] as const) {
        expect(formatLessonStatusLabel(status, locale)).toBe(
          formatLessonStatus(status, locale),
        );
      }
    }
  });

  it("done はどちらの言語でもラベルを出さない", () => {
    expect(formatLessonStatusLabel("done", "ja")).toBeUndefined();
    expect(formatLessonStatusLabel("done", "en")).toBeUndefined();
  });

  it("所要時間（代表的な分数 × 日英）", () => {
    for (const minutes of MINUTES) {
      for (const locale of ["ja", "en"] as const) {
        expect(formatMinutesLabel(minutes, locale)).toBe(
          formatMinutes(minutes, locale),
        );
      }
    }
  });

  it("受講形態（全 style × 日英）", () => {
    for (const style of COURSE_STYLES as readonly CourseStyle[]) {
      for (const locale of ["ja", "en"] as const) {
        expect(formatCourseStyleLabel(style, locale)).toBe(
          formatCourseStyle(style as SiteCourseStyle, locale),
        );
      }
    }
  });

  it("style 未設定はどちらもラベルを出さない", () => {
    expect(formatCourseStyleLabel(undefined, "ja")).toBeUndefined();
    expect(formatCourseStyleLabel(undefined, "en")).toBeUndefined();
  });

  it("所要時間 0 はラベルを出さない（Studio 側の既存規則）", () => {
    // ⚠ サイトは 0 を呼び出し側で弾くのでここだけは Studio 固有
    expect(formatMinutesLabel(0, "ja")).toBeUndefined();
    expect(formatMinutesLabel(0, "en")).toBeUndefined();
  });
});
