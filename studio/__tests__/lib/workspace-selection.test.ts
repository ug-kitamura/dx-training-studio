import { beforeEach, describe, expect, it } from "vitest";
import {
  focusCourse,
  focusHome,
  focusLesson,
  focusSeries,
  selectionLevel,
  resolveSelectionAfterContentReload,
  resolveSelectionAfterDelete,
  resolveInitialSelection,
  resolveStoredSelection,
  parseSelectionCookie,
  saveStoredSelection,
  SELECTION_COOKIE_NAME,
} from "@/lib/workspace-selection";
import type { Course, Lesson, Series } from "@/lib/schema";

function lesson(
  id: string,
  overrides: Partial<Lesson> = {},
): Lesson {
  return {
    id,
    series: "s",
    course: "c",
    lesson: id,
    status: "open",
    description: "",
    tags: [],
    estimated_minutes: 0,
    author: "",
    content: `---\nseries: s\ncourse: c\nlesson: ${id}\nstatus: open\ndescription: ""\ntags: []\nestimated_minutes: 0\nauthor: ""\n---\n\nbody-${id}`,
    ...overrides,
  };
}

function course(id: string, overrides: Partial<Course> = {}): Course {
  return {
    id,
    name: id,
    target: "",
    cross_series_prev: [],
    cross_series_next: [],
    lessons: [],
    ...overrides,
  };
}

function makeSeries(id: string, courses: Course[]): Series {
  return { id, name: id, courses };
}

const sampleSeries: Series[] = [
  makeSeries("s1", [
    course("c1", {
      lessons: [{ id: "l1", lesson: "L1" } as Course["lessons"][number]],
    }),
    course("c2", {
      lessons: [{ id: "l2", lesson: "L2" } as Course["lessons"][number]],
    }),
  ]),
  makeSeries("s2", [
    course("c3", {
      lessons: [{ id: "l3", lesson: "L3" } as Course["lessons"][number]],
    }),
  ]),
];

describe("resolveSelectionAfterDelete", () => {
  it("falls back to home when deleting series containing selected course", () => {
    const next = sampleSeries.filter((s) => s.id !== "s1");
    expect(
      resolveSelectionAfterDelete({
        prevSeries: sampleSeries,
        nextSeries: next,
        selectedSeriesId: "s1",
        selectedCourseId: "c1",
        selectedLessonId: "l1",
        deleted: { kind: "series", seriesId: "s1" },
      }),
    ).toEqual({ seriesId: "", courseId: "", lessonId: "" });
  });

  it("keeps selection when deleting non-selected series", () => {
    const next = sampleSeries.filter((s) => s.id !== "s2");
    expect(
      resolveSelectionAfterDelete({
        prevSeries: sampleSeries,
        nextSeries: next,
        selectedSeriesId: "s1",
        selectedCourseId: "c1",
        selectedLessonId: "l1",
        deleted: { kind: "series", seriesId: "s2" },
      }),
    ).toEqual({ seriesId: "s1", courseId: "c1", lessonId: "l1" });
  });

  it("stays on parent series when deleting selected course", () => {
    const next: Series[] = [
      makeSeries("s1", [sampleSeries[0].courses[1]]),
      sampleSeries[1],
    ];
    expect(
      resolveSelectionAfterDelete({
        prevSeries: sampleSeries,
        nextSeries: next,
        selectedSeriesId: "s1",
        selectedCourseId: "c1",
        selectedLessonId: "l1",
        deleted: { kind: "course", courseId: "c1" },
      }),
    ).toEqual({ seriesId: "s1", courseId: "", lessonId: "" });
  });

  it("keeps selection when deleting non-selected course", () => {
    const next: Series[] = [
      makeSeries("s1", [sampleSeries[0].courses[0]]),
      sampleSeries[1],
    ];
    expect(
      resolveSelectionAfterDelete({
        prevSeries: sampleSeries,
        nextSeries: next,
        selectedSeriesId: "s1",
        selectedCourseId: "c1",
        selectedLessonId: "l1",
        deleted: { kind: "course", courseId: "c2" },
      }),
    ).toEqual({ seriesId: "s1", courseId: "c1", lessonId: "l1" });
  });
});

describe("resolveSelectionAfterContentReload", () => {
  it("keeps selection when ids still exist in fresh series", () => {
    const data: Series[] = [
      makeSeries("s1", [course("c1", { lessons: [lesson("l1")] })]),
    ];
    expect(
      resolveSelectionAfterContentReload(data, data, {
        seriesId: "s1",
        courseId: "c1",
        lessonId: "l1",
      }),
    ).toEqual({ seriesId: "s1", courseId: "c1", lessonId: "l1" });
  });

  it("remaps lesson selection after external file rename by matching body", () => {
    const prev: Series[] = [
      makeSeries("s1", [
        course("course-A-コース", {
          name: "コース",
          lessons: [
            lesson("lesson-A-コース-旧名", {
              series: "A",
              course: "コース",
              lesson: "旧名",
              content:
                '---\nseries: A\ncourse: コース\nlesson: 旧名\nstatus: open\ndescription: ""\ntags: []\nestimated_minutes: 0\nauthor: ""\n---\n\n同じ本文',
            }),
          ],
        }),
      ]),
    ];
    const fresh: Series[] = [
      makeSeries("s1", [
        course("course-A-コース", {
          name: "コース",
          lessons: [
            lesson("lesson-A-コース-新名", {
              series: "A",
              course: "コース",
              lesson: "新名",
              content:
                '---\nseries: A\ncourse: コース\nlesson: 旧名\nstatus: open\ndescription: ""\ntags: []\nestimated_minutes: 0\nauthor: ""\n---\n\n同じ本文',
            }),
          ],
        }),
      ]),
    ];

    expect(
      resolveSelectionAfterContentReload(prev, fresh, {
        seriesId: "s1",
        courseId: "course-A-コース",
        lessonId: "lesson-A-コース-旧名",
      }),
    ).toEqual({
      seriesId: "s1",
      courseId: "course-A-コース",
      lessonId: "lesson-A-コース-新名",
    });
  });
});

describe("resolveInitialSelection", () => {
  const series: Series[] = [
    makeSeries("s1", [
      course("c1", {
        name: "Course 1",
        lessons: [lesson("l1"), lesson("l2")],
      }),
      course("c2", { name: "Course 2", lessons: [lesson("l3")] }),
    ]),
  ];

  const fallback = { seriesId: "s1", courseId: "c1", lessonId: "l1" };

  beforeEach(() => {
    localStorage.clear();
  });

  it("returns fallback when nothing is stored", () => {
    expect(resolveInitialSelection(series, fallback)).toEqual(fallback);
  });

  it("restores stored lesson selection", () => {
    saveStoredSelection({ seriesId: "s1", courseId: "c1", lessonId: "l2" });
    expect(resolveInitialSelection(series, fallback)).toEqual({
      seriesId: "s1",
      courseId: "c1",
      lessonId: "l2",
    });
  });

  it("falls back to the stored course (no descent) when stored lesson is missing", () => {
    saveStoredSelection({ seriesId: "s1", courseId: "c1", lessonId: "missing" });
    expect(resolveInitialSelection(series, fallback)).toEqual({
      seriesId: "s1",
      courseId: "c1",
      lessonId: "",
    });
  });

  it("returns fallback when stored course is missing", () => {
    saveStoredSelection({ seriesId: "missing", courseId: "missing", lessonId: "l1" });
    expect(resolveInitialSelection(series, fallback)).toEqual(fallback);
  });

  it("restores home selection (all empty) instead of fallback", () => {
    saveStoredSelection({ seriesId: "", courseId: "", lessonId: "" });
    expect(resolveInitialSelection(series, fallback)).toEqual({
      seriesId: "",
      courseId: "",
      lessonId: "",
    });
  });
});

describe("選択はクリックした階層で止まる", () => {
  const full: Series[] = [
    makeSeries("s1", [
      course("c1", { lessons: [lesson("l1"), lesson("l2")] }),
      course("c2", { lessons: [lesson("l3")] }),
    ]),
  ];

  it("シリーズ選択はシリーズで止まり下位はクリアされる", () => {
    expect(focusSeries(full, "s1")).toEqual({
      seriesId: "s1",
      courseId: "",
      lessonId: "",
    });
  });

  it("コース選択は所属シリーズを逆引きしてコースで止まる", () => {
    expect(focusCourse(full, "c2")).toEqual({
      seriesId: "s1",
      courseId: "c2",
      lessonId: "",
    });
  });

  it("レッスン選択は所属コース・シリーズを逆引きする", () => {
    expect(focusLesson(full, "l2")).toEqual({
      seriesId: "s1",
      courseId: "c1",
      lessonId: "l2",
    });
  });

  it("ホーム選択は全空になる", () => {
    expect(focusHome()).toEqual({
      seriesId: "",
      courseId: "",
      lessonId: "",
    });
  });

  it("実在しない ID は空の選択になる", () => {
    expect(focusSeries(full, "missing")).toEqual({
      seriesId: "",
      courseId: "",
      lessonId: "",
    });
  });
});

describe("selectionLevel", () => {
  it("最深の非空フィールドから導出する", () => {
    expect(
      selectionLevel({ seriesId: "s", courseId: "c", lessonId: "l" }),
    ).toBe("lesson");
    expect(selectionLevel({ seriesId: "s", courseId: "c", lessonId: "" })).toBe(
      "course",
    );
    expect(selectionLevel({ seriesId: "s", courseId: "", lessonId: "" })).toBe(
      "series",
    );
    expect(selectionLevel({ seriesId: "", courseId: "", lessonId: "" })).toBe(
      "none",
    );
  });
});

describe("保存済み選択の後方互換", () => {
  const series: Series[] = [
    makeSeries("s1", [course("c1", { lessons: [lesson("l1"), lesson("l2")] })]),
  ];
  const fallback = { seriesId: "s1", courseId: "c1", lessonId: "l1" };

  beforeEach(() => {
    localStorage.clear();
  });

  it("seriesId を持たない旧形式でも courseId から補完する", () => {
    // 旧形式をそのまま書き込む（saveStoredSelection は新形式で書くため直接操作）
    localStorage.setItem(
      "dx-training-studio-selection",
      JSON.stringify({ courseId: "c1", lessonId: "l2" }),
    );
    expect(resolveInitialSelection(series, fallback)).toEqual({
      seriesId: "s1",
      courseId: "c1",
      lessonId: "l2",
    });
  });

  it("コースを持たないシリーズの選択を復元する", () => {
    const emptySeries: Series[] = [makeSeries("s1", [])];
    saveStoredSelection({ seriesId: "s1", courseId: "", lessonId: "" });
    expect(
      resolveInitialSelection(emptySeries, {
        seriesId: "",
        courseId: "",
        lessonId: "",
      }),
    ).toEqual({ seriesId: "s1", courseId: "", lessonId: "" });
  });
});

describe("resolveSelectionAfterDelete のシリーズ階層", () => {
  it("最後のコースを削除するとシリーズにフォーカスが残る", () => {
    const prev: Series[] = [makeSeries("s1", [course("c1", { lessons: [] })])];
    const next: Series[] = [makeSeries("s1", [])];
    expect(
      resolveSelectionAfterDelete({
        prevSeries: prev,
        nextSeries: next,
        selectedSeriesId: "s1",
        selectedCourseId: "c1",
        selectedLessonId: "",
        deleted: { kind: "course", courseId: "c1" },
      }),
    ).toEqual({ seriesId: "s1", courseId: "", lessonId: "" });
  });

  it("フォーカス中のシリーズ自体を削除したらホームへ戻る", () => {
    const prev: Series[] = [
      makeSeries("s1", []),
      makeSeries("s2", [course("c3", { lessons: [lesson("l3")] })]),
    ];
    const next: Series[] = [prev[1]];
    expect(
      resolveSelectionAfterDelete({
        prevSeries: prev,
        nextSeries: next,
        selectedSeriesId: "s1",
        selectedCourseId: "",
        selectedLessonId: "",
        deleted: { kind: "series", seriesId: "s1" },
      }),
    ).toEqual({ seriesId: "", courseId: "", lessonId: "" });
  });
});

describe("選択の cookie（サーバーの初期描画用）", () => {
  function cookieValue(): string | undefined {
    const prefix = `${SELECTION_COOKIE_NAME}=`;
    for (const part of document.cookie.split(";")) {
      const t = part.trim();
      if (t.startsWith(prefix)) return t.slice(prefix.length);
    }
    return undefined;
  }

  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${SELECTION_COOKIE_NAME}=; path=/; max-age=0`;
  });

  it("saveStoredSelection は localStorage と cookie の両方に同じ値を書く", () => {
    saveStoredSelection({ seriesId: "s2", courseId: "c3", lessonId: "l3" });
    expect(parseSelectionCookie(cookieValue())).toEqual({
      seriesId: "s2",
      courseId: "c3",
      lessonId: "l3",
    });
    expect(resolveInitialSelection(sampleSeries, focusHome())).toEqual(
      focusLesson(sampleSeries, "l3"),
    );
  });

  it("cookie の値は URL エンコード済みで、cookie の区切り文字を含まない", () => {
    saveStoredSelection({ seriesId: "s1", courseId: "c1", lessonId: "l1" });
    expect(cookieValue()).not.toMatch(/[;,\s"]/);
  });

  it("resolveStoredSelection は cookie の値を series 上で検証する（純関数）", () => {
    const stored = parseSelectionCookie(
      encodeURIComponent(
        JSON.stringify({ seriesId: "s2", courseId: "c3", lessonId: "l3" }),
      ),
    );
    expect(resolveStoredSelection(sampleSeries, stored, focusHome())).toEqual(
      focusLesson(sampleSeries, "l3"),
    );
  });

  it("cookie の選択先が消えていればフォールバック", () => {
    const stored = parseSelectionCookie(
      encodeURIComponent(
        JSON.stringify({ seriesId: "gone", courseId: "gone", lessonId: "gone" }),
      ),
    );
    const fallback = focusLesson(sampleSeries, "l1");
    expect(resolveStoredSelection(sampleSeries, stored, fallback)).toEqual(fallback);
  });

  it("壊れた cookie は保存値なしとして扱う", () => {
    expect(parseSelectionCookie("%7B broken")).toBeNull();
    expect(parseSelectionCookie(undefined)).toBeNull();
  });

  it("明示的なホーム選択は cookie でも有効", () => {
    saveStoredSelection(focusHome());
    expect(parseSelectionCookie(cookieValue())).toEqual(focusHome());
    expect(
      resolveStoredSelection(
        sampleSeries,
        parseSelectionCookie(cookieValue()),
        focusLesson(sampleSeries, "l1"),
      ),
    ).toEqual(focusHome());
  });
});
