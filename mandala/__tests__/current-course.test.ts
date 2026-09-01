import { describe, expect, it } from "vitest";
import { findCourseIdByPath, findCurrentLocation } from "../lib/current-course";
import type { SiteSeries } from "../lib/site-data";

const series = [
  {
    name: "Git基礎シリーズ",
    slug: "git",
    href: "/git",
    totalMinutes: 70,
    lessonCount: 5,
    courses: [
      {
        name: "Git概念コース",
        id: "crs-concepts",
        slug: "concepts",
        href: "/git/concepts",
        crossSeriesPrev: [],
        crossSeriesNext: [],
        lessons: [],
        totalMinutes: 30,
      },
      {
        // id を持たないコース（ローダー採番前）
        name: "Git基本操作コース",
        slug: "basics",
        href: "/git/basics",
        crossSeriesPrev: [],
        crossSeriesNext: [],
        lessons: [],
        totalMinutes: 40,
      },
    ],
  },
] as unknown as SiteSeries[];

describe("findCourseIdByPath", () => {
  it("コーストップからコース ID を解く", () => {
    expect(findCourseIdByPath(series, "/git/concepts")).toBe("crs-concepts");
  });

  it("レッスンページからも同じコースを解く", () => {
    expect(findCourseIdByPath(series, "/git/concepts/three-areas")).toBe(
      "crs-concepts",
    );
  });

  it("英語ツリーでもロケールを外して解く", () => {
    expect(findCourseIdByPath(series, "/en/git/concepts")).toBe("crs-concepts");
  });

  it("全体トップでは null", () => {
    expect(findCourseIdByPath(series, "/")).toBeNull();
    expect(findCourseIdByPath(series, "/en")).toBeNull();
  });

  it("シリーズトップでは null", () => {
    expect(findCourseIdByPath(series, "/git")).toBeNull();
    expect(findCourseIdByPath(series, "/en/git")).toBeNull();
  });

  it("知らない slug では null", () => {
    expect(findCourseIdByPath(series, "/python/intro")).toBeNull();
    expect(findCourseIdByPath(series, "/git/unknown")).toBeNull();
  });

  it("id を持たないコースでは null", () => {
    expect(findCourseIdByPath(series, "/git/basics")).toBeNull();
  });
});

describe("findCurrentLocation", () => {
  it("コーストップ・レッスンページはコースを返す", () => {
    expect(findCurrentLocation(series, "/git/concepts")).toEqual({
      kind: "course",
      courseId: "crs-concepts",
    });
    expect(findCurrentLocation(series, "/git/concepts/three-areas")).toEqual({
      kind: "course",
      courseId: "crs-concepts",
    });
  });

  it("シリーズトップはシリーズを返す", () => {
    // 折りたたみ中は集約ノードが現在地になるので、ここで拾えないと印が消える
    expect(findCurrentLocation(series, "/git")).toEqual({
      kind: "series",
      seriesSlug: "git",
    });
  });

  it("英語ツリーでも同じように解ける", () => {
    expect(findCurrentLocation(series, "/en/git")).toEqual({
      kind: "series",
      seriesSlug: "git",
    });
    expect(findCurrentLocation(series, "/en/git/concepts")).toEqual({
      kind: "course",
      courseId: "crs-concepts",
    });
  });

  it("全体トップは null（全体を表すノードが無い）", () => {
    expect(findCurrentLocation(series, "/")).toBeNull();
    expect(findCurrentLocation(series, "/en")).toBeNull();
  });

  it("知らない slug では null", () => {
    expect(findCurrentLocation(series, "/python")).toBeNull();
    expect(findCurrentLocation(series, "/git/unknown")).toBeNull();
  });

  it("id を持たないコースでは null（findCourseIdByPath と同じ扱い）", () => {
    expect(findCurrentLocation(series, "/git/basics")).toBeNull();
  });
});
