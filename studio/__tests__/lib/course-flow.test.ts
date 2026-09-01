import { describe, it, expect } from "vitest";
import {
  applyCourseDeletion,
  applyCrossSeriesCourseMetaEdit,
  applySeriesDeletion,
  buildCourseNeighbors,
  buildMiniMandalaGraphInput,
  hasCourseFlowCycle,
  listCoursesNeedingMetaPersist,
  normalizeSeriesCourseMeta,
  resolveCourseRefs,
  wouldCourseMetaEditCreateCycle,
} from "@/lib/course-flow";
import type { Course, Series } from "@/lib/schema";

function course(id: string, overrides: Partial<Course> = {}): Course {
  return {
    id,
    name: id,
    cross_series_prev: [],
    cross_series_next: [],
    lessons: [],
    ...overrides,
  };
}

function series(id: string, courses: Course[]): Series {
  return { id, name: id, courses };
}

function getCourse(allSeries: Series[], id: string): Course {
  const found = allSeries.flatMap((s) => s.courses).find((c) => c.id === id);
  if (!found) throw new Error(`course not found: ${id}`);
  return found;
}

describe("applyCrossSeriesCourseMetaEdit", () => {
  it("reassigns cross-series exit from A2 to A1 via cross_series_next edit", () => {
    const initial = [
      series("sa", [
        course("a1"),
        course("a2", { cross_series_next: ["b1"] }),
      ]),
      series("sb", [course("b1", { cross_series_prev: ["a2"] })]),
    ];

    const result = applyCrossSeriesCourseMetaEdit(initial, "a1", [], ["b1"]);

    expect(getCourse(result, "a1").cross_series_next).toEqual(["b1"]);
    expect(getCourse(result, "a2").cross_series_next).toEqual([]);
    expect(getCourse(result, "b1").cross_series_prev).toEqual(["a1"]);
  });

  it("keeps other source series when reassigning within series A", () => {
    const initial = [
      series("sa", [
        course("a1", { cross_series_next: ["b2"] }),
        course("a2"),
      ]),
      series("sb", [
        course("b1", { cross_series_next: ["b2"] }),
        course("b2", { cross_series_prev: ["a1", "b1"] }),
      ]),
    ];

    const result = applyCrossSeriesCourseMetaEdit(initial, "a2", [], ["b2"]);

    expect(getCourse(result, "a2").cross_series_next).toEqual(["b2"]);
    expect(getCourse(result, "a1").cross_series_next).toEqual([]);
    expect(getCourse(result, "b1").cross_series_next).toEqual(["b2"]);
    expect(getCourse(result, "b2").cross_series_prev).toEqual(
      expect.arrayContaining(["a2", "b1"]),
    );
    expect(getCourse(result, "b2").cross_series_prev).toHaveLength(2);
  });

  it("syncs cross_series_prev-side edit and mirrors to source cross_series_next", () => {
    const initial = [
      series("sa", [
        course("a1"),
        course("a2", { cross_series_next: ["b1"] }),
      ]),
      series("sb", [course("b1", { cross_series_prev: ["a2"] })]),
    ];

    const result = applyCrossSeriesCourseMetaEdit(initial, "b1", ["a1"], []);

    expect(getCourse(result, "a1").cross_series_next).toEqual(["b1"]);
    expect(getCourse(result, "a2").cross_series_next).toEqual([]);
    expect(getCourse(result, "b1").cross_series_prev).toEqual(["a1"]);
  });

  it("removes mirror links when cross-series next is cleared", () => {
    const initial = [
      series("sa", [course("a1", { cross_series_next: ["b1"] })]),
      series("sb", [course("b1", { cross_series_prev: ["a1"] })]),
    ];

    const result = applyCrossSeriesCourseMetaEdit(initial, "a1", [], []);

    expect(getCourse(result, "a1").cross_series_next).toEqual([]);
    expect(getCourse(result, "b1").cross_series_prev).toEqual([]);
  });

  it("drops prior next in same target series when prereq is reassigned", () => {
    const initial = [
      series("sa", [
        course("a1", { cross_series_next: ["b1"] }),
        course("a2", { cross_series_next: ["b2"] }),
      ]),
      series("sb", [
        course("b1", { cross_series_prev: ["a1"] }),
        course("b2", { cross_series_prev: ["a2"] }),
      ]),
    ];

    const result = applyCrossSeriesCourseMetaEdit(initial, "b2", ["a1"], []);

    expect(getCourse(result, "a1").cross_series_next).toEqual(["b2"]);
    expect(getCourse(result, "a2").cross_series_next).toEqual([]);
    expect(getCourse(result, "b1").cross_series_prev).toEqual([]);
    expect(getCourse(result, "b2").cross_series_prev).toEqual(["a1"]);
  });
});

describe("applyCourseDeletion", () => {
  it("removes course and strips cross-series link references", () => {
    const initial = [
      series("sa", [
        course("a1", { cross_series_next: ["b1"] }),
        course("deleted"),
      ]),
      series("sb", [course("b1", { cross_series_prev: ["deleted", "a1"] })]),
    ];

    const result = applyCourseDeletion(initial, "sa", "deleted");

    expect(result.flatMap((s) => s.courses).map((c) => c.id)).toEqual([
      "a1",
      "b1",
    ]);
    expect(getCourse(result, "a1").cross_series_next).toEqual(["b1"]);
    expect(getCourse(result, "b1").cross_series_prev).toEqual(["a1"]);
  });
});

describe("applySeriesDeletion", () => {
  it("removes series and strips links to its courses", () => {
    const initial = [
      series("sa", [course("a1", { cross_series_next: ["b1"] })]),
      series("sb", [course("b1", { cross_series_prev: ["a1"] })]),
    ];

    const result = applySeriesDeletion(initial, "sb");

    expect(result).toHaveLength(1);
    expect(getCourse(result, "a1").cross_series_next).toEqual([]);
  });
});

describe("normalizeSeriesCourseMeta", () => {
  it("strips dangling course ids from cross_series_prev and cross_series_next", () => {
    const initial = [
      series("sa", [
        course("a1", { cross_series_next: ["ghost"] }),
        course("a2", { cross_series_prev: ["ghost"] }),
      ]),
    ];

    const result = normalizeSeriesCourseMeta(initial);

    expect(getCourse(result, "a1").cross_series_next).toEqual([]);
    expect(getCourse(result, "a2").cross_series_prev).toEqual([]);
  });
});

describe("listCoursesNeedingMetaPersist", () => {
  it("includes mirror targets when cross-series links are synced", () => {
    const before = [
      series("sa", [course("a1", { cross_series_next: [] })]),
      series("sb", [course("b1", { cross_series_prev: [] })]),
    ];
    const after = applyCrossSeriesCourseMetaEdit(before, "a1", [], ["b1"]);

    const targets = listCoursesNeedingMetaPersist(before, after, "a1");
    expect(targets.map((t) => t.course.id).sort()).toEqual(["a1", "b1"]);
    expect(getCourse(after, "b1").cross_series_prev).toEqual(["a1"]);
  });

  it("includes the edited course when only style changed", () => {
    const before = [series("sa", [course("a1")])];
    const after = [series("sa", [course("a1", { style: "hands-on" })])];

    const targets = listCoursesNeedingMetaPersist(before, after, "a1");
    expect(targets.map((t) => t.course.id)).toEqual(["a1"]);
  });

  it("includes the edited course when style is cleared", () => {
    const before = [series("sa", [course("a1", { style: "lecture" })])];
    const after = [series("sa", [course("a1", { style: undefined })])];

    const targets = listCoursesNeedingMetaPersist(before, after, "a1");
    expect(targets.map((t) => t.course.id)).toEqual(["a1"]);
  });

  it("includes the edited course when only is_start changed", () => {
    const before = [series("sa", [course("a1")])];
    const after = [series("sa", [course("a1", { is_start: true })])];

    const targets = listCoursesNeedingMetaPersist(before, after, "a1");
    expect(targets.map((t) => t.course.id)).toEqual(["a1"]);
  });

  it("includes the edited course when only is_goal changed", () => {
    const before = [series("sa", [course("a1", { is_goal: true })])];
    const after = [series("sa", [course("a1", { is_goal: false })])];

    const targets = listCoursesNeedingMetaPersist(before, after, "a1");
    expect(targets.map((t) => t.course.id)).toEqual(["a1"]);
  });

  it("treats missing flags and false as the same value", () => {
    const before = [series("sa", [course("a1")])];
    const after = [
      series("sa", [course("a1", { is_start: false, is_goal: false })]),
    ];

    const targets = listCoursesNeedingMetaPersist(before, after, "a1");
    expect(targets).toEqual([]);
  });

  it("includes the edited course when only slug changed", () => {
    const before = [series("sa", [course("a1")])];
    const after = [series("sa", [course("a1", { slug: "intro" })])];

    const targets = listCoursesNeedingMetaPersist(before, after, "a1");
    expect(targets.map((t) => t.course.id)).toEqual(["a1"]);
  });

  it("includes the edited course when catch / description changed", () => {
    const before = [
      series("sa", [course("a1", { catch: "旧", description: "旧説明" })]),
    ];
    const after = [
      series("sa", [course("a1", { catch: "新", description: "旧説明" })]),
    ];

    const targets = listCoursesNeedingMetaPersist(before, after, "a1");
    expect(targets.map((t) => t.course.id)).toEqual(["a1"]);
  });

  it("treats missing publishing fields and empty as the same value", () => {
    const before = [series("sa", [course("a1")])];
    const after = [
      series("sa", [course("a1", { slug: undefined, catch: undefined })]),
    ];

    const targets = listCoursesNeedingMetaPersist(before, after, "a1");
    expect(targets).toEqual([]);
  });
});

describe("buildMiniMandalaGraphInput の Start / Goal", () => {
  it("宣言が無ければ両方 false", () => {
    const data = [series("sa", [course("a1")])];
    const input = buildMiniMandalaGraphInput(data, getCourse(data, "a1"));
    expect(input.isStart).toBe(false);
    expect(input.isGoal).toBe(false);
  });

  it("宣言を引き継ぐ", () => {
    const data = [
      series("sa", [course("a1", { is_start: true, is_goal: true })]),
    ];
    const input = buildMiniMandalaGraphInput(data, getCourse(data, "a1"));
    expect(input.isStart).toBe(true);
    expect(input.isGoal).toBe(true);
  });

  it("前のコースがあっても Start を宣言できる", () => {
    const data = [
      series("sa", [course("a1"), course("a2", { is_start: true })]),
    ];
    const input = buildMiniMandalaGraphInput(data, getCourse(data, "a2"));
    expect(input.isStart).toBe(true);
    expect(input.intraPrev?.id).toBe("a1");
  });
});

describe("buildCourseNeighbors", () => {
  it("returns intra-series prev/next and cross-series links", () => {
    const data = [
      series("sa", [
        course("a1"),
        course("a2", { cross_series_prev: ["b1"], cross_series_next: ["b2"] }),
        course("a3"),
      ]),
      series("sb", [course("b1"), course("b2")]),
    ];
    const neighbors = buildCourseNeighbors(data, getCourse(data, "a2"));
    expect(neighbors.intraPrev).toEqual({ id: "a1", name: "a1" });
    expect(neighbors.intraNext).toEqual({ id: "a3", name: "a3" });
    expect(neighbors.crossPrevs).toEqual([{ id: "b1", name: "b1" }]);
    expect(neighbors.crossNexts).toEqual([{ id: "b2", name: "b2" }]);
  });

  it("omits dangling cross-series ids", () => {
    const data = [
      series("sa", [course("a1", { cross_series_next: ["ghost"] })]),
    ];
    const neighbors = buildCourseNeighbors(data, getCourse(data, "a1"));
    expect(neighbors.crossNexts).toEqual([]);
  });
});

describe("resolveCourseRefs", () => {
  it("omits missing courses instead of using raw ids as labels", () => {
    const refs = resolveCourseRefs(
      [series("sa", [course("a1")])],
      ["a1", "ghost"],
    );
    expect(refs).toEqual([{ id: "a1", name: "a1" }]);
  });
});

describe("hasCourseFlowCycle", () => {
  it("returns false for acyclic mandala", () => {
    const data = [
      series("sa", [
        course("a1", { cross_series_next: ["b1"] }),
        course("a2", { cross_series_next: ["b2"] }),
      ]),
      series("sb", [
        course("b1", { cross_series_prev: ["a1"] }),
        course("b2", { cross_series_prev: ["a2"] }),
      ]),
    ];
    expect(hasCourseFlowCycle(data)).toBe(false);
  });

  it("returns true when cross-series links form a cycle", () => {
    const data = [
      series("sa", [course("a1", { cross_series_next: ["b1"] })]),
      series("sb", [
        course("b1", { cross_series_next: ["a1"], cross_series_prev: ["a1"] }),
      ]),
    ];
    expect(hasCourseFlowCycle(data)).toBe(true);
  });
});

describe("wouldCourseMetaEditCreateCycle", () => {
  it("detects cycle after sync propagation on save preview", () => {
    const initial = [
      series("sa", [course("a1")]),
      series("sb", [course("b1", { cross_series_next: ["a1"], cross_series_prev: ["a1"] })]),
    ];

    expect(
      wouldCourseMetaEditCreateCycle(initial, "a1", [], ["b1"]),
    ).toBe(true);
  });

  it("allows save when preview is cyclic but cross links unchanged", () => {
    const cyclic = [
      series("sa", [course("a1", { cross_series_next: ["b1"] })]),
      series("sb", [
        course("b1", { cross_series_next: ["a1"], cross_series_prev: ["a1"] }),
      ]),
    ];

    expect(
      wouldCourseMetaEditCreateCycle(cyclic, "a1", [], ["b1"]),
    ).toBe(false);
  });
});
