"use client";

import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  onResizeStart: (clientX: number) => void;
  onResize: (clientX: number) => void;
  onResizeEnd: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** 区切り線の見た目（未指定時は 1px の border 色） */
  lineClassName?: string;
};

export function PaneResizeHandle({
  onResizeStart,
  onResize,
  onResizeEnd,
  className,
  style,
  lineClassName,
}: Props) {
  const rafRef = useRef<number | null>(null);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      onResizeStart(startX);

      const onMove = (ev: MouseEvent) => {
        if (rafRef.current !== null) return;
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null;
          onResize(ev.clientX);
        });
      };

      const onUp = () => {
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onResizeEnd();
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [onResizeStart, onResize, onResizeEnd],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="ペイン幅を変更"
      onMouseDown={startDrag}
      style={style}
      className={cn(
        "relative shrink-0 cursor-col-resize touch-none px-1 -mx-1 select-none",
        className,
      )}
    >
      <div
        className={cn(
          "h-full w-px bg-border transition-colors hover:bg-primary/40 active:bg-primary/60",
          lineClassName,
        )}
      />
    </div>
  );
}
