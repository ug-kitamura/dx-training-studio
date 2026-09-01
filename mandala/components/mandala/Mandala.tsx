"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  globalView,
  collapseSeries,
  COLLAPSED_PREFIX,
  isSeriesFrameHere,
  resolveHereNodeId,
  terminalNodes,
  TERMINAL_PREFIX,
} from "@/lib/mandala/graph";
import type { CurrentLocation } from "@/lib/current-course";
import {
  readExpandedSeries,
  resolveInitialExpanded,
  writeExpandedSeries,
  type MandalaSurface,
} from "@/lib/mandala/collapse-memory";
import {
  layoutFlow,
  seriesFrameRect,
  type LayoutSize,
} from "@/lib/mandala/layout";
import { anchoredViewport, type AnchorCandidate } from "@/lib/mandala/viewport";
import {
  mandalaNodeTypes,
  type MandalaNodeData,
  type SeriesFrameData,
} from "./nodes";
import { data as siteData, localized } from "@/lib/site-data";
import { localizedHref, type Locale } from "@/lib/locale-path";

const SIZES = {
  compact: { width: 240, height: 72 },
  card: { width: 280, height: 140 },
  collapsedSeries: { width: 210, height: 72 },
  terminal: { width: 90, height: 30 },
} as const;

/**
 * シリーズ枠がコース群の外へどれだけはみ出すか。
 *
 * ⚠ `x` は dagre がクラスタ間に空ける距離と暗黙に結合している。枠は外接箱を
 * 左右へ `x` ずつ広げたものなので、クラスタ間のクリアランス（実測 44px）を
 * 超える値にすると隣の枠と再び重なる。変えたときは枠の非重なりを検証する
 * `__tests__/mandala-layout.test.ts` が落ちる。
 */
const FRAME_PADDING = { x: 22, top: 30, bottom: 18 };

/** 枠ノードの id 接頭辞。ミニマップから外すときの判別にも使う */
const FRAME_PREFIX = "frame:";

/**
 * ⚠ 全体曼陀羅は原則 `fitView` を使わない。収めるとコンテンツが増えるほどノードが
 * 縮み、地図として読めなくなる（`lib/mandala/viewport.ts` に機構と実測値）。
 * 等倍のまま基準ノードへ寄せ、収まらないぶんは縦横とも切れてよい。
 *
 * 例外は**マウント時に全シリーズが畳まれていたとき**だけ（`fitCollapsed`）。
 * 畳んだ姿はシリーズ数ぶんしか大きくならないので、収めても地図として読める。
 */

/**
 * 収めるときのオプション。ノード数が少なくても実寸より拡大しない。
 * ⚠ Studio（`studio/components/workspace/mandala/Mandala.tsx`）と同名・同値で持つ。
 */
const FIT_VIEW_OPTIONS = { maxZoom: 1 } as const;

/**
 * 辺・矢印・接続点の丸ポチに共通の色。
 *
 * SVG マーカーは CSS 変数を引けないので、辺側はここに直値で持つしかない。
 * ⚠ **丸ポチ側は `globals.css` の `--xy-handle-*` にあるので、変えるときは両方直す。**
 *
 * 値は「ライトの地（≒ #f7f7f7）とダークの地（≒ #1a1a1a）に対して同じくらいの
 * コントラストになる明度」から決めている（相対輝度 ≒ 0.21 → どちらも約 4:1）。
 * 片方に寄せると、もう片方のテーマで沈むか浮くかする。
 */
const EDGE_COLOR = "#7a8189";

/**
 * ノードの実測が揃った時点で 1 度だけ表示位置を決め直す。
 *
 * ⚠ **`onInit` の一度きりでは収める配置（`fitView`）が空振りする。** その時点では
 * React Flow の内部ストアにノードが入っておらず、外接箱が出ないため何も起きない
 * （実測: 全折りたたみで開いても `translate(0,0) scale(1)` のまま残る）。基準ノード配置は
 * こちらの `nodes` 配列と dagre の座標だけで足りるので露見しなかったが、収める配置は
 * ストアに依存する。
 *
 * ⚠ `<ReactFlow>` の子として置くこと——React Flow が内部で張るコンテキストの
 * 内側でないと `useReactFlow` / `useNodesInitialized` が使えない。
 * ⚠ Studio（`studio/components/workspace/mandala/Mandala.tsx`）に同じ手当てがある。
 * 相互依存禁止の規約によりコピーで持つので、直すときは両方直すこと。
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

/** 全体曼陀羅は一覧性を優先して compact ノードで描く */
const VARIANT = "compact" as const;
const DEFAULT_HEIGHT = 640;

export type MandalaProps = {
  scope: { kind: "global" };
  locale?: Locale;
  /** 既定の高さを上書きする。モーダルは vh で渡す */
  height?: number | string;
  /**
   * 「いまここ」を出す位置（コースまたはシリーズ）。モーダルがパスから解いて渡す。
   * ViewNode の `current`（scope 内かどうか）とは別の意味なので独立して持つ。
   */
  currentLocation?: CurrentLocation | null;
  /**
   * ナビバーから開くモーダルか。**モーダルだけの振る舞い**（シリーズ枠のダブル
   * クリックで開閉・シリーズ枠のクリックで遷移）はこのフラグにぶら下げる。
   * ⚠ `currentLocation` の有無で推測しない——「モーダルである」と「現在地がある」は
   * 別の事実で、将来ホームに現在地を出しても壊れないようにする。
   * ⚠ 開閉の**記憶はどちらの面も持つ**。ぶら下げるのはスロットの選び分けだけで、
   * 「モーダルだけ記憶する」ではない
   */
  modal?: boolean;
};

// `scope` は Props の契約としては残すが、global 固定の現状は中で使わない
export function Mandala({
  locale = "ja",
  height,
  currentLocation = null,
  modal = false,
}: MandalaProps) {
  const router = useRouter();
  const [interactive, setInteractive] = useState(false);

  const variant = VARIANT;
  const canvasHeight = height ?? DEFAULT_HEIGHT;

  const view = useMemo(() => globalView(siteData.mandala), []);

  /** シリーズの正本順。`buildMandalaGraph` がサイトデータのシリーズ順に積む */
  const seriesOrder = useMemo(
    () => [...new Set(view.nodes.map((n) => n.seriesSlug))],
    [view],
  );

  /** 記憶のスロット。ホームとモーダルは互いに独立 */
  const surface: MandalaSurface = modal ? "site-modal" : "site-home";

  // ⚠ 持つのは**展開している** slug（`collapse-memory` の極性）。記録が無ければ空＝
  // 全折りたたみが既定になる。
  // ⚠ `useState` の初期化関数でモジュール記憶を読んでよいのは、曼陀羅が**クライアントで
  // マウントされる**から（`LazyMandala` は `ssr: false`）。SSR の描画に関わらないので
  // hydration は食い違わず、最初の描画から記憶どおりの姿で出る
  const [expandedSlugs, setExpandedSlugs] = useState<ReadonlySet<string>>(() => {
    // 現在地が**コース・レッスン**のときだけ、その所属シリーズを展開して出す
    // （集約ノードに隠れた地図を開いても役に立たない）。
    // ⚠ 現在地がシリーズトップ（`kind === "series"`）のときは展開しない——印は集約
    // ノードが引き取るので開く必要がなく、閲覧者はシングルクリックで開ける
    const expand =
      currentLocation?.kind === "course"
        ? (view.nodes.find((n) => n.id === currentLocation.courseId)
            ?.seriesSlug ?? null)
        : null;
    return resolveInitialExpanded(readExpandedSeries(surface), expand);
  });
  // 保存は state の変化を見る 1 本。復元直後の 1 回も走り、現在地による展開が
  // そのまま記憶される（最後に見た姿が次に出る）
  useEffect(() => {
    writeExpandedSeries(surface, expandedSlugs);
  }, [surface, expandedSlugs]);

  /** グラフ側は「畳んでいる側」で受け取る。記憶の極性との変換はここ1か所 */
  const collapsedSlugs = useMemo(
    () => new Set(seriesOrder.filter((slug) => !expandedSlugs.has(slug))),
    [seriesOrder, expandedSlugs],
  );

  /**
   * 「マウントした時点で全シリーズが畳まれていた」札。立っている間だけ、初期表示を
   * グラフ全体が収まる形（`fitView`）にする。
   *
   * ⚠ 判定は**畳んでいる集合が全シリーズを覆うか**で書く。記憶の極性は展開している側
   * だが、開閉を持たない面は「展開集合が空」でありながら実際には**全展開**なので、
   * 展開側で判定すると裏返る。
   *
   * ⚠ **一度でも開閉したら落とし、以後は復帰しない**（`toggleSeries` が落とす）。
   * 「いま全部畳まれているか」を配置のたびに見る作りにしてはならない——閲覧者が畳み直す
   * たびに倍率が勝手に変わる。加えて、札を立てたまま展開すると大きくなったグラフを
   * 収めにいって豆粒になる（`lib/mandala/viewport.ts` 冒頭の経緯そのもの）。
   *
   * ⚠ Studio 側に同じ手当てがある。相互依存禁止の規約によりコピーで持つので、
   * 直すときは両方直すこと。
   */
  const [fitCollapsed, setFitCollapsed] = useState(
    () => seriesOrder.length > 0 && collapsedSlugs.size === seriesOrder.length,
  );

  const collapsible = useMemo(
    () => collapseSeries(view, collapsedSlugs),
    [view, collapsedSlugs],
  );

  const { nodes, edges } = useMemo(() => {
    // 折りたたみ中は現在地のコースが消えるので、印は集約ノードへ移る。
    // コースノードと集約ノードをこの1つの ID と突き合わせれば足りる
    const hereNodeId = resolveHereNodeId(
      view,
      collapsible.collapsed,
      currentLocation,
    );

    // Start / Goal は全体曼陀羅だけに置く。畳まれたシリーズのコースが宣言している
    // ときは、辺を集約ノードへ繋ぎ替える
    const collapsedIdBySlug = new Map(
      collapsible.collapsed.map((c) => [c.seriesSlug, c.id]),
    );
    const { terminals, edges: terminalEdges } = terminalNodes(
      view.nodes,
      (courseId) => {
        const node = view.nodes.find((n) => n.id === courseId);
        return (node && collapsedIdBySlug.get(node.seriesSlug)) ?? courseId;
      },
    );

    // 接続点の丸ポチは「辺が出ていく側」にだけ出す。どこにも繋がっていない点は
    // 意味を持たないので消す——判定に辺の一覧が要るため CSS では書けない
    const outgoing = new Set(
      [...collapsible.edges, ...terminalEdges].map((edge) => edge.source),
    );

    const entries: Array<{
      id: string;
      type: keyof typeof SIZES;
      data: MandalaNodeData;
      seriesSlug: string;
    }> = [
      ...collapsible.nodes.map((node) => ({
        id: node.id,
        type: variant as keyof typeof SIZES,
        seriesSlug: node.seriesSlug,
        data: {
          // 英語ロケールでは英語名。未訳は日本語名へフォールバックする
          // （ページ側の名前表示と同じ規則。止めると名無しだらけになる）
          label: localized(node.label, node.labelEn, locale),
          href: node.href,
          seriesName: localized(node.seriesName, node.seriesNameEn, locale),
          catch: node.catch,
          lessonCount: node.lessonCount,
          totalMinutes: node.totalMinutes,
          style: node.style,
          locale,
          ghost: node.ghost,
          current: node.current,
          here: node.id === hereNodeId,
          hasOutgoing: outgoing.has(node.id),
        } satisfies MandalaNodeData,
      })),
      ...collapsible.collapsed.map((series) => ({
        id: series.id,
        type: "collapsedSeries" as const,
        seriesSlug: series.seriesSlug,
        data: {
          label: localized(series.seriesName, series.seriesNameEn, locale),
          href: series.href,
          seriesName: localized(
            series.seriesName,
            series.seriesNameEn,
            locale,
          ),
          lessonCount: series.lessonCount,
          totalMinutes: series.totalMinutes,
          locale,
          ghost: false,
          current: false,
          here: series.id === hereNodeId,
          hasOutgoing: outgoing.has(series.id),
          collapsed: { courseCount: series.courseCount },
        } satisfies MandalaNodeData,
      })),
    ];
    // ⚠ 集約ノードを末尾に回したまま渡してはならない——dagre は交差最小化の同点を
    // 挿入順で決めるので、畳んだシリーズが右端へ移る（2026-08-24 に実機で確認）。
    // シリーズの正本順（`view.nodes` の初出順＝ツールバーのチップ順）に並べ替える
    const seriesRank = new Map(seriesOrder.map((slug, i) => [slug, i]));
    entries.sort(
      (a, b) =>
        (seriesRank.get(a.seriesSlug) ?? Infinity) -
        (seriesRank.get(b.seriesSlug) ?? Infinity),
    );

    const typeById = new Map<string, keyof typeof SIZES>([
      ...entries.map((e) => [e.id, e.type] as const),
      ...terminals.map((t) => [t.id, "terminal"] as const),
    ]);
    const sizeOf = (id: string): LayoutSize =>
      SIZES[typeById.get(id) ?? variant];

    // シリーズをレイアウトのまとまりとして dagre へ渡す。これが無いと dagre は
    // シリーズを知らないまま配置するので、同じシリーズのコースが他シリーズを
    // 挟んで置かれ、後段で求めるシリーズ枠が食い込む。
    // 折りたたみ中のシリーズ（集約ノード）と Start / Goal は枠を持たないので外す。
    const seriesSlugByNode = new Map(entries.map((e) => [e.id, e.seriesSlug]));
    const clusterOf = (id: string) => {
      const slug = seriesSlugByNode.get(id);
      if (slug === undefined || collapsedSlugs.has(slug)) return undefined;
      return slug;
    };

    const positions = layoutFlow(
      [...entries.map((e) => e.id), ...terminals.map((t) => t.id)],
      [...collapsible.edges, ...terminalEdges],
      {
        size: SIZES[variant],
        sizeOf,
        clusterOf,
        // 横順の固定。挿入順だけでは跨ぎの辺の重心で入れ替わりうるので、配置後に
        // シリーズのブロック単位で正本順へ並べ直す。集約ノードもそのシリーズとして数える
        seriesOf: (id: string) => seriesSlugByNode.get(id),
        seriesOrder,
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
      // ミニマップは実測値ではなくノードの寸法を見るので、確定している値を明示する
      ...sizeOf(entry.id),
      data: entry.data as unknown as Record<string, unknown>,
      draggable: false,
      connectable: false,
    }));

    // シリーズごとのコース群を背景の枠で囲う。全体曼陀羅は全シリーズ、
    // シリーズ曼陀羅は表示中のシリーズだけ（シリーズ外のゴーストは囲わない）。
    // React Flow の親子関係は使わない——dagre の絶対座標と二重管理になるため、
    // レイアウト結果から矩形を求めて背後に敷くだけにする。
    const framedSlugs = [...new Set(entries.map((e) => e.seriesSlug))];

    const frameNodes: Node[] = framedSlugs.flatMap((slug) => {
      // 折りたたみ中のシリーズは集約ノード1つなので枠を描かない
      if (collapsedSlugs.has(slug)) return [];
      const members = entries.filter((e) => e.seriesSlug === slug);
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

      const { width, height } = rect;

      return [
        {
          id: `${FRAME_PREFIX}${slug}`,
          type: "seriesFrame" as const,
          position: { x: rect.x, y: rect.y },
          width,
          height,
          data: {
            seriesName: members[0]!.data.seriesName,
            width,
            height,
            // 展開中のシリーズトップを見ているときは枠が現在地になる
            here: isSeriesFrameHere(currentLocation, slug),
            locale,
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

    const flowEdges: Edge[] = [...collapsible.edges, ...terminalEdges].map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      // 順序辺・跨ぎ辺とも流れを見せる。
      // ⚠ 線種で区別しないこと——animated な辺はそれ自体が流れる破線として
      // 描かれるため、跨ぎだけ dasharray を変えても目視できず、区別を主張する
      // コードとコメントが実態と食い違うだけになる
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
    seriesOrder,
    collapsedSlugs,
    locale,
    currentLocation,
  ]);

  /** コースノードの遷移先。**ホームでもモーダルでも維持する** */
  const courseHrefById = useMemo(
    () => new Map(collapsible.nodes.map((n) => [n.id, n.href] as const)),
    [collapsible],
  );

  const seriesSlugs = seriesOrder;

  /** ツールバーのチップ・ノードのクリック・ダブルクリックから呼ぶ */
  const toggleSeries = useCallback((slug: string) => {
    // 収める初期表示の札を落とす。畳み直しても復帰しない（上の宣言の理由）
    setFitCollapsed(false);
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  /** シリーズ枠・集約ノードなら、その slug。それ以外は null */
  const seriesSlugOfNode = useCallback((nodeId: string): string | null => {
    if (nodeId.startsWith(FRAME_PREFIX)) return nodeId.slice(FRAME_PREFIX.length);
    if (nodeId.startsWith(COLLAPSED_PREFIX))
      return nodeId.slice(COLLAPSED_PREFIX.length);
    return null;
  }, []);

  /**
   * ノードのクリック。**面によってシリーズの扱いが違う**。
   *
   * - コースノード: どちらの面でもコーストップへ遷移（変えない）
   * - シリーズ枠・集約ノード:
   *   - **ホーム**は常に開閉をトグルし、遷移しない——遷移する面ではなく「開いて読む
   *     地図」。シリーズトップへの導線は曼陀羅の下のカード一覧とサイドバーが担う
   *   - **モーダル**は2段構え。**現在地がそのシリーズトップのときだけ**トグルし、
   *     それ以外はシリーズトップへ遷移する（Studio ツリーの「未選択の行は選択・
   *     選択済みの行の再クリックは開閉」と同型）。モーダルは遷移しても開いたままなので、
   *     1 回目で現在地になり 2 回目でトグルされる。
   *     ⚠ 配下のコース・レッスンを見ているときはトグルへ倒さない——レッスンページから
   *     シリーズトップへ向かう導線が消えるため
   *
   * ⚠ 当たり判定は触らない——枠の wrapper は `onNodeClick` を渡した時点で React Flow が
   * `pointer-events: all` にしており、すでにクリックを受け取れる。「コースノードの上では
   * コースへ」は z-index が自動でやる（コース 0 / 枠 -1）。この関係を崩さないこと
   */
  /**
   * 直前のクリックが開閉をトグルしたか。
   *
   * ⚠ **ダブルクリックとの二重トグルを防ぐためだけに要る。** ダブルクリックは
   * `click` → `click` → `dblclick` の順に届く。2 回目の `click` が既にトグルしていた
   * ときにダブルクリック側でもトグルすると、**行って戻って何も起きない**。しかも
   * 2 回目の `click` がトグルになるかは「1 回目の遷移がその間に届いたか」に依存する
   * ので、放置すると**同じ操作の結果がタイミングで変わる**。
   */
  const toggledByClickRef = useRef(false);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      toggledByClickRef.current = false;
      const slug = seriesSlugOfNode(node.id);
      if (slug !== null) {
        const isHere =
          currentLocation?.kind === "series" &&
          currentLocation.seriesSlug === slug;
        if (!modal || isHere) {
          toggleSeries(slug);
          toggledByClickRef.current = true;
        } else {
          router.push(localizedHref(`/${slug}`, locale));
        }
        return;
      }
      const href = courseHrefById.get(node.id);
      if (href) router.push(localizedHref(href, locale));
    },
    [
      seriesSlugOfNode,
      currentLocation,
      modal,
      toggleSeries,
      courseHrefById,
      router,
      locale,
    ],
  );

  /**
   * シリーズ枠・集約ノードのダブルクリックで開閉をトグルする（モーダルだけ）。
   * 現在地でないシリーズを1操作で畳める近道として残す——シングルクリックの2段構えでは
   * 1 回目が遷移になるため。
   *
   * ⚠ **直前のクリックがトグル済みなら何もしない**（上の ref の理由）。結果として、
   * 現在地のシリーズをダブルクリックすると「2 回押した」ぶんの 2 トグル＝元の姿に戻る。
   * これは正しい——シングルクリックがトグルである以上、2 回押せば 2 回トグルする。
   * ⚠ ホームはシングルクリックが常にトグルなので、ここは常に空振りする（`modal` の
   * 早期 return と ref の両方で守られている）
   * ⚠ `zoomOnDoubleClick` は false にしてあるので、ズームは起きない
   */
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!modal) return;
      if (toggledByClickRef.current) {
        toggledByClickRef.current = false;
        return;
      }
      const slug = seriesSlugOfNode(node.id);
      if (slug !== null) toggleSeries(slug);
    },
    [modal, seriesSlugOfNode, toggleSeries],
  );

  /**
   * コンテナの寸法が確定したとき・変わったときに曼陀羅の表示位置を決め直す。
   *
   * ⚠ 初期化時の一度きりでは足りない。ウィンドウのリサイズやレイアウトの落ち着きで
   * キャンバスの寸法が後から変わると、初回の寸法との差がそのままずれとして残る。
   * ⚠ Studio 側（`studio/components/workspace/mandala/Mandala.tsx`）に同じ手当がある。
   * 相互依存禁止の規約によりコピーで持つので、直すときは両方直す。
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

  /** 表示位置の決定は 1 か所に集約する（初回とリサイズで見え方が変わらないように） */
  const placeView = useCallback(
    (instance: ReactFlowInstance) => {
      // 全シリーズが畳まれたまま（開閉していない）の間だけ収める
      if (fitCollapsed) {
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
    [fitCollapsed, anchorCandidates],
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
        // パン・ズームを始めたあとに置き直すと閲覧者の操作を巻き戻すことになる
        if (interactiveRef.current) return;
        const instance = instanceRef.current;
        if (instance) placeView(instance);
      });
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [placeView]);

  if (nodes.length === 0) return null;

  return (
    <div className="dxm-mandala">
      <div className="dxm-mandala-toolbar">
          {seriesSlugs.map((slug) => {
            const collapsed = collapsedSlugs.has(slug);
            const node = siteData.mandala.nodes.find(
              (n) => n.seriesSlug === slug,
            );
            const name = node
              ? localized(node.seriesName, node.seriesNameEn, locale)
              : slug;
            return (
              <button
                key={slug}
                type="button"
                className="dxm-mandala-toggle"
                aria-pressed={collapsed}
                onClick={() => toggleSeries(slug)}
              >
                {collapsed ? "▸" : "▾"} {name}
              </button>
            );
          })}
      </div>
      <div
        ref={canvasRef}
        className="dxm-mandala-canvas"
        style={{ height: canvasHeight }}
        // クリックするまではページスクロールを優先する
        onClick={() => setInteractive(true)}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={mandalaNodeTypes}
          // 初回の配置。実測が揃った時点の置き直しは下の
          // `PlaceWhenNodesInitialized`、以降の追随は上の ResizeObserver が担う
          onInit={(instance) => {
            instanceRef.current = instance;
            placeView(instance);
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          zoomOnScroll={interactive}
          preventScrolling={interactive}
          panOnDrag={interactive}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={modal ? onNodeDoubleClick : undefined}
        >
          {/* パン・ズームを始めたあとは置き直さない（閲覧者の操作を巻き戻さない） */}
          <PlaceWhenNodesInitialized enabled={!interactive} place={placeView} />
          {/* 背景の格子は敷かない——曼陀羅を本文から浮かせず地続きに見せる。
              ミニマップ・Controls の配色は globals.css の `--xy-*` が持つ
              （props で渡すとインラインになり、ダークから上書きできない） */}
          {(
            <MiniMap pannable zoomable nodeComponent={MandalaMiniMapNode} />
          )}
          {interactive && <Controls showInteractive={false} />}
        </ReactFlow>
      </div>
    </div>
  );
}
