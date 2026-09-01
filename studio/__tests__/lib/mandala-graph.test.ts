import { describe, expect, it } from "vitest";
import { buildMandalaGraph } from "@/lib/mandala/build-graph";
import {
  collapseSeries,
  courseView,
  globalView,
  resolveHereNodeId,
  terminalNodes,
} from "@/lib/mandala/graph";
import type { Course, Lesson, Series } from "@/lib/schema";

function lesson(minutes: number): Lesson {
  return {
    id: `lsn-${minutes}`,
    series: "s",
    course: "c",
    lesson: "l",
    status: "open",
    description: "",
    tags: [],
    estimated_minutes: minutes,
    author: "",
    content: "",
  } as Lesson;
}

function course(id: string, extra: Partial<Course> = {}): Course {
  return {
    id,
    name: `コース ${id}`,
    cross_series_prev: [],
    cross_series_next: [],
    lessons: [lesson(10)],
    ...extra,
  } as Course;
}

function series(id: string, courses: Course[]): Series {
  return { id, name: `シリーズ ${id}`, courses } as Series;
}

/**
 * git シリーズ: a → b → c（配列順）
 * ops シリーズ: x（b から跨ぎで繋がる）
 */
const fixture: Series[] = [
  series("git", [
    course("a", { is_start: true }),
    course("b", { cross_series_next: ["x"] }),
    course("c", { is_goal: true, lessons: [lesson(10), lesson(20)] }),
  ]),
  series("ops", [course("x", { style: "hands-on" })]),
];

describe("buildMandalaGraph", () => {
  it("derives order edges from the course array order", () => {
    const { edges } = buildMandalaGraph(fixture);
    expect(edges.map((e) => e.id)).toContain("a__b");
    expect(edges.map((e) => e.id)).toContain("b__c");
  });

  it("derives cross edges from cross_series_next", () => {
    const { edges } = buildMandalaGraph(fixture);
    expect(edges.map((e) => e.id)).toContain("b__x");
  });

  it("drops cross links whose partner does not exist", () => {
    // 行き先の無い矢印を描かない——存在しない ID を指す宣言が残っていても無視する
    const graph = buildMandalaGraph([
      series("git", [course("a", { cross_series_next: ["missing"] })]),
    ]);
    expect(graph.edges).toEqual([]);
  });

  it("does not distinguish order and cross edges by kind", () => {
    // 線種で区別しないので、辺は種別を持たない
    const { edges } = buildMandalaGraph(fixture);
    for (const edge of edges) {
      expect(edge).not.toHaveProperty("kind");
    }
  });

  it("sums lesson count and minutes per course", () => {
    const { nodes } = buildMandalaGraph(fixture);
    const c = nodes.find((n) => n.id === "c");
    expect(c?.lessonCount).toBe(2);
    expect(c?.totalMinutes).toBe(30);
  });

  it("carries start and goal declarations", () => {
    const { nodes } = buildMandalaGraph(fixture);
    expect(nodes.find((n) => n.id === "a")?.isStart).toBe(true);
    expect(nodes.find((n) => n.id === "c")?.isGoal).toBe(true);
    expect(nodes.find((n) => n.id === "b")?.isStart).toBeUndefined();
  });

  it("carries the course style", () => {
    const { nodes } = buildMandalaGraph(fixture);
    expect(nodes.find((n) => n.id === "x")?.style).toBe("hands-on");
    expect(nodes.find((n) => n.id === "a")?.style).toBeUndefined();
  });

  it("英語モードではノードのラベルに name_en を使う", () => {
    const translated: Series[] = [
      series("git", [course("a", { name_en: "Git Concepts" })]),
    ];
    translated[0]!.name_en = "Git Basics";
    const { nodes } = buildMandalaGraph(translated, "en");
    expect(nodes[0]?.label).toBe("Git Concepts");
    expect(nodes[0]?.seriesName).toBe("Git Basics");
  });

  it("英語モードでも name_en が無ければ日本語名にフォールバックする", () => {
    // ⚠ ここが空になると曼陀羅のノードが名無しになりナビが死ぬ
    const { nodes } = buildMandalaGraph(fixture, "en");
    expect(nodes.find((n) => n.id === "a")?.label).toBe("コース a");
    expect(nodes.find((n) => n.id === "a")?.seriesName).toBe("シリーズ git");
  });

  it("言語を変えてもグラフの形（ID と辺）は変わらない", () => {
    const ja = buildMandalaGraph(fixture, "ja");
    const en = buildMandalaGraph(fixture, "en");
    expect(en.nodes.map((n) => n.id)).toEqual(ja.nodes.map((n) => n.id));
    expect(en.edges.map((e) => e.id)).toEqual(ja.edges.map((e) => e.id));
  });
});

describe("globalView", () => {
  it("keeps every node and edge without ghosts", () => {
    const view = globalView(buildMandalaGraph(fixture));
    expect(view.nodes).toHaveLength(4);
    expect(view.nodes.every((n) => !n.ghost && !n.current)).toBe(true);
  });
});

describe("courseView", () => {
  it("keeps the centre and its direct neighbours only", () => {
    const view = courseView(buildMandalaGraph(fixture), "b");
    expect(view.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c", "x"]);
    expect(view.nodes.find((n) => n.id === "b")?.current).toBe(true);
  });

  it("marks neighbours from other series as ghosts", () => {
    const view = courseView(buildMandalaGraph(fixture), "b");
    expect(view.nodes.find((n) => n.id === "x")?.ghost).toBe(true);
    expect(view.nodes.find((n) => n.id === "a")?.ghost).toBe(false);
  });

  it("returns nothing for an unknown course", () => {
    expect(courseView(buildMandalaGraph(fixture), "nope")).toEqual({
      nodes: [],
      edges: [],
    });
  });
});

describe("collapseSeries", () => {
  it("returns the view untouched when nothing is collapsed", () => {
    const view = globalView(buildMandalaGraph(fixture));
    const result = collapseSeries(view, new Set());
    expect(result.collapsed).toEqual([]);
    expect(result.nodes).toBe(view.nodes);
  });

  it("aggregates a collapsed series into one node", () => {
    const view = globalView(buildMandalaGraph(fixture));
    const result = collapseSeries(view, new Set(["git"]));
    expect(result.nodes.map((n) => n.id)).toEqual(["x"]);
    expect(result.collapsed).toHaveLength(1);
    expect(result.collapsed[0]).toMatchObject({
      id: "series:git",
      courseCount: 3,
      lessonCount: 4,
    });
  });

  it("rewires edges to the aggregate and drops internal ones", () => {
    const view = globalView(buildMandalaGraph(fixture));
    const result = collapseSeries(view, new Set(["git"]));
    // a→b, b→c はシリーズ内部なので消える。b→x は集約ノードから出る
    expect(result.edges.map((e) => e.id)).toEqual(["series:git__x"]);
  });
});

describe("resolveHereNodeId", () => {
  it("returns the course itself when nothing is collapsed", () => {
    const view = globalView(buildMandalaGraph(fixture));
    expect(resolveHereNodeId(view, [], "b")).toBe("b");
  });

  it("moves the marker to the aggregate when its series is collapsed", () => {
    // 折りたたみは全体を見渡す操作なので、そこで現在地が消えては意味がない
    const view = globalView(buildMandalaGraph(fixture));
    const { collapsed } = collapseSeries(view, new Set(["git"]));
    expect(resolveHereNodeId(view, collapsed, "b")).toBe("series:git");
  });

  it("returns undefined without a current course", () => {
    const view = globalView(buildMandalaGraph(fixture));
    expect(resolveHereNodeId(view, [], null)).toBeUndefined();
    expect(resolveHereNodeId(view, [], "nope")).toBeUndefined();
  });
});

describe("terminalNodes", () => {
  it("creates one terminal per declaration", () => {
    const view = globalView(buildMandalaGraph(fixture));
    const { terminals, edges } = terminalNodes(view.nodes);
    expect(terminals.map((t) => t.kind).sort()).toEqual(["goal", "start"]);
    expect(edges.map((e) => e.id)).toEqual([
      "terminal:start:a__a",
      "c__terminal:goal:c",
    ]);
  });

  it("routes terminals to the aggregate when the series is collapsed", () => {
    const view = globalView(buildMandalaGraph(fixture));
    const { terminals } = terminalNodes(view.nodes, () => "series:git");
    expect(terminals.every((t) => t.courseId === "series:git")).toBe(true);
  });

  /**
   * ミニ曼陀羅は中心コース自身の宣言だけを拾う——映しているのは中心とその隣接
   * 1 段なので、隣のコースの宣言まで拾うと「2 段先」の情報が混じる。
   * `Mandala` が `courseView` の結果を中心コースだけに絞って渡す規則をここで固定する。
   */
  const centerOnly = (graph: ReturnType<typeof buildMandalaGraph>, id: string) =>
    terminalNodes(courseView(graph, id).nodes.filter((n) => n.id === id));

  it("puts Start on the center course when it declares one", () => {
    const graph = buildMandalaGraph(fixture);
    const { terminals, edges } = centerOnly(graph, "a");
    expect(terminals.map((t) => t.kind)).toEqual(["start"]);
    expect(edges.map((e) => e.id)).toEqual(["terminal:start:a__a"]);
  });

  it("does not pick up a neighbour's Start declaration", () => {
    const graph = buildMandalaGraph(fixture);
    // b の 1 個前は a（is_start）だが、その手前の Start までは出さない
    expect(courseView(graph, "b").nodes.map((n) => n.id)).toContain("a");
    expect(centerOnly(graph, "b").terminals).toEqual([]);
  });

  it("puts Goal on the center course when it declares one", () => {
    const graph = buildMandalaGraph(fixture);
    const { terminals, edges } = centerOnly(graph, "c");
    expect(terminals.map((t) => t.kind)).toEqual(["goal"]);
    expect(edges.map((e) => e.id)).toEqual(["c__terminal:goal:c"]);
  });
});
