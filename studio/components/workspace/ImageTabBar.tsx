"use client";

import { cn } from "@/lib/utils";
import { IMAGE_MANAGER_TABS } from "@/components/workspace/image-manager/image-manager-constants";
import type { ImageManagerTab } from "@/components/workspace/image-manager/types";

type Props = {
  value: ImageManagerTab;
  onChange: (value: ImageManagerTab) => void;
  className?: string;
};

export function ImageTabBar({ value, onChange, className }: Props) {
  return (
    <div className={cn("flex h-full min-w-0 items-center", className)}>
      {IMAGE_MANAGER_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            "flex h-full items-center gap-1 px-2 text-[10px] font-medium transition-colors",
            value === tab.value
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
