"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";

export type PaneSegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** compact 時に label の代わりに icon のみ表示 */
  compactIcon?: React.ReactNode;
  ariaLabel?: string;
};

type Props<T extends string> = {
  value: T;
  options: ReadonlyArray<PaneSegmentOption<T>>;
  onChange: (value: T) => void;
  compact?: boolean;
  className?: string;
};

export function PaneSegmentControl<T extends string>({
  value,
  options,
  onChange,
  compact = false,
  className,
}: Props<T>) {
  return (
    <div
      className={cn(
        "flex shrink-0 overflow-hidden rounded-md border border-border",
        className,
      )}
    >
      {options.map((option) => {
        const showIconOnly = compact && option.compactIcon != null;
        const icon = showIconOnly ? option.compactIcon : option.icon;
        const button = (
          <button
            type="button"
            aria-label={showIconOnly ? (option.ariaLabel ?? option.label) : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs transition-colors",
              value === option.value
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {icon}
            {!showIconOnly ? option.label : null}
          </button>
        );
        // アイコンのみのときだけ説明が要る。表記があるボタンには付けない
        // （Studio 既定のツールチップ規則。⚠ 生 title は使わない）
        return showIconOnly ? (
          <WorkspaceTooltip
            key={option.value}
            label={option.label}
            render={button}
          />
        ) : (
          <Fragment key={option.value}>{button}</Fragment>
        );
      })}
    </div>
  );
}
