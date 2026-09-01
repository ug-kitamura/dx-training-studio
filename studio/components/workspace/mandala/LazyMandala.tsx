"use client";

import dynamic from "next/dynamic";
import type { MandalaProps } from "@/components/workspace/mandala/Mandala";

/**
 * 曼陀羅の遅延境界。React Flow と dagre は曼陀羅を開くまで読み込まない。
 * `ssr: false` は React Flow が寸法計測にブラウザ API を使うため。
 */
const Mandala = dynamic(
  () =>
    import("@/components/workspace/mandala/Mandala").then((m) => m.Mandala),
  { ssr: false },
);

export function LazyMandala(props: MandalaProps) {
  return <Mandala {...props} />;
}
