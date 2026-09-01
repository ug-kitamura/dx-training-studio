/**
 * dagre による自動レイアウト。React Flow に渡す座標を計算する。上から下（TB）。
 * 公開サイト `mandala/lib/mandala/layout.ts` の移植。
 *
 * ⚠ 両アプリは互いの node_modules・ソースに依存しない規約（入れ物 CLAUDE.md、
 * CI が検証）のためコピーで持つ。**片方を直したら必ずもう片方も直すこと。**
 */
import dagre from "@dagrejs/dagre";
import type { MandalaEdge } from "@/lib/mandala/graph";

export type LayoutSize = { width: number; height: number };

export type PositionedNode = {
  id: string;
  x: number;
  y: number;
};

export type LayoutOptions = {
  /** ノードの既定サイズ。密度（compact / card）で変える */
  size: LayoutSize;
  /** 同じ段の間隔 */
  nodeSep?: number;
  /** 段と段の間隔 */
  rankSep?: number;
  sizeOf?: (id: string) => LayoutSize | undefined;
  /**
   * ノードをまとまり（クラスタ）へ割り当てる。同じ値を返したノードは
   * レイアウト上ひとかたまりに置かれ、**まとまり同士は重ならない**。
   * 全体曼陀羅のシリーズ枠がこれで担保される。
   *
   * `undefined` を返したノードはどのまとまりにも属さない（Start / Goal の
   * 文字ノード・折りたたみ中のシリーズの集約ノード）。
   */
  clusterOf?: (id: string) => string | undefined;
  /**
   * 横順を固定する単位（シリーズ）。`clusterOf` と違い、**折りたたみ中の集約ノードも
   * そのシリーズに属させる**——枠は持たないが、並びの上では同じシリーズの姿だから。
   * `seriesOrder` と組で与えたときだけ、配置後に `orderSeriesColumns` を通す。
   */
  seriesOf?: (id: string) => string | undefined;
  /** シリーズの正本順（先頭が左）。`seriesOf` と組で与える */
  seriesOrder?: readonly string[];
};

/** クラスタ ID の接頭辞。実ノードの ID と衝突させないための名前空間 */
const CLUSTER_PREFIX = "cluster:";

/**
 * クラスタがあるときの `ranksep` の割り算。
 *
 * ⚠ dagre は compound graph にすると各クラスタの上下へ**境界の段**を挿し込むため、
 * 段と段の実効間隔が `ranksep` の 3 倍になる（実測: 72→288 / 36→180 / 24→144）。
 * 補正しないと縦に倍近く間延びし、1 画面に入るコース数が減って地図として読めなくなる。
 * クラスタが 1 つも無いときは境界の段が入らないので**補正してはならない**——
 * 無条件に割ると今度は段が詰まる（実測: 144px → 96px）。
 *
 * ⚠ この係数は dagre の内部実装に由来する。値そのものではなく「クラスタの有無で
 * 段間が変わらない」という不変量をテストで固定すること。
 */
const CLUSTERED_RANKSEP_DIVISOR = 3;

export type Box = { x: number; y: number; width: number; height: number };

/** シリーズ枠がコース群の外へどれだけはみ出すか */
export type FramePadding = { x: number; top: number; bottom: number };

/**
 * シリーズ枠の矩形。メンバーの外接箱を `padding` の分だけ広げたもの。
 *
 * React Flow の親子関係は使わない——dagre の絶対座標と二重管理になるため、
 * レイアウト結果から矩形を求めて背後に敷くだけにする。
 *
 * ⚠ 枠が重ならないことは**この関数ではなく `layoutFlow` の `clusterOf` が担保する**。
 * ここは広げるだけなので、`padding.x` をクラスタ間のクリアランスより大きくすると
 * 隣の枠と重なる。両者は暗黙に結合している（`mandala-layout.test.ts` が検証）。
 */
export function seriesFrameRect(
  boxes: readonly Box[],
  padding: FramePadding,
): Box | null {
  if (boxes.length === 0) return null;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return {
    x: minX - padding.x,
    y: minY - padding.top,
    width: maxX - minX + padding.x * 2,
    height: maxY - minY + padding.top + padding.bottom,
  };
}

export function layoutFlow(
  nodeIds: readonly string[],
  edges: readonly MandalaEdge[],
  options: LayoutOptions,
): PositionedNode[] {
  // クラスタは「1 つ以上できたか」で ranksep の補正が変わるので、先に集める
  const clusterIdByNode = new Map<string, string>();
  if (options.clusterOf) {
    for (const id of nodeIds) {
      const cluster = options.clusterOf(id);
      if (cluster !== undefined) {
        clusterIdByNode.set(id, `${CLUSTER_PREFIX}${cluster}`);
      }
    }
  }
  const clusterIds = new Set(clusterIdByNode.values());
  const clustered = clusterIds.size > 0;

  const baseRankSep = options.rankSep ?? 72;
  const graph = new dagre.graphlib.Graph({ compound: clustered });
  graph.setGraph({
    rankdir: "TB",
    nodesep: options.nodeSep ?? 48,
    ranksep: clustered
      ? baseRankSep / CLUSTERED_RANKSEP_DIVISOR
      : baseRankSep,
    marginx: 24,
    marginy: 24,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const known = new Set(nodeIds);
  for (const id of nodeIds) {
    const size = options.sizeOf?.(id) ?? options.size;
    graph.setNode(id, { width: size.width, height: size.height });
  }
  // 親子は実ノードを全て置いてから張る（dagre は親の存在を要求する）
  for (const clusterId of clusterIds) graph.setNode(clusterId, {});
  for (const [nodeId, clusterId] of clusterIdByNode) {
    graph.setParent(nodeId, clusterId);
  }
  for (const edge of edges) {
    if (known.has(edge.source) && known.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(graph);

  const positioned = nodeIds.map((id) => {
    const node = graph.node(id) as
      | { x: number; y: number; width: number; height: number }
      | undefined;
    const size = options.sizeOf?.(id) ?? options.size;
    // dagre は中心座標を返す。React Flow は左上基準なので変換する
    return {
      id,
      x: (node?.x ?? 0) - (node?.width ?? size.width) / 2,
      y: (node?.y ?? 0) - (node?.height ?? size.height) / 2,
    };
  });

  if (options.seriesOf && options.seriesOrder) {
    return orderSeriesColumns(positioned, {
      seriesOf: options.seriesOf,
      seriesOrder: options.seriesOrder,
      sizeOf: (id) => options.sizeOf?.(id) ?? options.size,
    });
  }
  return positioned;
}

export type OrderSeriesOptions = {
  seriesOf: (id: string) => string | undefined;
  seriesOrder: readonly string[];
  sizeOf: (id: string) => LayoutSize;
};

/** 縦の範囲が重なるか。接している（隙間 0）は重ならない扱い */
function verticallyOverlaps(a: Box, b: Box): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

function horizontallyOverlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width;
}

/** 横方向の隙間（重なっていれば負） */
function horizontalGap(a: Box, b: Box): number {
  return Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width);
}

function unionBox(boxes: readonly Box[]): Box {
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * シリーズの横順を正本順へ揃える（純関数）。
 *
 * dagre は交差最小化の同点を挿入順で決めるため、折りたたみで集約ノードが末尾へ
 * 回ると畳んだシリーズが右端へ移る。挿入順を揃えても跨ぎの辺の重心次第で
 * 入れ替わりうるので、配置のあとに**シリーズのブロック単位**で並べ直す。
 *
 * 規則:
 * - 縦の範囲が重なるシリーズどうし（同じ横帯）だけが左右の順番を持つ。段で上下に
 *   積まれたシリーズは対象外
 * - 同じ横帯のブロック群は「元の左端と元の隙間を保ったまま」正本順に詰め直す。
 *   ブロック内の相対配置は変えない
 * - ブロックの真下に積まれ、どのシリーズとも縦で重ならないシリーズ（従属）は
 *   一緒に動かす——Git の下の GitHub を置き去りにすると辺が斜めになる。2 つ以上の
 *   メンバーの下に跨るもの・自分も帯を成すものは動かさない
 * - 並べ直しでブロックの重なりや隙間の縮みが生じたら**元の配置を返す**——
 *   ここは dagre の保証（クラスタの非重なり）を壊さない安全網であって、
 *   それ自体が配置を作る場所ではない
 */
export function orderSeriesColumns(
  positions: readonly PositionedNode[],
  options: OrderSeriesOptions,
): PositionedNode[] {
  const boxOf = (p: PositionedNode): Box => ({
    x: p.x,
    y: p.y,
    ...options.sizeOf(p.id),
  });

  // シリーズごとの外接箱
  const membersBySeries = new Map<string, PositionedNode[]>();
  for (const p of positions) {
    const series = options.seriesOf(p.id);
    if (series === undefined) continue;
    const list = membersBySeries.get(series);
    if (list) list.push(p);
    else membersBySeries.set(series, [p]);
  }
  if (membersBySeries.size < 2) return [...positions];

  const boxBySeries = new Map<string, Box>();
  for (const [series, members] of membersBySeries) {
    boxBySeries.set(series, unionBox(members.map(boxOf)));
  }
  const seriesIds = [...boxBySeries.keys()];
  const rankOf = (series: string) => {
    const i = options.seriesOrder.indexOf(series);
    // 正本順に無いシリーズは末尾扱い（出現順で安定）
    return i === -1 ? options.seriesOrder.length + seriesIds.indexOf(series) : i;
  };

  // 横帯 = 縦の重なりで繋がる連結成分
  const bandOf = new Map<string, number>();
  let bandCount = 0;
  for (const seed of seriesIds) {
    if (bandOf.has(seed)) continue;
    const band = bandCount++;
    const stack = [seed];
    bandOf.set(seed, band);
    while (stack.length > 0) {
      const current = stack.pop()!;
      const a = boxBySeries.get(current)!;
      for (const other of seriesIds) {
        if (bandOf.has(other)) continue;
        if (verticallyOverlaps(a, boxBySeries.get(other)!)) {
          bandOf.set(other, band);
          stack.push(other);
        }
      }
    }
  }

  const shiftBySeries = new Map<string, number>();
  for (let band = 0; band < bandCount; band++) {
    const members = seriesIds.filter((s) => bandOf.get(s) === band);
    if (members.length < 2) continue;

    // 従属: 真下に積まれ、この帯の他のメンバーと縦で重ならず、x が 1 メンバーとだけ重なる
    const dependentsOf = new Map<string, string[]>(members.map((m) => [m, []]));
    const bandSize = (s: string) =>
      seriesIds.filter((t) => bandOf.get(t) === bandOf.get(s)).length;
    for (const candidate of seriesIds) {
      // 2 つ以上で帯を成すシリーズは自分の帯で並べ直されるので従属にしない（二重にずれる）
      if (bandOf.get(candidate) === band || bandSize(candidate) > 1) continue;
      const c = boxBySeries.get(candidate)!;
      const parents = members.filter((m) => {
        const mb = boxBySeries.get(m)!;
        return c.y >= mb.y + mb.height && horizontallyOverlaps(c, mb);
      });
      if (parents.length === 1) dependentsOf.get(parents[0]!)!.push(candidate);
    }
    const blockBox = (m: string) =>
      unionBox([m, ...dependentsOf.get(m)!].map((s) => boxBySeries.get(s)!));

    const byX = [...members].sort(
      (a, b) => blockBox(a).x - blockBox(b).x,
    );
    const byRank = [...members].sort((a, b) => rankOf(a) - rankOf(b));
    if (byX.every((s, i) => s === byRank[i])) continue;

    // 元の左端と隙間を保って正本順に詰め直す
    const originalBoxes = byX.map(blockBox);
    const gaps = originalBoxes
      .slice(1)
      .map((b, i) => b.x - (originalBoxes[i]!.x + originalBoxes[i]!.width));
    let cursor = originalBoxes[0]!.x;
    byRank.forEach((series, i) => {
      const box = blockBox(series);
      const shift = cursor - box.x;
      for (const s of [series, ...dependentsOf.get(series)!]) {
        shiftBySeries.set(s, (shiftBySeries.get(s) ?? 0) + shift);
      }
      cursor += box.width + (gaps[i] ?? 0);
    });
  }
  if (shiftBySeries.size === 0) return [...positions];

  const shifted = positions.map((p) => {
    const series = options.seriesOf(p.id);
    const shift = series === undefined ? 0 : (shiftBySeries.get(series) ?? 0);
    return shift === 0 ? p : { ...p, x: p.x + shift };
  });

  // 安全網: 縦で重なるシリーズの組の横の隙間が、元の最小隙間を下回ったら諦める
  const minGap = (boxes: Map<string, Box>) => {
    let min = Infinity;
    for (let i = 0; i < seriesIds.length; i++) {
      for (let j = i + 1; j < seriesIds.length; j++) {
        const a = boxes.get(seriesIds[i]!)!;
        const b = boxes.get(seriesIds[j]!)!;
        if (verticallyOverlaps(a, b)) min = Math.min(min, horizontalGap(a, b));
      }
    }
    return min;
  };
  const shiftedBoxes = new Map<string, Box>();
  for (const [series, members] of membersBySeries) {
    const ids = new Set(members.map((m) => m.id));
    shiftedBoxes.set(
      series,
      unionBox(shifted.filter((p) => ids.has(p.id)).map(boxOf)),
    );
  }
  const EPSILON = 0.5;
  if (minGap(shiftedBoxes) < minGap(boxBySeries) - EPSILON) {
    return [...positions];
  }
  return shifted;
}
