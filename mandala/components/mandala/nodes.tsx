"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MapPin } from "lucide-react";
import {
  formatCourseStyle,
  formatMinutes,
  type CourseStyle,
} from "@/lib/site-data";
import type { Locale } from "@/lib/locale-path";

export type MandalaNodeData = {
  label: string;
  href: string;
  seriesName: string;
  catch?: string;
  lessonCount: number;
  totalMinutes: number;
  /** コースの受講形態。未設定ならラベルを出さない */
  style?: CourseStyle;
  locale: Locale;
  ghost: boolean;
  current: boolean;
  /**
   * 読者がいまいるコース。`current`（scope 内かどうか）とは別物で、
   * モーダルがパスから解いた1件だけに立つ。
   */
  here: boolean;
  /**
   * このノードから辺が出ていくか。接続点の丸ポチは出ていく側にだけ出し、
   * どこにも繋がっていない点は消す（判定に辺の一覧が要るので CSS では書けない）。
   */
  hasOutgoing: boolean;
  /** 折りたたまれたシリーズの集約ノード */
  collapsed?: { courseCount: number };
};

/** シリーズごとにコース群を囲う背景枠（全体曼陀羅のみ） */
export type SeriesFrameData = {
  seriesName: string;
  width: number;
  height: number;
  /** 展開中のこのシリーズのトップページを見ている（＝枠が現在地） */
  here: boolean;
  locale: Locale;
};

function classNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/**
 * 辺が出ていく側の接続点。繋がっていないノードでは丸ポチを消す
 * （`display: none` にはしない——React Flow は矩形から接続点を測るため）。
 */
function SourceHandle({ connected }: { connected: boolean }) {
  return (
    <Handle
      type="source"
      position={Position.Bottom}
      isConnectable={false}
      className={connected ? undefined : "dxm-handle-idle"}
    />
  );
}

function nodeClass(data: MandalaNodeData, variant: string): string {
  return classNames(
    "dxm-node",
    `dxm-node-${variant}`,
    data.ghost && "dxm-node-ghost",
    data.current && "dxm-node-current",
    data.here && "dxm-node-here",
  );
}

/**
 * 「いまここ」の印。ノードの左外・高さ中央へ絶対配置で重ねる——
 * インラインで置くとコース名の幅が縮み、ellipsis の位置が他ノードとずれる。
 * 寸法の上限はシリーズ枠線との隙間（22px）から決まる。理由は
 * `globals.css` の `.dxm-node-here-pin` を参照。
 */
function HerePin({ here, locale }: { here: boolean; locale: Locale }) {
  if (!here) return null;
  return (
    <MapPin
      className="dxm-node-here-pin"
      size={18}
      strokeWidth={2.5}
      aria-label={locale === "en" ? "You are here" : "いまここ"}
    />
  );
}

function StyleLabel({ data }: { data: MandalaNodeData }) {
  const label = formatCourseStyle(data.style, data.locale);
  if (!label) return null;
  return <span className="dxm-node-style">{label}</span>;
}

/** 全体・シリーズ曼陀羅用。コース名と受講形態だけ——数が増えても一覧できるように */
export function CompactNode({ data }: NodeProps) {
  const d = data as MandalaNodeData;
  // 名前は2行に折り返して全体を見せるので、全体を見せるための `title` は置かない
  // （曼陀羅の目的は一目で見渡せること。ホバーしないと読めない名前は目的に反する）
  return (
    <div className={nodeClass(d, "compact")}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <HerePin here={d.here} locale={d.locale} />
      <span className="dxm-node-title">{d.label}</span>
      <StyleLabel data={d} />
      <SourceHandle connected={d.hasOutgoing} />
    </div>
  );
}

/** ミニ曼陀羅（コーストップ）用。目次として読めるだけの情報を載せる */
export function CardNode({ data }: NodeProps) {
  const d = data as MandalaNodeData;
  return (
    <div className={nodeClass(d, "card")}>
      {/* 縦に流れるので接続点は上下 */}
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {d.current && (
        <span className="dxm-node-pin">
          {d.locale === "en" ? "You are here" : "いまここ"}
        </span>
      )}
      {d.ghost && <span className="dxm-node-series">{d.seriesName}</span>}
      <span className="dxm-node-title">{d.label}</span>
      {d.catch && <span className="dxm-node-catch">{d.catch}</span>}
      <span className="dxm-node-meta">
        {d.lessonCount} {d.locale === "en" ? "lessons" : "レッスン"}・
        {formatMinutes(d.totalMinutes, d.locale)}
        <StyleLabel data={d} />
      </span>
      <SourceHandle connected={d.hasOutgoing} />
    </div>
  );
}

/** 折りたたんだシリーズ1つ分 */
export function CollapsedSeriesNode({ data }: NodeProps) {
  const d = data as MandalaNodeData;
  return (
    <div className={nodeClass(d, "collapsed")}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {/* 折りたたんでも現在地を見失わないよう、コースノードと同じ印を出す */}
      <HerePin here={d.here} locale={d.locale} />
      <span className="dxm-node-title">{d.label}</span>
      <span className="dxm-node-meta">
        {d.collapsed?.courseCount ?? 0}{" "}
        {d.locale === "en" ? "courses" : "コース"}・{d.lessonCount}{" "}
        {d.locale === "en" ? "lessons" : "レッスン"}
      </span>
      <SourceHandle connected={d.hasOutgoing} />
    </div>
  );
}

/**
 * コース群の背後に敷く枠。クリックでシリーズトップへ遷移する（当たり判定は
 * React Flow の wrapper が持つので、この div は `pointer-events: none` のまま
 * ——コースノードは z-index が上なので、その上ではコースが当たる）。
 *
 * 展開中のそのシリーズのトップページを見ているときは、ここが現在地になる。
 * ピンは枠の左外・高さ中央——コースのピンがノードの左外に付くのと同じ関係で、
 * 位置は基底の `.dxm-node-here-pin` がそのまま決める（`globals.css`）。
 */
export function SeriesFrameNode({ data }: NodeProps) {
  const d = data as unknown as SeriesFrameData;
  return (
    <div
      className={classNames(
        "dxm-series-frame",
        d.here && "dxm-series-frame-here",
      )}
      style={{ width: d.width, height: d.height }}
    >
      <HerePin here={d.here} locale={d.locale} />
      <span className="dxm-series-frame-label">{d.seriesName}</span>
    </div>
  );
}

/** Start / Goal の文字ノード。枠も地色も持たず「ノードに見えない」ようにする */
export type TerminalNodeData = { label: string; hasOutgoing: boolean };

export function TerminalNode({ data }: NodeProps) {
  const d = data as unknown as TerminalNodeData;
  return (
    <div className="dxm-terminal">
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {d.label}
      <SourceHandle connected={d.hasOutgoing} />
    </div>
  );
}

export const mandalaNodeTypes = {
  compact: CompactNode,
  card: CardNode,
  collapsedSeries: CollapsedSeriesNode,
  seriesFrame: SeriesFrameNode,
  terminal: TerminalNode,
};
