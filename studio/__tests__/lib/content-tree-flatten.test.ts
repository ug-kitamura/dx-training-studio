import { describe, expect, it } from "vitest";
import {
  buildVisibleContentRows,
  filterSeriesByContentMatches,
  filterSeriesByName,
  getRowParentKey,
  HOME_ROW_ID,
  resolveCollapseAllTargets,
  resolveFocusFallbackRowId,
  resolveHomeEndNavigation,
  resolveLeftNavigation,
  selectionRowId,
  seriesRowId,
  courseRowId,
  lessonRowId,
  type ContentTreeRow,
} from "@/lib/content-tree-flatten";
import type { Course, Lesson, Series } from "@/lib/schema";

function lesson(id: string, name = id): Lesson {
  return {
    id,
    series: "s",
    course: "c",
    lesson: name,
    status: "open",
    description: "",
    tags: [],
    estimated_minutes: 0,
    author: "",
    content: "",
  };
}

function course(id: string, lessons: Lesson[] = [], name = id): Course {
  return {
    id,
    name,
    target: "",
    cross_series_prev: [],
    cross_series_next: [],
    lessons,
  };
}

function makeSeries(id: string, courses: Course[], name = id): Series {
  return { id, name, courses };
}

const sample: Series[] = [
  makeSeries("s1", [
    course("c1", [lesson("l1"), lesson("l2")]),
    course("c2", [lesson("l3")]),
  ]),
  makeSeries("s2", [course("c3", [])]),
];

const noCollapse = new Set<string>();

describe("buildVisibleContentRows", () => {
  it("ホーム行を先頭に、開いている階層を深さ順で並べる", () => {
    const rows = buildVisibleContentRows(sample, noCollapse, noCollapse);
    expect(rows.map((r) => r.id)).toEqual([
      HOME_ROW_ID,
      seriesRowId("s1"),
      courseRowId("c1"),
      lessonRowId("l1"),
      lessonRowId("l2"),
      courseRowId("c2"),
      lessonRowId("l3"),
      seriesRowId("s2"),
      courseRowId("c3"),
    ]);
  });

  it("畳んだシリーズ・コースの配下は出さない", () => {
    const rows = buildVisibleContentRows(
      sample,
      new Set(["s2"]),
      new Set(["c1"]),
    );
    expect(rows.map((r) => r.id)).toEqual([
      HOME_ROW_ID,
      seriesRowId("s1"),
      courseRowId("c1"),
      courseRowId("c2"),
      lessonRowId("l3"),
      seriesRowId("s2"),
    ]);
  });
});

describe("resolveFocusFallbackRowId", () => {
  const allRows = buildVisibleContentRows(sample, noCollapse, noCollapse);

  it("カーソル行が可視のままなら付け替えない", () => {
    expect(
      resolveFocusFallbackRowId(allRows, allRows, lessonRowId("l1")),
    ).toBeNull();
  });

  it("祖先の折りたたみで消えたら祖先へ付け替える", () => {
    // c1 を畳むと配下の l1 / l2 が消える
    const next = buildVisibleContentRows(sample, noCollapse, new Set(["c1"]));
    expect(resolveFocusFallbackRowId(allRows, next, lessonRowId("l1"))).toBe(
      courseRowId("c1"),
    );
  });

  it("祖先がまとめて消えたら近い祖先を優先する", () => {
    // s1 を畳むと c1 も l1 も消える。より近い c1 は不可視なので s1 へ
    const next = buildVisibleContentRows(sample, new Set(["s1"]), noCollapse);
    expect(resolveFocusFallbackRowId(allRows, next, lessonRowId("l1"))).toBe(
      seriesRowId("s1"),
    );
  });

  it("削除で消えたら親の行へ付け替える", () => {
    const deleted: Series[] = [
      makeSeries("s1", [course("c1", [lesson("l2")]), course("c2", [lesson("l3")])]),
      makeSeries("s2", [course("c3", [])]),
    ];
    const next = buildVisibleContentRows(deleted, noCollapse, noCollapse);
    expect(resolveFocusFallbackRowId(allRows, next, lessonRowId("l1"))).toBe(
      courseRowId("c1"),
    );
  });

  it("絞り込みで祖先ごと消えたら直前の可視行へ付け替える", () => {
    // s2 だけが残る絞り込み。l1 の祖先（c1・s1）はどちらも消える
    const filtered = buildVisibleContentRows(
      [makeSeries("s2", [course("c3", [])])],
      noCollapse,
      noCollapse,
    );
    expect(
      resolveFocusFallbackRowId(allRows, filtered, lessonRowId("l1")),
    ).toBe(HOME_ROW_ID);
  });

  it("可視行が無ければ null", () => {
    expect(resolveFocusFallbackRowId(allRows, [], lessonRowId("l1"))).toBeNull();
  });

  it("カーソルが無ければ null", () => {
    expect(resolveFocusFallbackRowId(allRows, allRows, null)).toBeNull();
  });
});

describe("selectionRowId", () => {
  it("最深の非空フィールドから行 ID を導出し、全空はホーム", () => {
    expect(
      selectionRowId({ seriesId: "s1", courseId: "c1", lessonId: "l1" }),
    ).toBe(lessonRowId("l1"));
    expect(selectionRowId({ seriesId: "s1", courseId: "c1", lessonId: "" })).toBe(
      courseRowId("c1"),
    );
    expect(selectionRowId({ seriesId: "s1", courseId: "", lessonId: "" })).toBe(
      seriesRowId("s1"),
    );
    expect(selectionRowId({ seriesId: "", courseId: "", lessonId: "" })).toBe(
      HOME_ROW_ID,
    );
  });
});

describe("resolveCollapseAllTargets", () => {
  const allSeries = ["s1", "s2"];
  const allCourses = ["c1", "c2", "c3"];

  it("シリーズ選択では選択自身も畳む（畳み済みが開かない）", () => {
    const targets = resolveCollapseAllTargets(sample, {
      seriesId: "s1",
      courseId: "",
      lessonId: "",
    });
    expect(targets.series).toEqual(allSeries);
    expect(targets.courses).toEqual(allCourses);
  });

  it("コース選択では祖先シリーズだけ残し、コース自身は畳む", () => {
    const targets = resolveCollapseAllTargets(sample, {
      seriesId: "s1",
      courseId: "c1",
      lessonId: "",
    });
    expect(targets.series).toEqual(["s2"]);
    expect(targets.courses).toEqual(allCourses);
  });

  it("レッスン選択では祖先シリーズとコースだけ残す", () => {
    const targets = resolveCollapseAllTargets(sample, {
      seriesId: "s1",
      courseId: "c1",
      lessonId: "l1",
    });
    expect(targets.series).toEqual(["s2"]);
    expect(targets.courses).toEqual(["c2", "c3"]);
  });

  it("ホーム選択ではすべて畳む", () => {
    const targets = resolveCollapseAllTargets(sample, {
      seriesId: "",
      courseId: "",
      lessonId: "",
    });
    expect(targets.series).toEqual(allSeries);
    expect(targets.courses).toEqual(allCourses);
  });
});

describe("resolveLeftNavigation", () => {
  const rows = buildVisibleContentRows(sample, noCollapse, noCollapse);
  const rowById = (id: string): ContentTreeRow =>
    rows.find((r) => r.id === id)!;
  const opts = {
    isSeriesExpanded: (id: string) => id !== "collapsed",
    isCourseExpanded: (id: string) => id !== "collapsed",
  };

  it("開いているシリーズは折りたたむ", () => {
    expect(resolveLeftNavigation(rowById(seriesRowId("s1")), opts)).toEqual({
      collapse: { kind: "series", id: "s1" },
      focusRowId: seriesRowId("s1"),
    });
  });

  it("閉じているシリーズはホームへ", () => {
    expect(
      resolveLeftNavigation(rowById(seriesRowId("s1")), {
        ...opts,
        isSeriesExpanded: () => false,
      }),
    ).toEqual({ collapse: null, focusRowId: HOME_ROW_ID });
  });

  it("閉じているコースは親シリーズへ", () => {
    expect(
      resolveLeftNavigation(rowById(courseRowId("c1")), {
        ...opts,
        isCourseExpanded: () => false,
      }),
    ).toEqual({ collapse: null, focusRowId: seriesRowId("s1") });
  });

  it("レッスンは親コースへ", () => {
    expect(resolveLeftNavigation(rowById(lessonRowId("l3")), opts)).toEqual({
      collapse: null,
      focusRowId: courseRowId("c2"),
    });
  });

  it("ホーム行は no-op", () => {
    expect(resolveLeftNavigation(rowById(HOME_ROW_ID), opts)).toBeNull();
  });
});

describe("resolveHomeEndNavigation", () => {
  const rows = buildVisibleContentRows(sample, noCollapse, noCollapse);
  const indexOf = (id: string) => rows.findIndex((r) => r.id === id);

  it("Ctrl なしは同一親の兄弟の端へ", () => {
    expect(
      resolveHomeEndNavigation(rows, indexOf(lessonRowId("l2")), "Home", false),
    ).toEqual({ focusRowId: lessonRowId("l1") });
    expect(
      resolveHomeEndNavigation(rows, indexOf(courseRowId("c1")), "End", false),
    ).toEqual({ focusRowId: courseRowId("c2") });
  });

  it("Ctrl ありは全体の端へ", () => {
    expect(
      resolveHomeEndNavigation(rows, indexOf(lessonRowId("l2")), "Home", true),
    ).toEqual({ focusRowId: HOME_ROW_ID });
    expect(
      resolveHomeEndNavigation(rows, indexOf(seriesRowId("s1")), "End", true),
    ).toEqual({ focusRowId: courseRowId("c3") });
  });

  it("すでに端なら no-op", () => {
    expect(
      resolveHomeEndNavigation(rows, indexOf(lessonRowId("l1")), "Home", false),
    ).toEqual({ focusRowId: null });
  });
});

describe("getRowParentKey", () => {
  it("ホームとシリーズはルート区画を共有する", () => {
    const rows = buildVisibleContentRows(sample, noCollapse, noCollapse);
    expect(getRowParentKey(rows[0])).toBe("");
    expect(getRowParentKey(rows[1])).toBe("");
  });
});

describe("filterSeriesByName", () => {
  it("一致したレッスンの祖先を残す", () => {
    const filtered = filterSeriesByName(sample, "l3");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("s1");
    expect(filtered[0].courses.map((c) => c.id)).toEqual(["c2"]);
    expect(filtered[0].courses[0].lessons.map((l) => l.id)).toEqual(["l3"]);
  });

  it("一致したシリーズは配下ごと残す", () => {
    const filtered = filterSeriesByName(sample, "S1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].courses).toHaveLength(2);
  });

  it("空クエリは全件を返す", () => {
    expect(filterSeriesByName(sample, "  ")).toBe(sample);
  });
});

describe("filterSeriesByContentMatches", () => {
  it("レッスン一致は当該レッスンと祖先を残す", () => {
    const filtered = filterSeriesByContentMatches(sample, [
      { series: "s1", course: "c1", lesson: "l2" },
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].courses.map((c) => c.id)).toEqual(["c1"]);
    expect(filtered[0].courses[0].lessons.map((l) => l.id)).toEqual(["l2"]);
  });

  it("コース一致はコースごと残す", () => {
    const filtered = filterSeriesByContentMatches(sample, [
      { series: "s1", course: "c1" },
    ]);
    expect(filtered[0].courses[0].lessons).toHaveLength(2);
  });

  it("一致なしは空", () => {
    expect(filterSeriesByContentMatches(sample, [])).toEqual([]);
  });
});
