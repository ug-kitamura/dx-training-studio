/**
 * コース `.meta.json` の `style` の読み取り規則。
 * 語彙の解釈は Studio の `lib/contents-loader.ts` と揃える（parity テストの対象）。
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadContents } from "../scripts/lib/content-source.mts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

/** シリーズ1・コース1・レッスン1 の最小構成を作り、コースの style を読む */
function loadCourseStyle(courseMeta: Record<string, unknown>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "content-source-style-"));
  roots.push(root);
  const contentsDir = path.join(root, "contents");
  const courseDir = path.join(contentsDir, "S", "C");
  const lessonDir = path.join(courseDir, "L");
  fs.mkdirSync(lessonDir, { recursive: true });
  fs.writeFileSync(
    path.join(lessonDir, "contents.md"),
    `---\nseries: S\ncourse: C\nlesson: L\nslug: l\nstatus: done\ndescription: d\ntags: []\nestimated_minutes: 10\nauthor: a\n---\n\n本文\n`,
    "utf-8",
  );
  fs.writeFileSync(
    path.join(courseDir, ".meta.json"),
    JSON.stringify({ slug: "c", order: ["L"], ...courseMeta }),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(contentsDir, "S", ".meta.json"),
    JSON.stringify({ slug: "s", order: ["C"] }),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(contentsDir, ".meta.json"),
    JSON.stringify({ order: ["S"] }),
    "utf-8",
  );
  return loadContents(contentsDir).series[0]!.courses[0]!.style;
}

describe("コース style の読み取り", () => {
  it("語彙内の値を採用する", () => {
    expect(loadCourseStyle({ style: "self-study" })).toBe("self-study");
    expect(loadCourseStyle({ style: "lecture" })).toBe("lecture");
    expect(loadCourseStyle({ style: "hands-on" })).toBe("hands-on");
  });

  it("キーが無ければ未設定", () => {
    expect(loadCourseStyle({})).toBeUndefined();
  });

  it("語彙外の値は未設定として扱う", () => {
    expect(loadCourseStyle({ style: "seminar" })).toBeUndefined();
  });

  it("文字列以外の値も未設定として扱う", () => {
    expect(loadCourseStyle({ style: 1 })).toBeUndefined();
  });
});
