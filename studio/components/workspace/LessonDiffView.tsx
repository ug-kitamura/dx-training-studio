"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  formatLineNumber,
  getDiffLineContent,
  getDiffLineMarker,
  isDiffDisplayLine,
  parseUnifiedDiff,
  type DiffLineKind,
  type ParsedDiffLine,
} from "@/lib/unified-diff-hunks";

type Props = {
  diff: string;
  className?: string;
};

function diffRowBackgroundClass(kind: DiffLineKind): string {
  switch (kind) {
    case "add":
      return "bg-green-500/10";
    case "remove":
      return "bg-red-500/10";
    default:
      return "";
  }
}

function diffContentTextClass(kind: DiffLineKind): string {
  switch (kind) {
    case "add":
      return "text-green-700";
    case "remove":
      return "text-red-700";
    case "hunk-header":
      return "text-primary";
    case "file-old":
    case "file-new":
      return "text-muted-foreground";
    default:
      return "";
  }
}

function diffMarkerTextClass(kind: DiffLineKind): string {
  switch (kind) {
    case "add":
      return "text-green-700";
    case "remove":
      return "text-red-700";
    default:
      return "";
  }
}

function DiffMarkerCell({ line }: { line: ParsedDiffLine }) {
  const marker = getDiffLineMarker(line.kind);
  return (
    <div
      className={cn(
        "lesson-diff-marker shrink-0 tabular-nums",
        diffMarkerTextClass(line.kind),
      )}
      aria-hidden={!marker}
    >
      {marker || "\u00A0"}
    </div>
  );
}

function DiffContentCell({ line }: { line: ParsedDiffLine }) {
  const content = getDiffLineContent(line.text, line.kind);
  return (
    <div
      className={cn(
        "lesson-diff-content min-w-0 flex-1 py-0",
        diffContentTextClass(line.kind),
      )}
    >
      {content || "\u00A0"}
    </div>
  );
}

export function LessonDiffView({ diff, className }: Props) {
  const lines = useMemo(
    () => parseUnifiedDiff(diff).filter((line) => isDiffDisplayLine(line)),
    [diff],
  );

  if (!diff.trim()) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center text-sm text-muted-foreground",
          className,
        )}
      >
        差分なし
      </div>
    );
  }

  return (
    <div className={cn("lesson-diff-view h-full overflow-auto", className)}>
      <div className="py-3">
        {lines.map((line) => (
          <div
            key={`line-${line.index}`}
            className={cn(
              "lesson-diff-row flex min-h-[1.375rem]",
              diffRowBackgroundClass(line.kind),
            )}
          >
            <div className="lesson-diff-gutters shrink-0">
              <div className="lesson-diff-gutter-element tabular-nums">
                {formatLineNumber(line.oldLineNumber)}
              </div>
              <div className="lesson-diff-gutter-element tabular-nums">
                {formatLineNumber(line.newLineNumber)}
              </div>
              <div className="lesson-diff-gutter-spacer" aria-hidden />
            </div>
            <DiffMarkerCell line={line} />
            <DiffContentCell line={line} />
          </div>
        ))}
      </div>
    </div>
  );
}
