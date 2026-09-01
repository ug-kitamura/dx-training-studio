"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Pane4ToggleProps = {
  open: boolean;
  onToggle: () => void;
  className?: string;
};

export function Pane4Toggle({ open, onToggle, className }: Pane4ToggleProps) {
  const Icon = open ? PanelRightClose : PanelRightOpen;
  const label = open ? "閉じる" : "開く";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onToggle}
      aria-label={label}
      className={cn("size-7 text-foreground", className)}
    >
      <Icon />
    </Button>
  );
}
