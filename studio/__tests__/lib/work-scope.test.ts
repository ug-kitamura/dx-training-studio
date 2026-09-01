import { describe, expect, it } from "vitest";
import {
  parseWorkScope,
  serializeWorkScope,
  workScopeLevel,
} from "@/lib/work-scope";

describe("workScopeLevel", () => {
  it("最深の非空フィールドから階層を導出する", () => {
    expect(workScopeLevel({ series: "S", course: "C", lesson: "L" })).toBe(
      "lesson",
    );
    expect(workScopeLevel({ series: "S", course: "C" })).toBe("course");
    expect(workScopeLevel({ series: "S" })).toBe("series");
    expect(workScopeLevel({})).toBe("root");
  });
});

describe("serializeWorkScope", () => {
  it("階層をスラッシュで連結する", () => {
    expect(
      serializeWorkScope({ series: "S", course: "C", lesson: "L" }),
    ).toBe("S/C/L");
    expect(serializeWorkScope({ series: "S", course: "C" })).toBe("S/C");
    expect(serializeWorkScope({ series: "S" })).toBe("S");
  });

  it("シリーズ 0 件は空文字になる", () => {
    expect(serializeWorkScope({})).toBe("");
  });

  it("上位が欠けている場合は下位を採用しない", () => {
    expect(serializeWorkScope({ course: "C", lesson: "L" })).toBe("");
    expect(serializeWorkScope({ series: "S", lesson: "L" })).toBe("S");
  });

  it("表示名に / を含むレッスンはディレクトリ名に合わせて sanitize する", () => {
    const key = serializeWorkScope({
      series: "S",
      course: "C",
      lesson: "リポジトリを作る / clone",
    });
    expect(key.split("/")).toHaveLength(3);
  });
});

describe("parseWorkScope", () => {
  it("往復で元に戻る", () => {
    const scope = { series: "S", course: "C", lesson: "L" };
    expect(parseWorkScope(serializeWorkScope(scope))).toEqual(scope);
  });

  it("空文字はシリーズ 0 件として受け付ける", () => {
    expect(parseWorkScope("")).toEqual({});
    expect(parseWorkScope("   ")).toEqual({});
  });

  it("パス脱出を拒否する", () => {
    expect(parseWorkScope("../secret")).toBeNull();
    expect(parseWorkScope("/abs")).toBeNull();
    expect(parseWorkScope("S\\C")).toBeNull();
    expect(parseWorkScope(".meta")).toBeNull();
  });

  it("4 段以上は拒否する", () => {
    expect(parseWorkScope("A/B/C/D")).toBeNull();
  });

  it("空のセグメントを拒否する", () => {
    expect(parseWorkScope("S//L")).toBeNull();
  });
});

