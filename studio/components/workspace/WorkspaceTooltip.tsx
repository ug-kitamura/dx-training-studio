"use client";

import type { ReactElement } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  render: ReactElement;
};

/** Pane4 と同じ shadcn Tooltip（黒背景・白文字・矢印） */
export function WorkspaceTooltip({ label, side = "top", render }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger render={render} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
