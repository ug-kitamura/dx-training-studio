"use client";

import dynamic from "next/dynamic";
import type { MandalaProps } from "@/components/mandala/Mandala";

/**
 * 曼陀羅の遅延境界。**曼陀羅を描く場所は必ずここを通す。**
 *
 * 公開サイトは全ページが単一のキャッチオール route（`app/[[...mdxPath]]`）から
 * 生成されるため、クライアント chunk は全ページの和集合になる。静的 import が
 * 1箇所でも残ると、曼陀羅を出さないレッスンページにも React Flow 一式
 * （約 520KB）が載ってしまう——`ssr: false` の非同期 chunk に閉じ込めるのが
 * その回避策で、`ssr: false` はクライアントコンポーネントでしか指定できない。
 */
const Mandala = dynamic(
  () => import("@/components/mandala/Mandala").then((m) => m.Mandala),
  { ssr: false },
);

export function LazyMandala(props: MandalaProps) {
  return <Mandala {...props} />;
}
