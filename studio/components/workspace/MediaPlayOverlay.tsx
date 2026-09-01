"use client";

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  visible?: boolean;
};

export function MediaPlayOverlay({ className, visible = true }: Props) {
  if (!visible) return null;
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-background/80 shadow-sm">
        <Play className="size-5 fill-foreground text-foreground" />
      </div>
    </div>
  );
}
