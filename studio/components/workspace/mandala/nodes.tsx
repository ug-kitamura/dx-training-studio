"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MapPin } from "lucide-react";
import type { EditLanguage } from "@/lib/display-name";
import {
  formatCourseStyleLabel,
  formatMinutesLabel,
} from "@/lib/lesson-label-locale";
import type { CourseStyle } from "@/lib/schema";

export type MandalaNodeData = {
  label: string;
  seriesName: string;
  lessonCount: number;
  totalMinutes: number;
  /** コースの受講形態。未設定ならラベルを出さない */
  style?: CourseStyle;
  /** 編集言語（英語ビューではノード内ラベルも英語にする） */
  language: EditLanguage;
  ghost: boolean;
  current: boolean;
  /** いま選んでいるコース。`current`（ビュー内かどうか）とは別物 */
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
  /** そのシリーズ自身を選んでいる。コースノードと同じ枠色＋ピンで示す */
  here: boolean;
  language: EditLanguage;
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
 * インラインで置くとコース名の幅が縮み、省略位置が他ノードとずれる。
 */
function HerePin({
  here,
  language,
}: {
  here: boolean;
  language: EditLanguage;
}) {
  if (!here) return null;
  return (
    <MapPin
      className="dxm-node-here-pin"
      size={18}
      strokeWidth={2.5}
      aria-label={language === "en" ? "You are here" : "いまここ"}
    />
  );
}

function StyleLabel({
  style,
  language,
}: {
  style?: CourseStyle;
  language: EditLanguage;
}) {
  const label = formatCourseStyleLabel(style, language);
  if (!label) return null;
  return <span className="dxm-node-style">{label}</span>;
}

/**
 * 全体曼陀羅（`compact`）とミニ曼陀羅サムネイル（`thumbnail`）で共有するノード。
 *
 * 違いは密度だけなので描画は 1 つにまとめ、幅と中身は CSS とデータが持つ。
 * コース名は最大 2 行に折り返して全体を見せる（CSS 側）。サムネイルは受講形態を
 * 載せず（`style` が渡ってこない）、コース名を中央にそろえる——セルが小さく、
 * ラベルがコース名の幅を奪うため。
 */
export function CompactNode({ data, type }: NodeProps) {
  const d = data as MandalaNodeData;
  const variant = type === "thumbnail" ? "thumbnail" : "compact";
  // 名前は2行に折り返して全体を見せるので、全体を見せるためのツールチップは置かない
  // （曼陀羅の目的は一目で見渡せること。ホバーしないと読めない名前は目的に反する）。
  // ラッパが減るぶん React Flow のノード計測に介在する DOM も減る
  return (
    <div className={nodeClass(d, variant)}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <HerePin here={d.here} language={d.language} />
      <span className="dxm-node-title">{d.label}</span>
      <StyleLabel style={d.style} language={d.language} />
      <SourceHandle connected={d.hasOutgoing} />
    </div>
  );
}

/**
 * ミニ曼陀羅の拡大モーダル用。上から シリーズ名 → コース名 → レッスン数・所要時間。
 * 受講形態は右端・高さ中央。キャッチコピーは載せない——同じ画面の左列フォームに出ている。
 */
export function CardNode({ data }: NodeProps) {
  const d = data as MandalaNodeData;
  return (
    <div className={nodeClass(d, "card")}>
      {/* 縦に流れるので接続点は上下 */}
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <HerePin here={d.here} language={d.language} />
      <span className="dxm-node-series">{d.seriesName}</span>
      <span className="dxm-node-title">{d.label}</span>
      <span className="dxm-node-meta">
        {d.lessonCount} {d.language === "en" ? "lessons" : "レッスン"}・
        {d.language === "en"
          ? formatMinutesLabel(d.totalMinutes, d.language)
          : `約 ${d.totalMinutes} 分`}
      </span>
      <StyleLabel style={d.style} language={d.language} />
      <SourceHandle connected={d.hasOutgoing} />
    </div>
  );
}

/** 折りたたんだシリーズ 1 つ分 */
export function CollapsedSeriesNode({ data }: NodeProps) {
  const d = data as MandalaNodeData;
  return (
    <div className={nodeClass(d, "collapsed")}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {/* 折りたたんでも現在地を見失わないよう、コースノードと同じ印を出す */}
      <HerePin here={d.here} language={d.language} />
      <span className="dxm-node-title">{d.label}</span>
      <span className="dxm-node-meta">
        {d.collapsed?.courseCount ?? 0}{" "}
        {d.language === "en" ? "courses" : "コース"}・{d.lessonCount}{" "}
        {d.language === "en" ? "lessons" : "レッスン"}
      </span>
      <SourceHandle connected={d.hasOutgoing} />
    </div>
  );
}

/**
 * コース群の背後に敷く枠（全体曼陀羅のみ）。押せない背景なので
 * `pointer-events: none` のまま——コースノードは z-index が上で当たる。
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
      {/* 枠のピンは基底の `.dxm-node-here-pin` をそのまま使う——`right: 100%` が
          「箱の右辺を枠の左辺に合わせる」意味になり、コースのピンがノードの
          左外に付くのとまったく同じ関係で枠の左外に付く */}
      <HerePin here={d.here} language={d.language} />
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
  // 同じ描画を密度違いで使う。寸法は `Mandala.tsx` の SIZES が持つ
  thumbnail: CompactNode,
  card: CardNode,
  collapsedSeries: CollapsedSeriesNode,
  seriesFrame: SeriesFrameNode,
  terminal: TerminalNode,
};
