"use client";

import { HeartPulse, Loader2 } from "lucide-react";
import { useThemeKind } from "@/lib/use-resolved-dark-mode";
import { cn } from "@/lib/utils";

type Props = {
  /** 寸法と色。アニメーションはテーマ側が決めるので指定しない */
  className?: string;
  "aria-label"?: string;
};

/**
 * 処理中スピナー。ピンクテーマのときだけハートの鼓動になる。
 *
 * ⚠ アニメーションもテーマごとに変える——ハートは回転対称でないため
 * `animate-spin` だと転がって見え、ピンクテーマの狙い（穏やかな空気）と矛盾する。
 *
 * テーマ種別はレンダリング中に同期的に読まず `useThemeKind()`（effect 駆動）
 * から得る。サーバとクライアントで初期値がずれると hydration mismatch になる。
 */
export function BusySpinner({ className, "aria-label": ariaLabel }: Props) {
  const isPink = useThemeKind() === "pink";
  const Icon = isPink ? HeartPulse : Loader2;
  return (
    <Icon
      className={cn(isPink ? "animate-pulse" : "animate-spin", className)}
      aria-label={ariaLabel}
    />
  );
}
