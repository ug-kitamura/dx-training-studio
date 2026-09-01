import { describe, expect, it } from "vitest";
import {
  collapseSeries,
  courseNeighbors,
  globalView,
  isSeriesFrameHere,
  resolveHereNodeId,
  terminalNodes,
} from "../lib/mandala/graph";
import { layoutFlow } from "../lib/mandala/layout";
import type { MandalaGraph } from "../lib/site-data";

/**
 * start: setup → (cross) → git: concepts → basics
 * git: concepts → basics は order 辺
 */
const graph: MandalaGraph = {
  nodes: [
    {
      id: "crs-setup",
      label: "開発環境準備コース",
      seriesSlug: "start",
      seriesName: "はじめにシリーズ",
      courseSlug: "setup",
      href: "/start/setup",
      lessonCount: 2,
      totalMinutes: 25,
      status: "in_progress",
    },
    {
      id: "crs-intro",
      label: "DX入門コース",
      seriesSlug: "start",
      seriesName: "はじめにシリーズ",
      courseSlug: "intro",
      href: "/start/intro",
      lessonCount: 1,
      totalMinutes: 15,
      status: "in_progress",
    },
    {
      id: "crs-concepts",
      label: "Git概念コース",
      seriesSlug: "git",
      seriesName: "Git基礎シリーズ",
      courseSlug: "concepts",
      href: "/git/concepts",
      lessonCount: 2,
      totalMinutes: 30,
      status: "done",
    },
    {
      id: "crs-basics",
      label: "Git基本操作コース",
      seriesSlug: "git",
      seriesName: "Git基礎シリーズ",
      courseSlug: "basics",
      href: "/git/basics",
      lessonCount: 3,
      totalMinutes: 40,
      status: "done",
    },
  ],
  edges: [
    { id: "e1", source: "crs-intro", target: "crs-setup", kind: "order" },
    { id: "e2", source: "crs-concepts", target: "crs-basics", kind: "order" },
    { id: "e3", source: "crs-setup", target: "crs-concepts", kind: "cross" },
  ],
};

describe("globalView", () => {
  it("全ノード・全辺をゴーストなしで返す", () => {
    const view = globalView(graph);
    expect(view.nodes).toHaveLength(4);
    expect(view.edges).toHaveLength(3);
    expect(view.nodes.every((n) => !n.ghost)).toBe(true);
  });
});



describe("courseNeighbors", () => {
  it("辺の向きで前後に振り分ける", () => {
    const { prev, next } = courseNeighbors(graph, "crs-concepts");
    expect(prev.map((n) => n.id)).toEqual(["crs-setup"]);
    expect(next.map((n) => n.id)).toEqual(["crs-basics"]);
  });

  it("同シリーズ（order）を先、他シリーズ（cross）を後に並べる", () => {
    const withBoth: MandalaGraph = {
      nodes: graph.nodes,
      edges: [
        // cross を先に置いても order が先に来る
        { id: "e3", source: "crs-setup", target: "crs-basics", kind: "cross" },
        {
          id: "e2",
          source: "crs-concepts",
          target: "crs-basics",
          kind: "order",
        },
      ],
    };
    const { prev } = courseNeighbors(withBoth, "crs-basics");
    expect(prev.map((n) => n.id)).toEqual(["crs-concepts", "crs-setup"]);
  });

  it("端のコースでは片側が空になる", () => {
    const { prev, next } = courseNeighbors(graph, "crs-intro");
    expect(prev).toEqual([]);
    expect(next.map((n) => n.id)).toEqual(["crs-setup"]);
  });

  it("存在しないコースには両側とも空を返す", () => {
    expect(courseNeighbors(graph, "crs-unknown")).toEqual({
      prev: [],
      next: [],
    });
  });
});


describe("collapseSeries", () => {
  it("畳まないときは元のビューを返す", () => {
    const view = globalView(graph);
    const result = collapseSeries(view, new Set());
    expect(result.collapsed).toHaveLength(0);
    expect(result.nodes).toHaveLength(4);
  });

  it("集約ノードはシリーズの英語名を引き継ぐ", () => {
    const withEn: MandalaGraph = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.seriesSlug === "start"
          ? { ...n, seriesNameEn: "Getting Started Series" }
          : n,
      ),
    };
    const result = collapseSeries(globalView(withEn), new Set(["start"]));
    expect(result.collapsed[0]!.seriesNameEn).toBe("Getting Started Series");
  });

  it("未訳のシリーズの集約ノードは英語名のキーを持たない", () => {
    const result = collapseSeries(globalView(graph), new Set(["start"]));
    expect(result.collapsed[0]!.seriesNameEn).toBeUndefined();
  });

  it("畳んだシリーズを1ノードに集約する", () => {
    const result = collapseSeries(globalView(graph), new Set(["start"]));
    expect(result.nodes.map((n) => n.id)).toEqual([
      "crs-concepts",
      "crs-basics",
    ]);
    expect(result.collapsed).toHaveLength(1);
    expect(result.collapsed[0]).toMatchObject({
      id: "series:start",
      seriesName: "はじめにシリーズ",
      courseCount: 2,
      lessonCount: 3,
      totalMinutes: 40,
      href: "/start",
    });
  });

  it("跨ぎの辺を集約ノードへ張り替え、内部の辺を落とす", () => {
    const result = collapseSeries(globalView(graph), new Set(["start"]));
    // e1（start 内部）は消え、e3 は series:start → crs-concepts になる
    expect(result.edges).toHaveLength(2);
    expect(
      result.edges.some(
        (e) => e.source === "series:start" && e.target === "crs-concepts",
      ),
    ).toBe(true);
  });

  it("集約後に重複する辺を作らない", () => {
    const withDup: MandalaGraph = {
      nodes: graph.nodes,
      edges: [
        ...graph.edges,
        {
          id: "e4",
          source: "crs-intro",
          target: "crs-concepts",
          kind: "cross",
        },
      ],
    };
    const result = collapseSeries(globalView(withDup), new Set(["start"]));
    const toCcepts = result.edges.filter(
      (e) => e.source === "series:start" && e.target === "crs-concepts",
    );
    expect(toCcepts).toHaveLength(1);
  });
});

describe("resolveHereNodeId", () => {
  const course = (courseId: string) => ({ kind: "course", courseId }) as const;
  const seriesAt = (seriesSlug: string) =>
    ({ kind: "series", seriesSlug }) as const;

  it("畳んでいなければコース自身の ID を返す", () => {
    const view = globalView(graph);
    const { collapsed } = collapseSeries(view, new Set());
    expect(resolveHereNodeId(view, collapsed, course("crs-intro"))).toBe(
      "crs-intro",
    );
  });

  it("現在地のシリーズを畳むと集約ノードの ID を返す", () => {
    const view = globalView(graph);
    const { collapsed } = collapseSeries(view, new Set(["start"]));
    // 折りたたみで現在地が消えてはいけない
    expect(resolveHereNodeId(view, collapsed, course("crs-intro"))).toBe(
      "series:start",
    );
  });

  it("別のシリーズを畳んでも現在地は動かない", () => {
    const view = globalView(graph);
    const { collapsed } = collapseSeries(view, new Set(["start"]));
    expect(resolveHereNodeId(view, collapsed, course("crs-concepts"))).toBe(
      "crs-concepts",
    );
  });

  it("シリーズトップは、畳まれているときだけ集約ノードを指す", () => {
    const view = globalView(graph);
    const collapsedView = collapseSeries(view, new Set(["start"]));
    expect(resolveHereNodeId(view, collapsedView.collapsed, seriesAt("start"))).toBe(
      "series:start",
    );
  });

  it("展開中のシリーズトップは undefined（枠は強調しない）", () => {
    const view = globalView(graph);
    const { collapsed } = collapseSeries(view, new Set());
    expect(
      resolveHereNodeId(view, collapsed, seriesAt("start")),
    ).toBeUndefined();
  });

  it("現在地が無い、またはビューに含まれないときは undefined", () => {
    const view = globalView(graph);
    const { collapsed } = collapseSeries(view, new Set());
    expect(resolveHereNodeId(view, collapsed, null)).toBeUndefined();
    expect(
      resolveHereNodeId(view, collapsed, course("crs-unknown")),
    ).toBeUndefined();
  });
});

describe("isSeriesFrameHere", () => {
  const course = (courseId: string) => ({ kind: "course", courseId }) as const;
  const seriesAt = (seriesSlug: string) =>
    ({ kind: "series", seriesSlug }) as const;

  it("そのシリーズのトップを見ているときだけ真", () => {
    expect(isSeriesFrameHere(seriesAt("start"), "start")).toBe(true);
    expect(isSeriesFrameHere(seriesAt("start"), "git")).toBe(false);
  });

  it("コースページでは枠は現在地にならない", () => {
    // 印はコースノードに付くので、枠まで光ると二重になる
    expect(isSeriesFrameHere(course("crs-intro"), "start")).toBe(false);
  });

  it("全体トップ（現在地なし）では真にならない", () => {
    expect(isSeriesFrameHere(null, "start")).toBe(false);
    expect(isSeriesFrameHere(undefined, "start")).toBe(false);
  });

  it("枠とノードの現在地は同時に立たない", () => {
    const view = globalView(graph);
    const { collapsed } = collapseSeries(view, new Set());
    // シリーズトップ: 枠だけ
    expect(isSeriesFrameHere(seriesAt("start"), "start")).toBe(true);
    expect(resolveHereNodeId(view, collapsed, seriesAt("start"))).toBeUndefined();
    // コースページ: ノードだけ
    expect(isSeriesFrameHere(course("crs-intro"), "start")).toBe(false);
    expect(resolveHereNodeId(view, collapsed, course("crs-intro"))).toBe(
      "crs-intro",
    );
  });
});

describe("terminalNodes", () => {
  const declared: MandalaGraph = {
    nodes: [
      { ...graph.nodes[0]!, isStart: true },
      graph.nodes[1]!,
      graph.nodes[2]!,
      { ...graph.nodes[3]!, isGoal: true },
    ],
    edges: graph.edges,
  };

  it("宣言が無ければ何も作らない", () => {
    const result = terminalNodes(globalView(graph).nodes);
    expect(result.terminals).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("Start は文字ノードから当該コースへ、Goal は当該コースから文字ノードへ辺を張る", () => {
    const { terminals, edges } = terminalNodes(globalView(declared).nodes);
    expect(terminals.map((t) => t.kind)).toEqual(["start", "goal"]);
    expect(edges).toContainEqual(
      expect.objectContaining({
        source: "terminal:start:crs-setup",
        target: "crs-setup",
      }),
    );
    expect(edges).toContainEqual(
      expect.objectContaining({
        source: "crs-basics",
        target: "terminal:goal:crs-basics",
      }),
    );
  });

  it("宣言ごとに個別のノードを置く（集約しない）", () => {
    const multi: MandalaGraph = {
      nodes: declared.nodes.map((n) => ({ ...n, isStart: true })),
      edges: graph.edges,
    };
    const { terminals } = terminalNodes(globalView(multi).nodes);
    expect(terminals.filter((t) => t.kind === "start")).toHaveLength(4);
    expect(new Set(terminals.map((t) => t.id)).size).toBe(terminals.length);
  });

  it("折りたたみ時は集約ノードへ繋ぎ替える", () => {
    const view = globalView(declared);
    const collapsed = collapseSeries(view, new Set(["start"]));
    const nodeIdOf = (courseId: string) =>
      collapsed.nodes.some((n) => n.id === courseId)
        ? courseId
        : "series:start";
    const { edges } = terminalNodes(view.nodes, nodeIdOf);
    expect(edges).toContainEqual(
      expect.objectContaining({
        source: "terminal:start:crs-setup",
        target: "series:start",
      }),
    );
  });
});

describe("layoutFlow", () => {
  it("上から下に段を作る", () => {
    const positions = layoutFlow(
      graph.nodes.map((n) => n.id),
      graph.edges,
      { size: { width: 200, height: 80 } },
    );
    const y = new Map(positions.map((p) => [p.id, p.y]));
    // intro → setup → concepts → basics の順に下がる
    expect(y.get("crs-intro")!).toBeLessThan(y.get("crs-setup")!);
    expect(y.get("crs-setup")!).toBeLessThan(y.get("crs-concepts")!);
    expect(y.get("crs-concepts")!).toBeLessThan(y.get("crs-basics")!);
  });

  it("LR では左から右に段を作る", () => {
    const positions = layoutFlow(
      graph.nodes.map((n) => n.id),
      graph.edges,
      { size: { width: 200, height: 80 }, direction: "LR" },
    );
    const x = new Map(positions.map((p) => [p.id, p.x]));
    const y = new Map(positions.map((p) => [p.id, p.y]));
    // 進む向きが x に出る
    expect(x.get("crs-intro")!).toBeLessThan(x.get("crs-setup")!);
    expect(x.get("crs-setup")!).toBeLessThan(x.get("crs-concepts")!);
    // 縦には積み上がらない（TB との違い）
    expect(y.get("crs-intro")!).toBe(y.get("crs-setup")!);
  });

  it("全ノードの座標を返す", () => {
    const positions = layoutFlow(["crs-setup"], [], {
      size: { width: 100, height: 50 },
    });
    expect(positions).toHaveLength(1);
    expect(Number.isFinite(positions[0]!.x)).toBe(true);
    expect(Number.isFinite(positions[0]!.y)).toBe(true);
  });
});
