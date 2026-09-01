/**
 * 全体曼陀羅の初期表示位置（純関数）。React Flow に依存しない。
 *
 * ⚠ 公開サイト `mandala/lib/mandala/viewport.ts` と同じ内容をコピーで持つ。
 * 両アプリは互いの node_modules・ソースに依存しない規約（入れ物 CLAUDE.md、
 * CI が検証）があるため共有できない。**片方を直したら必ずもう片方も直すこと。**
 *
 * ## なぜ fitView をやめたか
 *
 * `fitView` はグラフの外接箱をキャンバスに縦横とも収めるので、倍率が
 * `min(1, 幅比, 高さ比)` になる。曼陀羅はシリーズ・コースが増えるほど縦にも横にも
 * 伸びるため、収め続けると**コンテンツが増えるほどノードが小さくなり**、最後は
 * 豆粒になって地図として読めなくなる（実測: ノードを 200x52 から 240x72 へ広げた
 * 時点で、サイトのホームは既に 0.83 倍で描かれていた）。
 *
 * 代わりに**コンテンツ量に依存しない固定倍率**（`GLOBAL_DEFAULT_ZOOM`）で描き、
 * 基準ノードが見える位置へ寄せる。収まらないぶんは縦横とも切れてよい
 * ——閲覧者がパン・ズーム・ミニマップで見る。
 *
 * ## ただし全折りたたみのときだけは収める
 *
 * 上の判断は**全展開を前提**にしていた。既定が全折りたたみになってからは、畳んだ姿の
 * 大きさが**シリーズ数ぶんしか増えない**ので、収めても豆粒にならない（実測: シリーズ 6 本を
 * 畳んだ外接箱は約 774 × 756。`rankdir: TB` なので常に縦が制約になり、キャンバス
 * 640〜720 に対して収める倍率は 0.84 前後——固定倍率の 0.833 とほとんど変わらない）。
 * いま `Goal` が切れているのは倍率のせいではなく、`Start` を上端そろえにして下へ
 * 押し出しているためである。
 *
 * そこで**マウント時に全シリーズが畳まれていたときだけ**、初期表示を `fitView`
 * （上限 1・ミニ曼陀羅と同じ）にする。判定と札は呼び出し側（`Mandala.tsx`）が持ち、
 * この純関数は関与しない。**一度でも開閉したら札は落ち、以後は復帰しない**
 * ——畳み直すたびに倍率が変わるのを避けるためと、札を立てたまま展開すると
 * 大きくなったグラフを収めにいって上の「豆粒」が再現するため。
 *
 * ⚠ **収める倍率に下限は設けていない。** いまのシリーズ数では下限が効く場面が無く、
 * 予防的な分岐を持つと規則が読みにくくなるという判断（2026-08-26）。シリーズが倍に
 * 増えれば 0.5 倍前後まで落ちて読めなくなるが、そのときは畳んだ既定の姿そのものを
 * 見直すはずなので、ここに下限を足す前にまずそちらを疑うこと。
 */

/** 入口・到達点の文字ノードのうち、入口側の ID 前缀（`graph.ts` の採番と対応） */
const START_NODE_PREFIX = "terminal:start:";

/** 上端そろえのときに残す余白 */
export const ANCHOR_TOP_MARGIN = 24;

/**
 * 全体曼陀羅の既定ズーム倍率。等倍から **1 段階だけ** 縮んだ状態で開く。
 *
 * React Flow の `zoomIn` / `zoomOut`（Controls のボタン）は既定で 1.2 倍ステップなので、
 * `1 / 1.2` にしておくとズームインを 1 回押してちょうど等倍へ戻れる。0.8 のような
 * 丸い値だと 0.96 という半端な倍率に着地して、等倍に合わせ直せない。
 *
 * ⚠ グラフ全体を収める（`fitView`）ための可変倍率ではない。収めるとコンテンツが
 * 増えるほどノードが縮み、地図として読めなくなる（このファイル冒頭の経緯）。
 */
export const GLOBAL_DEFAULT_ZOOM = 1 / 1.2;

export type AnchorCandidate = {
  id: string;
  /** 現在地（ここが最優先の基準になる） */
  here?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasSize = { width: number; height: number };

export type AnchoredViewport = { x: number; y: number; zoom: number };

type Box = { minX: number; minY: number; maxX: number; maxY: number };

function boundsOf(nodes: readonly AnchorCandidate[]): Box | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return { minX, minY, maxX, maxY };
}

export type AnchorKind = "here" | "start" | "graph";

/**
 * 基準の解決順は「現在地 → `Start` → グラフ全体」。
 *
 * ⚠ `Start` は**複数宣言できる**（入口が違えば始まりの時点も違うので 1 つに
 * 集約しない、というカリキュラム側の決定）。該当する全ノードの合成外接箱を使えば
 * 1 件でも N 件でも同じ式で扱える。
 */
export function resolveAnchor(nodes: readonly AnchorCandidate[]): {
  kind: AnchorKind;
  bounds: Box;
} | null {
  const here = nodes.filter((n) => n.here);
  if (here.length > 0) {
    const bounds = boundsOf(here);
    if (bounds) return { kind: "here", bounds };
  }

  const starts = nodes.filter((n) => n.id.startsWith(START_NODE_PREFIX));
  if (starts.length > 0) {
    const bounds = boundsOf(starts);
    if (bounds) return { kind: "start", bounds };
  }

  const bounds = boundsOf(nodes);
  return bounds ? { kind: "graph", bounds } : null;
}

/**
 * 固定倍率で基準ノードを置く viewport を返す。ノードが無ければ `null`。
 *
 * - **現在地が基準のとき**: 縦横とも中央。現在地はグラフのどの段にもありうるので、
 *   中央が最も見やすい
 * - **`Start`（または全体）が基準のとき**: 横は中央・縦は上端そろえ。`Start` は必ず
 *   グラフの最上段にあるため、縦中央に据えると上半分が空白になる
 *
 * ⚠ 位置の式には**必ず倍率を掛ける**こと。React Flow の viewport は
 * 「画面座標 = x + zoom × ワールド座標」なので、倍率だけ変えて式を等倍のまま
 * 置くと基準ノードが画面の中心からずれる。
 */
export function anchoredViewport(
  nodes: readonly AnchorCandidate[],
  canvas: CanvasSize,
  topMargin: number = ANCHOR_TOP_MARGIN,
  zoom: number = GLOBAL_DEFAULT_ZOOM,
): AnchoredViewport | null {
  const anchor = resolveAnchor(nodes);
  if (!anchor) return null;

  const { bounds, kind } = anchor;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const x = canvas.width / 2 - zoom * centerX;

  if (kind === "here") {
    const centerY = (bounds.minY + bounds.maxY) / 2;
    return { x, y: canvas.height / 2 - zoom * centerY, zoom };
  }

  return { x, y: topMargin - zoom * bounds.minY, zoom };
}
