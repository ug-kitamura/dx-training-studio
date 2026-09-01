"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Controls,
  MarkerType,
  MiniMap,
  MiniMapNode,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  collapseSeries,
  COLLAPSED_PREFIX,
  courseView,
  globalView,
  resolveHereNodeId,
  terminalNodes,
  TERMINAL_PREFIX,
  type MandalaGraph,
} from "@/lib/mandala/graph";
import {
  layoutFlow,
  seriesFrameRect,
  type LayoutSize,
} from "@/lib/mandala/layout";
import { anchoredViewport, type AnchorCandidate } from "@/lib/mandala/viewport";
import {
  readExpandedSeries,
  resolveInitialExpanded,
  writeExpandedSeries,
} from "@/lib/mandala/collapse-memory";
import {
  mandalaNodeTypes,
  type MandalaNodeData,
  type SeriesFrameData,
} from "@/components/workspace/mandala/nodes";
import type { EditLanguage } from "@/lib/display-name";

/**
 * dagre へ渡すノードの固定寸法。
 *
 * ⚠ `globals.css` の対応するクラスと実寸を一致させること。一致は
 * `__tests__/components/mandala-node-size-parity.test.ts` が固定しているので、
 * 片方だけ変えるとテストが落ちる（そのためだけに export している）。
 */
export const SIZES = {
  compact: { width: 240, height: 72 },
  // ミニ曼陀羅サムネイル。受講形態を載せないぶん compact より狭くできる。
  // ⚠ 狭いほうがよいのは、fitView が狭いグラフを大きい倍率で描くため
  // ——ノードを実寸で広く取ると、そのぶん縮小されてコース名が小さくなる。
  // ⚠ `globals.css` の `.dxm-node-thumbnail` と必ず同時に直すこと
  thumbnail: { width: 220, height: 56 },
  // シリーズ名・コース名・「N レッスン・約 M 分」の 3 行＋右端ラベルが収まる
  // 必要十分な寸法。キャッチを載せないぶんサイトのカード（280×140）とは別物。
  // 幅の内訳: タイトル領域 166.8 ＋ 左余白 11.2 ＋ 右の逃げ 80（5rem）＋ 枠 2 = 260。
  // ⚠ 幅と逃げは連動する。逃げだけ広げるとタイトル領域が食われて折り返しが早まる
  // ——「コース名を全角1文字ぶん広げる」なら幅にも同じ 14px を足すこと。
  // ⚠ `globals.css` の `.dxm-node-card` と必ず同時に直すこと——dagre は固定寸法を
  // 前提に座標を出すので、片方だけ変えると辺の接続位置がノードの縁からずれる
  // （一致は `__tests__/components/mandala-node-size-parity.test.ts` が固定している）
  card: { width: 260, height: 88 },
  collapsedSeries: { width: 210, height: 72 },
  terminal: { width: 90, height: 30 },
} as const;

/**
 * シリーズ枠がコース群の外へどれだけはみ出すか。
 *
 * ⚠ `x` は dagre がクラスタ間に空ける距離と暗黙に結合している。枠は外接箱を
 * 左右へ `x` ずつ広げたものなので、クラスタ間のクリアランス（実測 44px）を
 * 超える値にすると隣の枠と再び重なる。変えたときは枠の非重なりを検証する
 * `__tests__/lib/mandala-layout.test.ts` が落ちる。
 */
const FRAME_PADDING = { x: 22, top: 30, bottom: 18 };

/** 枠ノードの id 接頭辞。ミニマップから外すときの判別にも使う */
const FRAME_PREFIX = "frame:";

/**
 * ミニ曼陀羅（サムネイル・拡大モーダル）用。ノード数が少なくても実寸より拡大しない。
 * ⚠ 全体曼陀羅はこれを使わない——収めると増えたぶんだけ縮む（`lib/mandala/viewport.ts`）
 */
const FIT_VIEW_OPTIONS = { maxZoom: 1 } as const;

/**
 * 辺・矢印・接続点の丸ポチに共通の色。
 * SVG マーカーは CSS 変数を引けないので、辺側はここに直値で持つしかない。
 * ⚠ 丸ポチ側は `globals.css` の `--xy-handle-*` にあるので、変えるときは両方直す。
 */
const EDGE_COLOR = "#7a8189";

/**
 * ノードの実測が揃った時点で 1 度だけ表示位置を決める。
 *
 * ⚠ `fitView` の boolean prop は「初期化時」に走るが、**その時点ではノードの
 * 実測（`measured`）が揃っていないことがある**。揃う前の寸法で計算した位置は
 * そのまま残るため、**モーダルを開いた最初の 1 回だけ中心がずれる**という形で出る
 * （2026-08-21 に実機で報告された）。ノード数・寸法が変わらない再描画では
 * やり直されないので、コンテナのリサイズ監視だけでは埋まらない。
 *
 * ⚠ `<ReactFlow>` の子として置くこと——React Flow が内部で張るコンテキストの
 * 内側でないと `useReactFlow` / `useNodesInitialized` が使えない。
 */
function PlaceWhenNodesInitialized({
  enabled,
  place,
}: {
  enabled: boolean;
  place: (instance: ReactFlowInstance) => void;
}) {
  const initialized = useNodesInitialized();
  const instance = useReactFlow();

  useEffect(() => {
    if (!initialized || !enabled) return;
    // 観測と同一フレームで viewport を変えない
    const frame = requestAnimationFrame(() => {
      place(instance);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialized, enabled, instance, place]);

  return null;
}

/**
 * ミニマップは枠を描かない——枠はコース群と重なる大きな矩形なので、
 * そのまま出すと全面が塗り潰されてコースの配置が読めなくなる。
 */
function MandalaMiniMapNode(props: React.ComponentProps<typeof MiniMapNode>) {
  if (props.id.startsWith(FRAME_PREFIX)) return null;
  // Start / Goal も描かない——地図の目印であってコースではない
  if (props.id.startsWith(TERMINAL_PREFIX)) return null;
  return <MiniMapNode {...props} />;
}

export type MandalaProps = {
  graph: MandalaGraph;
  /**
   * 全体（全シリーズ・シリーズ枠あり）か、1 コースの周辺だけか。
   * ミニ曼陀羅にシリーズ枠は出さない——囲む対象がほぼ 1 つで意味を持たないため。
   */
  scope: { kind: "global" } | { kind: "course"; courseId: string };
  /** ノードの密度。サムネイルは compact、拡大モーダルは card */
  variant: "compact" | "card";
  /** いま選んでいるコース。青枠＋ピンで示す */
  currentCourseId?: string | null;
  /**
   * いま選んでいるシリーズ。コース未選択のときだけ意味を持ち、
   * そのシリーズ枠が現在地になる（コースの選択が優先）。
   */
  currentSeriesId?: string | null;
  /**
   * キャンバスの高さ。**CSS の絶対長だけ**を渡すこと（`720` / `"min(74vh, 720px)"`）。
   * ⚠ `"100%"` のようなパーセントを渡してはならない——ラッパの高さが確定して
   * いないので解決できず、キャンバスが 0px に潰れる。親いっぱいに広げたいときは `fill`
   */
  height?: number | string;
  /**
   * 親の高さいっぱいに広げる。`height` は無視される。
   * ツールバーを持つ面でも溢れないよう、キャンバス側が残りの高さを取る
   * （規則は `globals.css` の `.dxm-mandala-fill`）
   */
  fill?: boolean;
  onSelectCourse?: (courseId: string) => void;
  /** シリーズ枠のクリック。全体曼陀羅のみ（ミニ曼陀羅に枠は無い） */
  onSelectSeries?: (seriesId: string) => void;
  /** サムネイル用: パン・ズーム・ノードクリックを一切受けない */
  staticView?: boolean;
  /** 全体曼陀羅のみ: シリーズ折りたたみとミニマップを出す */
  showChrome?: boolean;
  /** ノード内ラベル（受講形態・件数・所要時間）の表示言語 */
  editLanguage?: EditLanguage;
};

export function Mandala({
  graph,
  scope,
  variant,
  currentCourseId = null,
  currentSeriesId = null,
  height = 560,
  fill = false,
  onSelectCourse,
  onSelectSeries,
  staticView = false,
  showChrome = false,
  editLanguage = "ja",
}: MandalaProps) {
  const isGlobal = scope.kind === "global";
  /**
   * モーダルの全体曼陀羅か。ダブルクリックの開閉と開閉状態の記憶はここだけ。
   * `showChrome` は「ツールバー・ミニマップを出す」の印だが、渡しているのは
   * `GlobalHeader` のモーダルだけなので、追加の prop は作らずこれを印にする
   */
  const isModal = isGlobal && showChrome;

  const view = useMemo(
    () =>
      scope.kind === "global"
        ? globalView(graph)
        : courseView(graph, scope.courseId),
    [graph, scope],
  );

  /** シリーズの正本順。`buildMandalaGraph` が `contents.meta.json` の order 順に積む */
  const seriesOrder = useMemo(
    () => [...new Set(view.nodes.map((n) => n.seriesId))],
    [view],
  );

  // ⚠ 持つのは**展開している** ID（`collapse-memory` の極性）。記録が無ければ空＝
  // 全折りたたみが既定になる。
  // ⚠ `useState` の初期化関数でモジュール記憶を読んでよいのは、モーダルが**開いたときに
  // クライアントでマウントされる**から。SSR の描画に関わらないので hydration は
  // 食い違わず、最初の描画から記憶どおりの姿で出る。
  // ツリーの開閉（cookie）と違う作りなのは事情が違うため——こちらはサーバーが描かない
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => {
    if (!isModal) return new Set();
    // 選択中の**コース**の所属シリーズは、記録に無くても展開して出す（現在地が隠れない）。
    // ⚠ シリーズだけを選んでいるときは展開しない——印は集約ノードが引き取るので開く
    // 必要がない。`currentSeriesId` を条件に足さないこと
    const expand =
      view.nodes.find((n) => n.id === currentCourseId)?.seriesId ?? null;
    return resolveInitialExpanded(readExpandedSeries("studio-modal"), expand);
  });
  // 保存は state の変化を見る 1 本。トグルの呼び出し側に書くと足し忘れる。
  // 復元直後の 1 回も走り、選択コースによる展開がそのまま記憶される
  useEffect(() => {
    if (isModal) writeExpandedSeries("studio-modal", expandedIds);
  }, [isModal, expandedIds]);
  const [interactive, setInteractive] = useState(false);

  /**
   * グラフ側は「畳んでいる側」で受け取る。記憶の極性との変換はここ1か所。
   * ⚠ 開閉を持つのはモーダルだけ。それ以外の面（ミニ曼陀羅・chrome 無しの全体）は
   * **畳まない**——空集合を返すこと。展開側の空集合をそのまま反転すると「全部畳む」に
   * なり、開閉を持たないはずの面が空になる
   */
  const collapsedIds = useMemo(
    () =>
      isModal
        ? new Set(seriesOrder.filter((id) => !expandedIds.has(id)))
        : new Set<string>(),
    [isModal, seriesOrder, expandedIds],
  );

  /**
   * 「マウントした時点で全シリーズが畳まれていた」札。立っている間だけ、全体曼陀羅の
   * 初期表示をグラフ全体が収まる形（`fitView`）にする。
   *
   * ⚠ 判定は**畳んでいる集合が全シリーズを覆うか**で書く。記憶の極性は展開している側
   * だが、開閉を持たない面（ミニ曼陀羅・chrome 無しの全体）は「展開集合が空」でありながら
   * 実際には**全展開**なので、展開側で判定すると裏返る。
   *
   * ⚠ **一度でも開閉したら落とし、以後は復帰しない**（`toggleSeries` が落とす）。
   * 「いま全部畳まれているか」を配置のたびに見る作りにしてはならない——閲覧者が畳み直す
   * たびに倍率が勝手に変わる。加えて、札を立てたまま展開すると大きくなったグラフを
   * 収めにいって豆粒になる（`lib/mandala/viewport.ts` 冒頭の経緯そのもの）。
   */
  const [fitCollapsed, setFitCollapsed] = useState(
    () => seriesOrder.length > 0 && collapsedIds.size === seriesOrder.length,
  );

  const collapsible = useMemo(
    () =>
      isGlobal
        ? collapseSeries(view, collapsedIds)
        : { ...view, collapsed: [] },
    [view, collapsedIds, isGlobal],
  );

  const { nodes, edges } = useMemo(() => {
    // 折りたたみ中は現在地のコースが消えるので、印は集約ノードへ移る
    const hereNodeId = resolveHereNodeId(
      view,
      collapsible.collapsed,
      currentCourseId,
    );

    // 全体曼陀羅は宣言している全てのコースに Start / Goal を置く。畳まれた
    // シリーズのコースが宣言しているときは、辺を集約ノードへ繋ぎ替える。
    //
    // ミニ曼陀羅は**中心コース自身の宣言だけ**を拾う——映しているのは中心と
    // その隣接 1 段なので、隣のコースの宣言まで拾うと「2 段先」の情報が混じる。
    // 例: 入口のコースを開けば 1 個前として Start が出るが、その次のコースを
    // 開いたときは 1 個前のコースだけが出て、その手前の Start は出ない。
    const collapsedIdBySeries = new Map(
      collapsible.collapsed.map((c) => [c.seriesId, c.id]),
    );
    const terminalSources =
      scope.kind === "global"
        ? view.nodes
        : view.nodes.filter((n) => n.id === scope.courseId);
    const { terminals, edges: terminalEdges } = terminalNodes(
      terminalSources,
      (courseId) => {
        const node = view.nodes.find((n) => n.id === courseId);
        return (node && collapsedIdBySeries.get(node.seriesId)) ?? courseId;
      },
    );

    // 接続点の丸ポチは「辺が出ていく側」にだけ出す
    const outgoing = new Set(
      [...collapsible.edges, ...terminalEdges].map((edge) => edge.source),
    );

    // シリーズ自身を選んでいるときは、そのシリーズ枠が現在地になる。
    // ⚠ コースの選択が優先——コースを選ぶと所属シリーズも選択状態になるので、
    // 両方に印が付くと「いまここ」が 2 つあるように見える。
    // 折りたたみ中は枠が無いので、印は下の集約ノードが引き取る
    const hereSeriesId = hereNodeId ? null : (currentSeriesId ?? null);

    // ⚠ `variant === "compact"` は全体曼陀羅と共通なので、scope と組で判定すること。
    // サムネイルは密度が違う（幅が狭い・受講形態を載せない・コース名を中央ぞろえ）
    // ので、ノード種別そのものを分ける
    const nodeVariant: keyof typeof SIZES =
      scope.kind === "course" && variant === "compact" ? "thumbnail" : variant;

    // 受講形態のラベルはサムネイルには載せない——セルが小さく、ラベルがコース名の
    // 幅を奪って省略が早く始まる。周辺の並びだけ分かればよい面なので、
    // 受講形態は拡大モーダル（card）と全体曼陀羅（compact）に任せる
    const showStyle = nodeVariant !== "thumbnail";

    const entries: Array<{
      id: string;
      type: keyof typeof SIZES;
      data: MandalaNodeData;
      seriesId: string;
    }> = [
      ...collapsible.nodes.map((node) => ({
        id: node.id,
        type: nodeVariant,
        seriesId: node.seriesId,
        data: {
          label: node.label,
          seriesName: node.seriesName,
          lessonCount: node.lessonCount,
          totalMinutes: node.totalMinutes,
          style: showStyle ? node.style : undefined,
          language: editLanguage,
          ghost: node.ghost,
          current: node.current,
          here: node.id === hereNodeId,
          hasOutgoing: outgoing.has(node.id),
        } satisfies MandalaNodeData,
      })),
      ...collapsible.collapsed.map((series) => ({
        id: series.id,
        type: "collapsedSeries" as const,
        seriesId: series.seriesId,
        data: {
          label: series.seriesName,
          seriesName: series.seriesName,
          lessonCount: series.lessonCount,
          totalMinutes: series.totalMinutes,
          language: editLanguage,
          ghost: false,
          current: false,
          // 畳まれたシリーズは枠を持たないので、シリーズ自身の現在地も引き取る
          here: series.id === hereNodeId || series.seriesId === hereSeriesId,
          hasOutgoing: outgoing.has(series.id),
          collapsed: { courseCount: series.courseCount },
        } satisfies MandalaNodeData,
      })),
    ];
    // ⚠ 集約ノードを末尾に回したまま渡してはならない——dagre は交差最小化の同点を
    // 挿入順で決めるので、畳んだシリーズが右端へ移る（2026-08-24 に実機で確認）。
    // シリーズの正本順（`view.nodes` の初出順＝ツールバーのチップ順）に並べ替える
    const seriesRank = new Map(seriesOrder.map((id, i) => [id, i]));
    entries.sort(
      (a, b) =>
        (seriesRank.get(a.seriesId) ?? Infinity) -
        (seriesRank.get(b.seriesId) ?? Infinity),
    );

    const typeById = new Map<string, keyof typeof SIZES>([
      ...entries.map((e) => [e.id, e.type] as const),
      ...terminals.map((t) => [t.id, "terminal"] as const),
    ]);
    const sizeOf = (id: string): LayoutSize =>
      SIZES[typeById.get(id) ?? nodeVariant];

    // シリーズをレイアウトのまとまりとして dagre へ渡すのは**全体曼陀羅だけ**。
    // これが無いと dagre はシリーズを知らないまま配置するので、同じシリーズの
    // コースが他シリーズを挟んで置かれ、後段で求めるシリーズ枠が食い込む。
    // ミニ曼陀羅は枠を描かないので、まとまり化する理由が無い。
    // 折りたたみ中のシリーズ（集約ノード）と Start / Goal は枠を持たないので外す。
    const seriesIdByNode = new Map(entries.map((e) => [e.id, e.seriesId]));
    const clusterOf = isGlobal
      ? (id: string) => {
          const seriesId = seriesIdByNode.get(id);
          if (seriesId === undefined || collapsedIds.has(seriesId)) {
            return undefined;
          }
          return seriesId;
        }
      : undefined;

    const positions = layoutFlow(
      [...entries.map((e) => e.id), ...terminals.map((t) => t.id)],
      [...collapsible.edges, ...terminalEdges],
      {
        size: SIZES[nodeVariant],
        sizeOf,
        clusterOf,
        // 横順の固定（全体曼陀羅だけ）。挿入順だけでは跨ぎの辺の重心で入れ替わりうる
        // ので、配置後にシリーズのブロック単位で正本順へ並べ直す。集約ノードも
        // そのシリーズとして数える（枠は無いが並びの上では同じシリーズの姿）
        ...(isGlobal
          ? { seriesOf: (id: string) => seriesIdByNode.get(id), seriesOrder }
          : {}),
      },
    );
    const positionById = new Map(positions.map((p) => [p.id, p]));

    const terminalFlowNodes: Node[] = terminals.map((terminal) => ({
      id: terminal.id,
      type: "terminal" as const,
      position: positionById.get(terminal.id) ?? { x: 0, y: 0 },
      ...SIZES.terminal,
      data: {
        label: terminal.kind === "start" ? "Start" : "Goal",
        // Goal からは辺が出ていかないので、下辺の点は出さない
        hasOutgoing: outgoing.has(terminal.id),
      },
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: false,
    }));

    const courseNodes: Node[] = entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      position: positionById.get(entry.id) ?? { x: 0, y: 0 },
      // ミニマップは実測値ではなくノードの寸法を見るので、確定値を明示する
      ...sizeOf(entry.id),
      data: entry.data as unknown as Record<string, unknown>,
      draggable: false,
      connectable: false,
    }));

    // シリーズ枠は全体曼陀羅だけ。React Flow の親子関係は使わない——dagre の
    // 絶対座標と二重管理になるため、レイアウト結果から矩形を求めて背後に敷く
    const framedSeriesIds = isGlobal
      ? [...new Set(entries.map((e) => e.seriesId))]
      : [];

    const frameNodes: Node[] = framedSeriesIds.flatMap((seriesId) => {
      // 折りたたみ中のシリーズは集約ノード 1 つなので枠を描かない
      if (collapsedIds.has(seriesId)) return [];
      const members = entries.filter((e) => e.seriesId === seriesId);
      if (members.length === 0) return [];

      const rect = seriesFrameRect(
        members.map((m) => {
          const p = positionById.get(m.id) ?? { x: 0, y: 0 };
          const size = sizeOf(m.id);
          return { x: p.x, y: p.y, width: size.width, height: size.height };
        }),
        FRAME_PADDING,
      );
      if (!rect) return [];

      return [
        {
          id: `${FRAME_PREFIX}${seriesId}`,
          type: "seriesFrame" as const,
          position: { x: rect.x, y: rect.y },
          width: rect.width,
          height: rect.height,
          data: {
            seriesName: members[0]!.data.seriesName,
            width: rect.width,
            height: rect.height,
            here: seriesId === hereSeriesId,
            language: editLanguage,
          } satisfies SeriesFrameData as unknown as Record<string, unknown>,
          draggable: false,
          connectable: false,
          selectable: false,
          focusable: false,
          // コースノードより後ろに敷く
          zIndex: -1,
        },
      ];
    });

    // ⚠ 順序辺と跨ぎ辺を線種で区別しない。animated な辺はそれ自体が
    // 流れる破線として描かれるため、跨ぎだけ dasharray を変えても目視できず、
    // 区別を主張するコードとコメントが実態と食い違うだけになる
    const flowEdges: Edge[] = [
      ...collapsible.edges,
      ...terminalEdges,
    ].map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: true,
      // 進む方向を指す矢印。色は線に揃える（既定は薄いグレーで線から浮く）
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: EDGE_COLOR,
      },
      style: { stroke: EDGE_COLOR },
      className: "dxm-edge",
    }));

    return {
      nodes: [...frameNodes, ...courseNodes, ...terminalFlowNodes],
      edges: flowEdges,
    };
  }, [
    view,
    collapsible,
    variant,
    scope,
    isGlobal,
    seriesOrder,
    collapsedIds,
    currentCourseId,
    currentSeriesId,
    editLanguage,
  ]);

  const courseIds = useMemo(
    () => new Set(collapsible.nodes.map((n) => n.id)),
    [collapsible],
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // ⚠ コースノードだけは staticView（サムネイル）でも処理する——React Flow の
      // ノードは `pointer-events: all` で祖先の pointer-events-none を上書きして
      // 独立にクリックを検知できるので、サムネイル上のコースブロックだけ直接
      // 遷移させられる。DOM 上ではこのクリックがそのまま親のボタン（拡大モーダルを
      // 開く）までバブリングするため、ここで止めないと遷移とモーダルが同時に起きる
      if (courseIds.has(node.id)) {
        if (node.id !== currentCourseId) {
          onSelectCourse?.(node.id);
        }
        // 中心（現在選択中）のコース自身は遷移先が無いので何もしない
        event.stopPropagation();
        return;
      }
      if (staticView) return;
      // シリーズ枠はそのシリーズを選ぶ。枠の中でもコースノードの上ではコースが
      // 優先される——z-index で決まっており（コース 0 / 枠 -1）、上の分岐に入る
      if (node.id.startsWith(FRAME_PREFIX)) {
        onSelectSeries?.(node.id.slice(FRAME_PREFIX.length));
        return;
      }
      // 折りたたんだシリーズの集約ノードも同じくシリーズを選ぶ
      // ——展開時の枠と畳んだときの集約は同じシリーズの 2 つの姿なので、
      // クリックの意味も揃える
      if (node.id.startsWith(COLLAPSED_PREFIX)) {
        onSelectSeries?.(node.id.slice(COLLAPSED_PREFIX.length));
      }
    },
    [courseIds, currentCourseId, onSelectCourse, onSelectSeries, staticView],
  );

  /**
   * ツールバーのチップとダブルクリックの両方から呼ぶ。
   * ⚠ 持っているのは**展開している** ID の集合なので、`has` は「展開中」の意味
   */
  const toggleSeries = useCallback((seriesId: string) => {
    // 収める初期表示の札を落とす。畳み直しても復帰しない（上の宣言の理由）
    setFitCollapsed(false);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seriesId)) next.delete(seriesId);
      else next.add(seriesId);
      return next;
    });
  }, []);

  /**
   * シリーズ枠・集約ノードのダブルクリックで開閉をトグルする（モーダルだけ）。
   * 1 回目のクリックは `onNodeClick` でシリーズの選択になる——これは許容と決めた。
   * コースノードは対象外（1 回目で既に遷移している）。
   * ⚠ `zoomOnDoubleClick` は false にしてあるので、ズームは起きない
   */
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!isModal || staticView) return;
      const seriesId = node.id.startsWith(FRAME_PREFIX)
        ? node.id.slice(FRAME_PREFIX.length)
        : node.id.startsWith(COLLAPSED_PREFIX)
          ? node.id.slice(COLLAPSED_PREFIX.length)
          : null;
      if (seriesId !== null) toggleSeries(seriesId);
    },
    [isModal, staticView, toggleSeries],
  );

  const seriesList = useMemo(
    () =>
      [...new Map(graph.nodes.map((n) => [n.seriesId, n.seriesName])).entries()],
    [graph],
  );

  /**
   * コンテナの寸法が確定したとき・変わったときに曼陀羅の表示位置を決め直す。
   *
   * ⚠ `fitView` の boolean prop は**初期化時の一度きり**で、options では変えられない。
   * モーダルは開いた直後にフレックスがキャンバスを縮めることがあり、初回の寸法と
   * 最終的な寸法が食い違ったぶんがそのままずれとして残っていた。
   */
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ReactFlowInstance | null>(null);
  // 監視を張り替えずにコールバックから読むためのミラー
  // （render 中の代入は破棄された render の値が残りうるため effect で書く）
  const interactiveRef = useRef(interactive);
  useEffect(() => {
    interactiveRef.current = interactive;
  }, [interactive]);

  /** 基準ノードの解決に要る幾何だけを取り出す（React Flow の型を純関数へ持ち込まない） */
  const anchorCandidates = useMemo<AnchorCandidate[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        here: Boolean((n.data as { here?: boolean }).here),
        x: n.position.x,
        y: n.position.y,
        width: n.width ?? 0,
        height: n.height ?? 0,
      })),
    [nodes],
  );

  /**
   * 表示位置の決定は 1 か所に集約する（初回とリサイズで見え方が変わらないように）。
   *
   * - **全体曼陀羅**: 等倍のまま基準ノードへ寄せる。収めると増えたぶんだけ縮むため
   * - **ミニ曼陀羅**: 従来どおり収める。コース 1 件と隣接だけで大きさが増えない
   * - **全体曼陀羅で `fitCollapsed` が立っている間**: 例外として収める。畳んだ姿は
   *   シリーズ数ぶんしか大きくならないので、収めても地図として読める
   */
  const placeView = useCallback(
    (instance: ReactFlowInstance) => {
      if (!isGlobal || fitCollapsed) {
        void instance.fitView(FIT_VIEW_OPTIONS);
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      // 寸法が未確定のうちに置くと画面外へ飛ぶ。リサイズ監視が拾い直す
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
      const viewport = anchoredViewport(anchorCandidates, {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      });
      if (viewport) void instance.setViewport(viewport);
    },
    [isGlobal, fitCollapsed, anchorCandidates],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      // ⚠ 寸法の観測と同一フレームで viewport を変えない
      // （"ResizeObserver loop completed with undelivered notifications" が出る）
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // パン・ズームを始めたあとに合わせ直すと操作を巻き戻すことになる。
        // サムネイル（staticView）は操作を受けないので常に合わせ直してよい
        if (!staticView && interactiveRef.current) return;
        const instance = instanceRef.current;
        if (instance) placeView(instance);
      });
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [staticView, placeView]);

  if (nodes.length === 0) return null;

  const canPan = !staticView && interactive;

  return (
    <div className={fill ? "dxm-mandala dxm-mandala-fill" : "dxm-mandala"}>
      {showChrome && (
        <div className="dxm-mandala-toolbar">
          {seriesList.map(([seriesId, seriesName]) => {
            const collapsed = collapsedIds.has(seriesId);
            return (
              <button
                key={seriesId}
                type="button"
                className="dxm-mandala-toggle"
                aria-pressed={collapsed}
                onClick={() => toggleSeries(seriesId)}
              >
                {collapsed ? "▸" : "▾"} {seriesName}
              </button>
            );
          })}
        </div>
      )}
      <div
        ref={canvasRef}
        className="dxm-mandala-canvas"
        // fill のときは高さを CSS（`.dxm-mandala-fill`）が決める
        style={fill ? undefined : { height }}
        // クリックするまではスクロールを優先する
        onClick={() => {
          if (!staticView) setInteractive(true);
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={mandalaNodeTypes}
          // ミニ曼陀羅だけ React Flow の初回フィットに任せる。全体曼陀羅は
          // 等倍配置なので、ここでフィットさせると一瞬縮んでから跳ねる。
          // ⚠ `fitCollapsed` が立っていてもここは false のまま——初回は下の
          // `onInit` の `placeView` が同じ options で収める。両方に持たせると
          // 同じフレームで 2 回フィットすることになり、片方だけ直したときに
          // ずれる（この prop は初期化時の一度きりで options も変えられない）
          fitView={!isGlobal}
          fitViewOptions={FIT_VIEW_OPTIONS}
          onInit={(instance) => {
            instanceRef.current = instance;
            // ⚠ 計測（`useNodesInitialized`）を待たずにも一度置く。基準の算出は
            // dagre の座標と固定寸法だけで足り、実測を必要としない——待つ経路しか
            // 持たないと、計測が完了しない環境で配置ごと効かなくなる
            placeView(instance);
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          zoomOnScroll={canPan}
          preventScrolling={canPan}
          panOnDrag={canPan}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={isModal ? onNodeDoubleClick : undefined}
        >
          {/* パン・ズームを始めたあとは置き直さない（操作を巻き戻さない）。
              サムネイルは操作を受けないので常に置き直してよい */}
          <PlaceWhenNodesInitialized
            enabled={staticView || !interactive}
            place={placeView}
          />
          {/* 背景の格子は敷かない。ミニマップ・Controls の配色は globals.css の
              `--xy-*` が持つ（props で渡すとインラインになり上書きできない） */}
          {showChrome && (
            <MiniMap pannable zoomable nodeComponent={MandalaMiniMapNode} />
          )}
          {canPan && <Controls showInteractive={false} />}
        </ReactFlow>
      </div>
    </div>
  );
}
