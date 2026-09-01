/**
 * 曼陀羅グラフの型と操作（純関数）。React Flow に依存しない——描画から切り離して
 * テストできるようにする。公開サイト `mandala/lib/mandala/graph.ts` の移植。
 *
 * ⚠ 両アプリは互いの node_modules・ソースに依存しない規約（入れ物 CLAUDE.md、
 * CI が検証）があるため、共有ではなくコピーで持つ。辺の導出規則が割れると
 * 同じ contents/ を見ているのに 2 つのアプリで違う地図が出るので、規則は
 * `build-graph.ts` に閉じ込めてサイトの buildMandalaGraph と対応を追えるようにする。
 */
import type { CourseStyle } from "@/lib/schema";

export type MandalaNode = {
  id: string;
  label: string;
  seriesId: string;
  seriesName: string;
  lessonCount: number;
  totalMinutes: number;
  style?: CourseStyle;
  /** カリキュラムの入口・到達点の宣言。未宣言ではキーを持たない */
  isStart?: boolean;
  isGoal?: boolean;
};

export type MandalaEdge = {
  id: string;
  source: string;
  target: string;
};

export type MandalaGraph = { nodes: MandalaNode[]; edges: MandalaEdge[] };

export type ViewNode = MandalaNode & {
  /** 表示中のコース外のノード（半透明・破線枠で描く） */
  ghost: boolean;
  /** 現在地（ミニ曼陀羅では中心コース） */
  current: boolean;
};

export type MandalaView = {
  nodes: ViewNode[];
  edges: MandalaEdge[];
};

function nodeMap(graph: MandalaGraph): Map<string, MandalaNode> {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}

/** 全体曼陀羅: 全ノード・全辺。ゴーストなし */
export function globalView(graph: MandalaGraph): MandalaView {
  return {
    nodes: graph.nodes.map((n) => ({ ...n, ghost: false, current: false })),
    edges: graph.edges,
  };
}

/**
 * ミニ曼陀羅: 中心コースと、辺で直接つながる相手だけ。
 * 別シリーズの相手はゴーストとして描く。
 */
export function courseView(graph: MandalaGraph, courseId: string): MandalaView {
  const byId = nodeMap(graph);
  const center = byId.get(courseId);
  if (!center) return { nodes: [], edges: [] };

  const edges = graph.edges.filter(
    (e) => e.source === courseId || e.target === courseId,
  );
  const neighborIds = new Set<string>();
  for (const edge of edges) {
    neighborIds.add(edge.source === courseId ? edge.target : edge.source);
  }

  const nodes: ViewNode[] = [
    { ...center, ghost: false, current: true },
    ...[...neighborIds]
      .map((id) => byId.get(id))
      .filter((n): n is MandalaNode => Boolean(n))
      .map((n) => ({
        ...n,
        ghost: n.seriesId !== center.seriesId,
        current: false,
      })),
  ];

  return { nodes, edges };
}

export type CollapsedSeries = {
  /** 集約ノードの ID（`series:<id>`） */
  id: string;
  seriesId: string;
  seriesName: string;
  courseCount: number;
  lessonCount: number;
  totalMinutes: number;
};

export type CollapsibleView = {
  nodes: ViewNode[];
  collapsed: CollapsedSeries[];
  edges: MandalaEdge[];
};

/** 集約ノードの id 接頭辞。クリックでシリーズを解決するときの判別に使う */
export const COLLAPSED_PREFIX = "series:";

/**
 * 指定シリーズを 1 ノードへ畳む。
 * 畳んだシリーズに繋がる辺は集約ノードへ張り替え、内部の辺は落とす。
 */
export function collapseSeries(
  view: MandalaView,
  collapsedIds: ReadonlySet<string>,
): CollapsibleView {
  if (collapsedIds.size === 0) {
    return { nodes: view.nodes, collapsed: [], edges: view.edges };
  }

  const collapsedIdOf = (seriesId: string) => `${COLLAPSED_PREFIX}${seriesId}`;
  const nodeSeries = new Map(view.nodes.map((n) => [n.id, n.seriesId]));

  const collapsed: CollapsedSeries[] = [];
  for (const seriesId of collapsedIds) {
    const members = view.nodes.filter((n) => n.seriesId === seriesId);
    if (members.length === 0) continue;
    collapsed.push({
      id: collapsedIdOf(seriesId),
      seriesId,
      seriesName: members[0]!.seriesName,
      courseCount: members.length,
      lessonCount: members.reduce((sum, n) => sum + n.lessonCount, 0),
      totalMinutes: members.reduce((sum, n) => sum + n.totalMinutes, 0),
    });
  }

  const nodes = view.nodes.filter((n) => !collapsedIds.has(n.seriesId));

  const resolve = (id: string) => {
    const seriesId = nodeSeries.get(id);
    return seriesId && collapsedIds.has(seriesId)
      ? collapsedIdOf(seriesId)
      : id;
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
    edges.push({ id, source, target });
  }

  return { nodes, collapsed, edges };
}

/**
 * 「いまここ」を立てるノードの ID を返す。規則は 1 つ——
 * **印はいま選んでいるコースを表すノードに付く。**
 * 畳まれたシリーズに含まれるならその集約ノードへ移る（折りたたみは全体を
 * 見渡すための操作なので、そこで現在地が消えては意味がない）。
 */
export function resolveHereNodeId(
  view: MandalaView,
  collapsed: readonly CollapsedSeries[],
  currentCourseId?: string | null,
): string | undefined {
  if (!currentCourseId) return undefined;
  const course = view.nodes.find((node) => node.id === currentCourseId);
  if (!course) return undefined;
  const aggregate = collapsed.find((c) => c.seriesId === course.seriesId);
  return aggregate?.id ?? currentCourseId;
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

/**
 * 宣言（`isStart` / `isGoal`）ごとに文字ノードと辺を作る。
 *
 * 宣言はコースごとに独立しているので、入口が複数あれば Start も複数置く——
 * 入口が違えば始まりの時点も違うため、1 つのノードに集約しない。
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
      edges.push({ id: `${id}__${target}`, source: id, target });
    }
    if (node.isGoal) {
      const id = `${TERMINAL_PREFIX}goal:${node.id}`;
      const source = nodeIdOf(node.id);
      terminals.push({ id, kind: "goal", courseId: source });
      edges.push({ id: `${source}__${id}`, source, target: id });
    }
  }

  return { terminals, edges };
}
