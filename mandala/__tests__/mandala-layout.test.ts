import { describe, expect, it } from "vitest";
import {
  layoutFlow,
  orderSeriesColumns,
  seriesFrameRect,
  type Box,
  type FramePadding,
} from "../lib/mandala/layout";

/**
 * グローバル曼陀羅のレイアウト規約の回帰テスト（publishing-site-mandala spec）。
 *
 * 守りたいのは 2 つ:
 *   1. どのシリーズ枠どうしも重ならないこと
 *   2. まとまり化（クラスタ）の有無で段の縦の間隔が変わらないこと
 *
 * ⚠ 入力に実 `contents/` を読み込まない。Studio 側の同名テストと同じフィクスチャで
 * 同じ規則を検証し、2 つのアプリで地図が割れないようにする。実データと
 * **同じ形**（4 シリーズ・9 コース・`Start` 1 個・跨ぎ 3 本）のフィクスチャを置く。
 * 検証したいのは配置規則であってデータそのものではない。
 */

/** `Mandala.tsx` の `SIZES.compact` / `SIZES.terminal` / `SIZES.collapsedSeries` と同じ */
const NODE = { width: 240, height: 72 };
const TERMINAL = { width: 90, height: 30 };
const COLLAPSED = { width: 210, height: 72 };

/** `Mandala.tsx` の `FRAME_PADDING` と同じ */
const PADDING: FramePadding = { x: 22, top: 30, bottom: 18 };

type Fixture = {
  /** コースノード。`series` が同じものが 1 つのシリーズ枠になる */
  courses: Array<{ id: string; series: string }>;
  /** 折りたたみ中のシリーズの集約ノード（枠を持たない） */
  aggregates?: string[];
  /** Start / Goal の文字ノード（枠を持たない） */
  terminals?: string[];
  edges: Array<[string, string]>;
};

/** 実 contents と同じ形。はじめに → {AI, Git} → GitHub */
const REAL_SHAPE: Fixture = {
  courses: [
    { id: "dx", series: "start" },
    { id: "junbi", series: "start" },
    { id: "ai", series: "ai" },
    { id: "git-concept", series: "git" },
    { id: "git-setup", series: "git" },
    { id: "git-basic", series: "git" },
    { id: "gh-intro", series: "github" },
    { id: "gh-remote", series: "github" },
    { id: "gh-pr", series: "github" },
  ],
  terminals: ["terminal:start:dx"],
  edges: [
    ["terminal:start:dx", "dx"],
    ["dx", "junbi"],
    ["dx", "ai"],
    ["junbi", "git-concept"],
    ["git-concept", "git-setup"],
    ["git-setup", "git-basic"],
    ["git-basic", "gh-intro"],
    ["gh-intro", "gh-remote"],
    ["gh-remote", "gh-pr"],
  ],
};

function sizeOf(id: string) {
  if (id.startsWith("terminal:")) return TERMINAL;
  if (id.startsWith("series:")) return COLLAPSED;
  return NODE;
}

/** `Mandala.tsx` と同じ手順でノードを配置し、シリーズ枠の矩形まで求める */
function place(fixture: Fixture, { clustered }: { clustered: boolean }) {
  const collapsed = fixture.aggregates ?? [];
  const ids = [
    ...fixture.courses.map((c) => c.id),
    ...collapsed,
    ...(fixture.terminals ?? []),
  ];
  const seriesById = new Map(fixture.courses.map((c) => [c.id, c.series]));

  const positions = layoutFlow(
    ids,
    fixture.edges.map(([source, target]) => ({
      id: `${source}__${target}`,
      source,
      target,
      // 線種は配置に影響しない。型を満たすためだけに置く
      kind: "order" as const,
    })),
    {
      size: NODE,
      sizeOf,
      // 集約ノードと Start / Goal は枠を持たないのでまとまりに入れない
      clusterOf: clustered ? (id) => seriesById.get(id) : undefined,
    },
  );
  const positionById = new Map(positions.map((p) => [p.id, p]));

  const boxOf = (id: string): Box => {
    const p = positionById.get(id) ?? { x: 0, y: 0 };
    return { x: p.x, y: p.y, ...sizeOf(id) };
  };

  const frames = new Map<string, Box>();
  for (const series of new Set(fixture.courses.map((c) => c.series))) {
    const rect = seriesFrameRect(
      fixture.courses.filter((c) => c.series === series).map((c) => boxOf(c.id)),
      PADDING,
    );
    if (rect) frames.set(series, rect);
  }

  return { boxOf, frames, positionById };
}

function overlapArea(a: Box, b: Box): number {
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return x > 0 && y > 0 ? x * y : 0;
}

function overlappingFramePairs(frames: Map<string, Box>): string[] {
  const list = [...frames.entries()];
  const hits: string[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [aName, a] = list[i]!;
      const [bName, b] = list[j]!;
      if (overlapArea(a, b) > 0) hits.push(`${aName} × ${bName}`);
    }
  }
  return hits;
}

/** 段の縦の間隔。y 座標のユニークな並びの差分（すべて等間隔である前提） */
function rankGaps(ys: readonly number[]): number[] {
  const sorted = [...new Set(ys)].sort((a, b) => a - b);
  return sorted.slice(1).map((y, i) => y - sorted[i]!);
}

describe("シリーズ枠は互いに重ならない", () => {
  it("枝分かれしたシリーズの枠が重ならない", () => {
    const { frames } = place(REAL_SHAPE, { clustered: true });
    expect(overlappingFramePairs(frames)).toEqual([]);
  });

  it("まとまり化しないと重なる（この対策が効いていることの裏取り）", () => {
    const { frames } = place(REAL_SHAPE, { clustered: false });
    expect(overlappingFramePairs(frames).length).toBeGreaterThan(0);
  });

  it("1 シリーズが最上段と最下段の両方にあっても重ならない", () => {
    const spanning: Fixture = {
      ...REAL_SHAPE,
      courses: [...REAL_SHAPE.courses, { id: "shuryo", series: "start" }],
      terminals: ["terminal:start:dx", "terminal:goal:shuryo"],
      edges: [
        ...REAL_SHAPE.edges,
        ["gh-pr", "shuryo"],
        ["shuryo", "terminal:goal:shuryo"],
      ],
    };
    const { frames } = place(spanning, { clustered: true });
    expect(overlappingFramePairs(frames)).toEqual([]);
  });

  it("一部を折りたたんでも枠が重ならず、集約ノードが枠に入らない", () => {
    const partiallyCollapsed: Fixture = {
      courses: REAL_SHAPE.courses.filter((c) => c.series !== "git"),
      aggregates: ["series:git"],
      terminals: ["terminal:start:dx"],
      edges: [
        ["terminal:start:dx", "dx"],
        ["dx", "junbi"],
        ["dx", "ai"],
        ["junbi", "series:git"],
        ["series:git", "gh-intro"],
        ["gh-intro", "gh-remote"],
        ["gh-remote", "gh-pr"],
      ],
    };
    const { frames, boxOf } = place(partiallyCollapsed, { clustered: true });

    expect(overlappingFramePairs(frames)).toEqual([]);
    for (const [, frame] of frames) {
      expect(overlapArea(boxOf("series:git"), frame)).toBe(0);
    }
  });
});

describe("まとまり化で段の間隔が変わらない", () => {
  it("クラスタありとなしで段の縦の間隔が等しい", () => {
    // ⚠ dagre は compound graph にすると各クラスタの上下へ境界の段を挿し込み、
    // 実効の段間が ranksep の 3 倍になる。layoutFlow がそれを補正していないと
    // ここが落ちる（縦が倍近くに間延びする）
    const clustered = place(REAL_SHAPE, { clustered: true });
    const plain = place(REAL_SHAPE, { clustered: false });

    const ysOf = (r: ReturnType<typeof place>) =>
      REAL_SHAPE.courses.map((c) => r.positionById.get(c.id)!.y);

    expect(rankGaps(ysOf(clustered))).toEqual(rankGaps(ysOf(plain)));
  });

  it("全て折りたたんで（クラスタ 0 個）も段の間隔が変わらない", () => {
    // クラスタが無いときは境界の段も入らないので、補正を掛けてはならない
    const allCollapsed: Fixture = {
      courses: [],
      aggregates: ["series:start", "series:ai", "series:git", "series:github"],
      terminals: ["terminal:start:series-start"],
      edges: [
        ["terminal:start:series-start", "series:start"],
        ["series:start", "series:ai"],
        ["series:start", "series:git"],
        ["series:git", "series:github"],
      ],
    };
    const clustered = place(allCollapsed, { clustered: true });
    const plain = place(allCollapsed, { clustered: false });

    const ysOf = (r: ReturnType<typeof place>) =>
      allCollapsed.aggregates!.map((id) => r.positionById.get(id)!.y);

    expect(rankGaps(ysOf(clustered))).toEqual(rankGaps(ysOf(plain)));
  });
});

describe("seriesFrameRect", () => {
  it("外接箱を padding のぶん広げる", () => {
    const rect = seriesFrameRect(
      [
        { x: 100, y: 200, width: 240, height: 72 },
        { x: 60, y: 400, width: 240, height: 72 },
      ],
      PADDING,
    );
    expect(rect).toEqual({
      x: 60 - 22,
      y: 200 - 30,
      width: 340 - 60 + 44,
      height: 472 - 200 + 48,
    });
  });

  it("メンバーが無ければ null", () => {
    expect(seriesFrameRect([], PADDING)).toBeNull();
  });
});

/**
 * 横順の固定（`orderSeriesColumns`）。
 *
 * 正本順は はじめに → AI → Git → GitHub。「はじめに」を畳むと AI と Git概念 が同じ段に
 * 並ぶ。そこで AI も畳むと、`Mandala.tsx` が集約ノードを末尾に挿していたために
 * dagre の同点処理で AI が Git の右へ移っていた（2026-08-24 に実機で確認）。
 * 挿入順を揃えれば直るが、跨ぎの辺の重心で再発しうるので、配置後の並べ直しでも
 * 同じ結果になることを固定する。
 */
const SERIES_ORDER = ["start", "ai", "git", "github"];

/** 「はじめに」を畳んだ形。AI と Git概念 が同じ段に並ぶ */
const START_COLLAPSED: Fixture = {
  courses: REAL_SHAPE.courses.filter((c) => c.series !== "start"),
  aggregates: ["series:start"],
  terminals: ["terminal:start:dx"],
  edges: [
    ["terminal:start:dx", "series:start"],
    ["series:start", "ai"],
    ["series:start", "git-concept"],
    ["git-concept", "git-setup"],
    ["git-setup", "git-basic"],
    ["git-basic", "gh-intro"],
    ["gh-intro", "gh-remote"],
    ["gh-remote", "gh-pr"],
  ],
};

/** さらに AI も畳んだ形 */
const START_AI_COLLAPSED: Fixture = {
  courses: START_COLLAPSED.courses.filter((c) => c.series !== "ai"),
  aggregates: ["series:start", "series:ai"],
  terminals: ["terminal:start:dx"],
  edges: START_COLLAPSED.edges.map(([s, t]) => [
    s === "ai" ? "series:ai" : s,
    t === "ai" ? "series:ai" : t,
  ]),
};

/**
 * `Mandala.tsx` と同じ手順で配置する。`insertion: "tail"` は集約ノードを末尾に挿す
 * 旧来の組み方、`"series"` はシリーズ順に差し込む新しい組み方
 */
function placeOrdered(
  fixture: Fixture,
  {
    ordered,
    insertion = "tail",
  }: { ordered: boolean; insertion?: "tail" | "series" },
) {
  const collapsed = fixture.aggregates ?? [];
  const seriesById = new Map(fixture.courses.map((c) => [c.id, c.series]));
  const seriesOf = (id: string) =>
    id.startsWith("series:") ? id.slice("series:".length) : seriesById.get(id);
  const bySeries = [...fixture.courses.map((c) => c.id), ...collapsed].sort(
    (a, b) =>
      SERIES_ORDER.indexOf(seriesOf(a)!) - SERIES_ORDER.indexOf(seriesOf(b)!),
  );
  const ids =
    insertion === "tail"
      ? [...fixture.courses.map((c) => c.id), ...collapsed]
      : bySeries;
  ids.push(...(fixture.terminals ?? []));

  const positions = layoutFlow(
    ids,
    fixture.edges.map(([source, target]) => ({
      id: `${source}__${target}`,
      source,
      target,
      // 線種は配置に影響しない。型を満たすためだけに置く
      kind: "order" as const,
    })),
    {
      size: NODE,
      sizeOf,
      clusterOf: (id) => seriesById.get(id),
      ...(ordered ? { seriesOf, seriesOrder: SERIES_ORDER } : {}),
    },
  );
  const positionById = new Map(positions.map((p) => [p.id, p]));
  const boxOf = (id: string): Box => {
    const p = positionById.get(id)!;
    return { x: p.x, y: p.y, ...sizeOf(id) };
  };
  const seriesBox = (series: string): Box => {
    const members = ids.filter((id) => seriesOf(id) === series).map(boxOf);
    const minX = Math.min(...members.map((b) => b.x));
    const minY = Math.min(...members.map((b) => b.y));
    const maxX = Math.max(...members.map((b) => b.x + b.width));
    const maxY = Math.max(...members.map((b) => b.y + b.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };
  const rightOf = (a: Box) => a.x + a.width;
  return { positions, positionById, boxOf, seriesBox, rightOf };
}

describe("シリーズの横順は折りたたみで変わらない", () => {
  it("「はじめに」を畳むと AI が Git の左に並ぶ（前提）", () => {
    const { seriesBox, rightOf } = placeOrdered(START_COLLAPSED, {
      ordered: false,
    });
    expect(rightOf(seriesBox("ai"))).toBeLessThanOrEqual(seriesBox("git").x);
  });

  it("末尾挿入のままだと AI を畳んだ瞬間に右へ移る（直す対象の再現）", () => {
    const { seriesBox } = placeOrdered(START_AI_COLLAPSED, { ordered: false });
    expect(seriesBox("ai").x).toBeGreaterThan(seriesBox("git").x);
  });

  it("挿入順をシリーズ順にすると AI は左に残る", () => {
    const { seriesBox, rightOf } = placeOrdered(START_AI_COLLAPSED, {
      ordered: false,
      insertion: "series",
    });
    expect(rightOf(seriesBox("ai"))).toBeLessThanOrEqual(seriesBox("git").x);
  });

  it("末尾挿入でも並べ直しで AI は左へ戻る", () => {
    const { seriesBox, rightOf } = placeOrdered(START_AI_COLLAPSED, {
      ordered: true,
    });
    expect(rightOf(seriesBox("ai"))).toBeLessThanOrEqual(seriesBox("git").x);
  });

  it("上下に積まれた Git と GitHub は縦位置が変わらず、横も揃ったまま一緒に動く", () => {
    const plain = placeOrdered(START_AI_COLLAPSED, { ordered: false });
    const ordered = placeOrdered(START_AI_COLLAPSED, { ordered: true });
    expect(ordered.seriesBox("github").y).toBe(plain.seriesBox("github").y);
    expect(ordered.seriesBox("github").x - ordered.seriesBox("git").x).toBe(
      plain.seriesBox("github").x - plain.seriesBox("git").x,
    );
  });

  it("並べ直してもブロック内の相対配置と隙間は変わらず、枠は重ならない", () => {
    const plain = placeOrdered(START_AI_COLLAPSED, { ordered: false });
    const ordered = placeOrdered(START_AI_COLLAPSED, { ordered: true });
    for (const id of ["git-concept", "git-setup", "git-basic"]) {
      expect(ordered.boxOf(id).x - ordered.seriesBox("git").x).toBe(
        plain.boxOf(id).x - plain.seriesBox("git").x,
      );
      expect(ordered.boxOf(id).y).toBe(plain.boxOf(id).y);
    }
    // 元: git | gap | ai → 後: ai | gap | git。隙間は同じ
    const gapBefore = plain.seriesBox("ai").x - plain.rightOf(plain.seriesBox("git"));
    const gapAfter =
      ordered.seriesBox("git").x - ordered.rightOf(ordered.seriesBox("ai"));
    expect(gapAfter).toBe(gapBefore);
    // 左端も同じ
    expect(ordered.seriesBox("ai").x).toBe(plain.seriesBox("git").x);

    const frames = new Map(
      ["git", "github"].map((s) => [s, ordered.seriesBox(s)]),
    );
    expect(overlappingFramePairs(frames)).toEqual([]);
    for (const [, frame] of frames) {
      expect(overlapArea(ordered.boxOf("series:ai"), frame)).toBe(0);
      expect(overlapArea(ordered.boxOf("series:start"), frame)).toBe(0);
    }
  });

  it("seriesOrder を与えなければ座標は不変（決定的）", () => {
    const plain = placeOrdered(REAL_SHAPE, { ordered: false });
    const again = placeOrdered(REAL_SHAPE, { ordered: false });
    expect(again.positions).toEqual(plain.positions);
  });

  it("すでに正本順なら座標は不変", () => {
    const plain = placeOrdered(START_COLLAPSED, { ordered: false });
    const ordered = placeOrdered(START_COLLAPSED, { ordered: true });
    expect(ordered.positions).toEqual(plain.positions);
  });

  it("orderSeriesColumns 単体: 元の左端と隙間を保って入れ替える", () => {
    // A（幅 100）| 50 | B（幅 300）を B,A の順へ → B が 0、A は 300 + 50
    const positions = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 150, y: 0 },
    ];
    const sizeOfAb = (id: string) =>
      id === "a" ? { width: 100, height: 50 } : { width: 300, height: 50 };
    const out = orderSeriesColumns(positions, {
      seriesOf: (id) => id,
      seriesOrder: ["b", "a"],
      sizeOf: sizeOfAb,
    });
    expect(out.find((p) => p.id === "b")!.x).toBe(0);
    expect(out.find((p) => p.id === "a")!.x).toBe(350);
  });

  it("orderSeriesColumns 単体: 2 つの親に跨る下段のシリーズは動かさない", () => {
    // D は A と B の両方の真下に張り出している。どちらの従属でもないので置き去りにし、
    // A と B だけを入れ替える
    const positions = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 150, y: 0 },
      { id: "d", x: 0, y: 100 },
    ];
    const sizes: Record<string, { width: number; height: number }> = {
      a: { width: 100, height: 50 },
      b: { width: 300, height: 50 },
      d: { width: 400, height: 50 },
    };
    const out = orderSeriesColumns(positions, {
      seriesOf: (id) => id,
      seriesOrder: ["b", "a", "d"],
      sizeOf: (id) => sizes[id]!,
    });
    expect(out.find((p) => p.id === "b")!.x).toBe(0);
    expect(out.find((p) => p.id === "a")!.x).toBe(350);
    expect(out.find((p) => p.id === "d")).toEqual({ id: "d", x: 0, y: 100 });
  });
});
