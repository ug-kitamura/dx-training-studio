"use client";

/**
 * Pane 1 折りたたみトグル。shadcn/ui の SidebarTrigger は単一の `PanelLeft`
 * アイコンを使うが、本プロジェクトでは「畳むのか / 開くのか」を一目で伝える
 * ために `PanelLeftClose` / `PanelLeftOpen` を `state` で切り替えている。
 */

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type Pane1ToggleProps = {
  className?: string;
};

export function Pane1Toggle({ className }: Pane1ToggleProps) {
  const { state, toggleSidebar } = useSidebar();
  const isExpanded = state === "expanded";
  const Icon = isExpanded ? PanelLeftClose : PanelLeftOpen;
  const label = isExpanded ? "閉じる" : "開く";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggleSidebar}
      aria-label={label}
      className={cn("size-7 text-sidebar-foreground", className)}
    >
      <Icon />
    </Button>
  );
}
