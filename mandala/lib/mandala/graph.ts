/**
 * 曼陀羅グラフの操作（純関数）。React Flow に依存しない——描画から切り離してテストできるようにする。
 */
import type { MandalaEdge, MandalaGraph, MandalaNode } from "@/lib/site-data";
import type { CurrentLocation } from "@/lib/current-course";

export type ViewNode = MandalaNode & {
  /** 表示範囲の外のノード（半透明で描く）。全体曼陀羅では常に false */
  ghost: boolean;
  /** 表示範囲の中心。全体曼陀羅では常に false */
  current: boolean;
};

export type MandalaView = {
  nodes: ViewNode[];
  edges: MandalaEdge[];
};

function nodeMap(graph: MandalaGraph): Map<string, MandalaNode> {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}

/** グローバル曼陀羅: 全ノード・全辺。ゴーストなし */
export function globalView(graph: MandalaGraph): MandalaView {
  return {
    nodes: graph.nodes.map((n) => ({ ...n, ghost: false, current: false })),
    edges: graph.edges,
  };
}

/** コーストップの「前に受けるコース」「次に受けるコース」 */
export type CourseNeighbors = {
  prev: MandalaNode[];
  next: MandalaNode[];
};

/**
 * 前後のコースを辺の向きから導出する。
 * 曼陀羅と同じデータを使うので、図とテキストの表示が食い違わない。
 * 並びは同シリーズ（order 辺）が先、他シリーズ（cross 辺）が後。
 */
export function courseNeighbors(
  graph: MandalaGraph,
  courseId: string,
): CourseNeighbors {
  const byId = nodeMap(graph);

  const collect = (
    matches: (edge: MandalaEdge) => boolean,
    otherEnd: (edge: MandalaEdge) => string,
  ): MandalaNode[] => {
    const seen = new Set<string>();
    const out: MandalaNode[] = [];
    for (const kind of ["order", "cross"] as const) {
      for (const edge of graph.edges) {
        if (edge.kind !== kind || !matches(edge)) continue;
        const node = byId.get(otherEnd(edge));
        if (!node || seen.has(node.id)) continue;
        seen.add(node.id);
        out.push(node);
      }
    }
    return out;
  };

  return {
    prev: collect(
      (e) => e.target === courseId,
      (e) => e.source,
    ),
    next: collect(
      (e) => e.source === courseId,
      (e) => e.target,
    ),
  };
}

/** Start / Goal の文字ノード。枠を持たず、クリック遷移もしない */
export type TerminalNode = {
  /** `terminal:start:<courseId>` / `terminal:goal:<courseId>` */
  id: string;
  kind: "start" | "goal";
  /** 繋ぐ相手のコース ID（折りたたみ後は集約ノードの ID になる） */
  courseId: string;
};

/** 文字ノードの id 接頭辞。ミニマップや枠の計算から外すときの判別に使う */
export const TERMINAL_PREFIX = "terminal:";

/** 折りたたんだシリーズの集約ノードの ID 接頭辞（`series:<slug>`）。Studio と同名 */
export const COLLAPSED_PREFIX = "series:";

/**
 * 宣言（`isStart` / `isGoal`）ごとに文字ノードと辺を作る。
 *
 * 宣言はコースごとに独立しているので、入口が複数あれば Start も複数置く——
 * 入口が違えば始まりの時点も違うため、1つのノードに集約しない。
 * `nodeIdOf` は折りたたみ後の ID 解決（畳まれたシリーズなら集約ノード）を担う。
 */
export function terminalNodes(
  nodes: readonly ViewNode[],
  nodeIdOf: (courseId: string) => string = (id) => id,
): { terminals: TerminalNode[]; edges: MandalaEdge[] } {
  const terminals: TerminalNode[] = [];
  const edges: MandalaEdge[] = [];

  for (const node of nodes) {
    if (node.isStart) {
      const id = `${TERMINAL_PREFIX}start:${node.id}`;
      const target = nodeIdOf(node.id);
      terminals.push({ id, kind: "start", courseId: target });
      edges.push({ id: `${id}__${target}`, source: id, target, kind: "order" });
    }
    if (node.isGoal) {
      const id = `${TERMINAL_PREFIX}goal:${node.id}`;
      const source = nodeIdOf(node.id);
      terminals.push({ id, kind: "goal", courseId: source });
      edges.push({ id: `${source}__${id}`, source, target: id, kind: "order" });
    }
  }

  return { terminals, edges };
}

export type CollapsedSeries = {
  /** 集約ノードの ID（`series:<slug>`） */
  id: string;
  seriesSlug: string;
  seriesName: string;
  /** シリーズ名の英語。未訳ではキーを持たない */
  seriesNameEn?: string;
  href: string;
  courseCount: number;
  lessonCount: number;
  totalMinutes: number;
};

export type CollapsibleView = {
  nodes: ViewNode[];
  collapsed: CollapsedSeries[];
  edges: MandalaEdge[];
};

/**
 * 指定シリーズを1ノードへ畳む。
 * 畳んだシリーズに繋がる辺は集約ノードへ張り替え、内部の辺は落とす。
 */
export function collapseSeries(
  view: MandalaView,
  collapsedSlugs: ReadonlySet<string>,
): CollapsibleView {
  if (collapsedSlugs.size === 0) {
    return { nodes: view.nodes, collapsed: [], edges: view.edges };
  }

  const collapsedIdOf = (slug: string) => `${COLLAPSED_PREFIX}${slug}`;
  const nodeSeries = new Map(view.nodes.map((n) => [n.id, n.seriesSlug]));

  const collapsed: CollapsedSeries[] = [];
  for (const slug of collapsedSlugs) {
    const members = view.nodes.filter((n) => n.seriesSlug === slug);
    if (members.length === 0) continue;
    collapsed.push({
      id: collapsedIdOf(slug),
      seriesSlug: slug,
      seriesName: members[0]!.seriesName,
      ...(members[0]!.seriesNameEn
        ? { seriesNameEn: members[0]!.seriesNameEn }
        : {}),
      href: `/${slug}`,
      courseCount: members.length,
      lessonCount: members.reduce((sum, n) => sum + n.lessonCount, 0),
      totalMinutes: members.reduce((sum, n) => sum + n.totalMinutes, 0),
    });
  }

  const nodes = view.nodes.filter((n) => !collapsedSlugs.has(n.seriesSlug));

  const resolve = (id: string) => {
    const slug = nodeSeries.get(id);
    return slug && collapsedSlugs.has(slug) ? collapsedIdOf(slug) : id;
  };

  const edges: MandalaEdge[] = [];
  const seen = new Set<string>();
  for (const edge of view.edges) {
    const source = resolve(edge.source);
    const target = resolve(edge.target);
    if (source === target) continue; // シリーズ内部の辺は集約で消える
    const id = `${source}__${target}`;
    if (seen.has(id)) continue;
    seen.add(id);
    edges.push({ id, source, target, kind: edge.kind });
  }

  return { nodes, collapsed, edges };
}

/**
 * 「いまここ」を立てるノードの ID を返す。規則は1つ——
 * **印はいま見ているページを表すノードに付く。**
 *
 * - コース: 畳まれたシリーズに含まれるならその集約ノード、でなければコース自身。
 *   折りたたみは全体を見渡すための操作なので、そこで現在地が消えては意味がない
 * - シリーズ: **畳まれているときだけ**その集約ノード。展開中のシリーズは
 *   ノードではなく枠なので、印を付ける先が無い（枠は押せない背景なので強調しない）
 *
 * 呼び出し側はコースノードと集約ノードの両方をこの1つの ID と突き合わせればよい。
 */
export function resolveHereNodeId(
  view: MandalaView,
  collapsed: readonly CollapsedSeries[],
  location?: CurrentLocation | null,
): string | undefined {
  if (!location) return undefined;

  if (location.kind === "series") {
    return collapsed.find((c) => c.seriesSlug === location.seriesSlug)?.id;
  }

  // view は畳む前の一覧なので、畳まれていてもシリーズを解決できる
  const course = view.nodes.find((node) => node.id === location.courseId);
  if (!course) return undefined;
  const aggregate = collapsed.find((c) => c.seriesSlug === course.seriesSlug);
  return aggregate?.id ?? location.courseId;
}

/**
 * シリーズ枠が現在地かどうか。展開中のそのシリーズのトップを見ているときに真。
 *
 * 判定自体は薄いが `resolveHereNodeId` と対で置く——現在地の規則は
 * 「いま見ているページを表すものに印を付ける」の一本で、その対象が
 * ノード（コース・集約）と枠に分かれているだけ。両方をここに揃えておかないと、
 * 片方だけ直して食い違う。
 *
 * ⚠ `resolveHereNodeId` は使えない。あれは**ノードの ID** を返す関数で、
 * 枠はグラフのノードではなく `frame:` 接頭辞の装飾だから。
 * 折りたたみ中のシリーズには枠が作られないので、ここでは畳んだ状態を考えない。
 */
export function isSeriesFrameHere(
  location: CurrentLocation | null | undefined,
  seriesSlug: string,
): boolean {
  return location?.kind === "series" && location.seriesSlug === seriesSlug;
}
