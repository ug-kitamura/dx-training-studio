/**
 * コース `.meta.json` の `is_start` / `is_goal` の読み取りと、
 * 曼陀羅グラフのノードへの受け渡し。
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadContents } from "../scripts/lib/content-source.mts";
import { buildSiteData } from "../scripts/lib/site-model.mts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

/** シリーズ1・コース1・レッスン1 の最小構成を作って読む */
function loadCourse(courseMeta: Record<string, unknown>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "content-source-sg-"));
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
    JSON.stringify({ slug: "c", id: "crs-x", order: ["L"], ...courseMeta }),
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
  return loadContents(contentsDir);
}

describe("Start / Goal 宣言の読み取り", () => {
  it("宣言を読み取る", () => {
    const course = loadCourse({ is_start: true, is_goal: true }).series[0]!
      .courses[0]!;
    expect(course.isStart).toBe(true);
    expect(course.isGoal).toBe(true);
  });

  it("キーが無ければ未宣言（変換はエラーにならない）", () => {
    const course = loadCourse({}).series[0]!.courses[0]!;
    expect(course.isStart).toBeUndefined();
    expect(course.isGoal).toBeUndefined();
  });

  it("boolean 以外は未宣言として扱う", () => {
    const course = loadCourse({ is_start: "yes", is_goal: 1 }).series[0]!
      .courses[0]!;
    expect(course.isStart).toBeUndefined();
    expect(course.isGoal).toBeUndefined();
  });

  it("曼陀羅グラフのノードへ運ばれる", () => {
    const data = buildSiteData(loadCourse({ is_start: true }));
    const node = data.mandala.nodes.find((n) => n.id === "crs-x");
    expect(node?.isStart).toBe(true);
    expect(node?.isGoal).toBeUndefined();
  });
});
