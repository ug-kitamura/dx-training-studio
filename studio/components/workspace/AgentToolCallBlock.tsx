"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentToolEvent } from "@/lib/agent/llm/types";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ToolConfirmInlineCard } from "@/components/workspace/ToolConfirmInlineCard";
import type { ToolConfirmRequiredEvent } from "@/lib/agent/stream-client";

type Props = {
  events: AgentToolEvent[];
  className?: string;
  /** ターン実行中の確認待ち。あれば末尾に常時表示のカードを描画する */
  pendingConfirm?: ToolConfirmRequiredEvent | null;
  onConfirmApprove?: () => void;
  onConfirmReject?: () => void;
  onConfirmManualSubmit?: (manualSearchText: string) => void;
};

type CompactItem = {
  i?: number;
  title?: string;
};

type ToolEventPair = {
  start?: AgentToolEvent;
  end?: AgentToolEvent;
};

function pairDisplay(pair: ToolEventPair): string {
  return pair.end?.display ?? pair.start?.display ?? pair.end?.name ?? "";
}

/** display の先頭語（「読取: foo.md」→「読取」）。区切りが無ければ全体。 */
function displayVerb(display: string): string {
  const colon = display.search(/[:：]/);
  return (colon >= 0 ? display.slice(0, colon) : display).trim();
}

/**
 * 折りたたみタイトル。件数に比例して伸びないよう、
 * 実行中は最新ツールのみ、完了後は件数＋動詞集計にする。
 */
export function summarizeToolPairs(pairs: ToolEventPair[]): string {
  const running = pairs.filter((pair) => !pair.end);
  if (running.length > 0) {
    const latest = pairDisplay(running[running.length - 1]);
    return latest ? `${latest} を実行中…` : "ツールを実行中…";
  }

  const displays = pairs.map(pairDisplay).filter(Boolean);
  if (displays.length === 0) return "";
  if (displays.length === 1) return displays[0];

  const counts = new Map<string, number>();
  for (const display of displays) {
    const verb = displayVerb(display);
    counts.set(verb, (counts.get(verb) ?? 0) + 1);
  }
  const summary = [...counts.entries()]
    .map(([verb, count]) => (count > 1 ? `${verb} ×${count}` : verb))
    .join("・");
  return `ツール実行 ${displays.length}件（${summary}）`;
}

function pairToolEvents(events: AgentToolEvent[]): ToolEventPair[] {
  const starts = events.filter((event) => event.phase === "start");
  const ends = events.filter((event) => event.phase === "end");
  const paired = ends.map((end) => ({
    start: starts.find((start) => start.toolUseId === end.toolUseId),
    end,
  }));
  const unmatchedStarts = starts.filter(
    (start) => !ends.some((end) => end.toolUseId === start.toolUseId),
  );
  return [...paired, ...unmatchedStarts.map((start) => ({ start }))];
}

function parseToolResult(resultJson?: string): Record<string, unknown> | null {
  if (!resultJson) return null;
  try {
    const parsed: unknown = JSON.parse(resultJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readCompactItems(
  result: Record<string, unknown> | null,
): CompactItem[] {
  if (!result || !Array.isArray(result.items)) return [];
  return result.items.filter(
    (item): item is CompactItem =>
      typeof item === "object" && item !== null && "title" in item,
  );
}

function ToolEventDetails({
  start,
  end,
}: {
  start?: AgentToolEvent;
  end?: AgentToolEvent;
}) {
  const toolName = end?.name ?? start?.name;
  const result = parseToolResult(end?.result);
  const error = typeof result?.error === "string" ? result.error : undefined;
  const query =
    start?.input && typeof start.input.query === "string"
      ? start.input.query
      : undefined;
  const items = readCompactItems(result);

  return (
    <div className="flex flex-col gap-0.5">
      <span>{end?.display ?? start?.display}</span>
      {query ? <span>query: {query}</span> : null}
      {toolName === "search_company_context" && items.length > 0 ? (
        <ul className="flex flex-col gap-0.5 pl-2">
          {items.map((item) => (
            <li key={`${item.i ?? item.title}`}>
              {item.i != null ? `${item.i}. ` : ""}
              {item.title ?? ""}
            </li>
          ))}
        </ul>
      ) : null}
      {toolName === "select_company_context" ? (
        <>
          {items.length > 0 ? (
            <ul className="flex flex-col gap-0.5 pl-2">
              {items.map((item) => (
                <li key={`${item.i ?? item.title}`}>
                  {item.i != null ? `${item.i}. ` : ""}
                  {item.title ?? ""}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {error ? <span>error: {error}</span> : null}
      {!error && typeof result?.warning === "string" ? (
        <span>warning: {result.warning}</span>
      ) : null}
      {!error && end?.tags && end.tags.length > 0 ? (
        <span>tags: {end.tags.join(", ")}</span>
      ) : null}
      {!error && end?.summary ? <span>result: {end.summary}</span> : null}
    </div>
  );
}

export function AgentToolCallBlock({
  events,
  className,
  pendingConfirm,
  onConfirmApprove,
  onConfirmReject,
  onConfirmManualSubmit,
}: Props) {
  const [open, setOpen] = useState(false);
  const pairs = pairToolEvents(events);
  if (pairs.length === 0 && !pendingConfirm) return null;

  const summary = summarizeToolPairs(pairs);

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {pairs.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto w-full min-w-0 justify-start gap-1 px-0 py-0 text-xs text-muted-foreground hover:bg-transparent"
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDown
            className={cn(
              "size-3 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
          <span className="min-w-0 truncate text-left">{summary}</span>
        </Button>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          {pairs.map((pair, index) => (
            <ToolEventDetails
              key={pair.end?.toolUseId ?? pair.start?.toolUseId ?? index}
              start={pair.start}
              end={pair.end}
            />
          ))}
        </div>
      ) : null}
      {pendingConfirm ? (
        <ToolConfirmInlineCard
          key={`tool-confirm-${pendingConfirm.toolUseId}`}
          request={pendingConfirm}
          onApprove={() => onConfirmApprove?.()}
          onReject={() => onConfirmReject?.()}
          onManualSubmit={(text) => onConfirmManualSubmit?.(text)}
        />
      ) : null}
    </div>
  );
}
