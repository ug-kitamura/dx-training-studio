"use client";

import {
  useRef,
  useCallback,
  type ReactNode,
  type RefObject,
  type WheelEventHandler,
} from "react";
import { cn } from "@/lib/utils";
import { handlePaneWheel } from "@/components/workspace/pane-scroll";

type Props = Omit<React.ComponentProps<"div">, "onWheel" | "children"> & {
  children: ReactNode;
  scrollRef: RefObject<HTMLElement | null>;
  onWheel?: WheelEventHandler<HTMLDivElement>;
};

/** ヘッダー上のホイールも scrollRef へ伝えるペイン用ラッパー */
export function PaneWheelRoot({
  children,
  scrollRef,
  className,
  onWheel,
  ...props
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback<WheelEventHandler<HTMLDivElement>>(
    (e) => {
      onWheel?.(e);
      if (e.defaultPrevented) return;
      const pane = rootRef.current;
      const target = scrollRef.current;
      if (pane && target) {
        handlePaneWheel(pane, target, e.nativeEvent);
      }
    },
    [scrollRef, onWheel],
  );

  return (
    <div
      ref={rootRef}
      onWheel={handleWheel}
      className={cn("flex h-full min-h-0 w-full flex-col", className)}
      {...props}
    >
      {children}
    </div>
  );
}
