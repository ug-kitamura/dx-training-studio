"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SkillSummary } from "@/lib/agent/skill-loader";
import type { AgentFileAttachment } from "@/lib/agent-chat-storage";
import {
  filterBuiltinCommands,
  filterContentFiles,
  filterSkills,
  orderSlashSuggestionItems,
  type AgentBuiltinCommand,
  type AgentFileOption,
} from "@/lib/agent-chat-suggestions";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";

export type { AgentFileOption };

type SuggestionKind = "skill" | "file";

type SuggestionState = {
  kind: SuggestionKind;
  query: string;
  start: number;
};

type SuggestionItem = {
  kind: "command" | "skill" | "file";
  key: string;
  primary: string;
  secondary: string;
  file?: AgentFileOption;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** 添付チップ（親が保持し、プロジェクト往復で復元する） */
  attachments: AgentFileAttachment[];
  onAttachmentsChange: (attachments: AgentFileAttachment[]) => void;
  onSend: (attachments: AgentFileAttachment[]) => void;
  onAfterSend?: () => void;
  onStop?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  modelLabel?: string | null;
  skills: SkillSummary[];
  /** スラッシュ候補を開いたとき一覧が空なら再取得を要求する */
  onEnsureSkills?: () => void;
  activeSkillId: string | null;
  activeSkillName: string | null;
  onActiveSkillChange: (skillId: string | null) => void;
  onLoadContentFiles: () => Promise<AgentFileOption[]>;
  onBuiltinCommand?: (command: AgentBuiltinCommand["id"]) => void;
  /** 外部（Pane 1 の add to chat 等）から添付チップを追加する関数を登録する */
  onRegisterAddAttachment?: (
    fn: (attachment: AgentFileAttachment) => void,
  ) => void;
};

function detectSuggestion(
  value: string,
  cursor: number,
): SuggestionState | null {
  const beforeCursor = value.slice(0, cursor);
  const atMatch = /@([^\s@]*)$/.exec(beforeCursor);
  if (atMatch) {
    const query = atMatch[1] ?? "";
    return {
      kind: "file",
      query,
      start: beforeCursor.length - query.length - 1,
    };
  }

  const slashMatch = /(^|\n)\/([^\s/]*)$/.exec(beforeCursor);
  if (slashMatch) {
    const query = slashMatch[2] ?? "";
    return {
      kind: "skill",
      query,
      start: beforeCursor.length - query.length - 1,
    };
  }

  return null;
}

const SUGGESTION_VISIBLE_COUNT = 5;
const SUGGESTION_ITEM_HEIGHT_CLASS = "h-14";
const TEXTAREA_MIN_ROWS = 2;
const TEXTAREA_MAX_HEIGHT_PX = 200;

function measureTextareaMinHeight(textarea: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight);
  const paddingTop = Number.parseFloat(style.paddingTop);
  const paddingBottom = Number.parseFloat(style.paddingBottom);
  const borderTop = Number.parseFloat(style.borderTopWidth);
  const borderBottom = Number.parseFloat(style.borderBottomWidth);
  const lineHeightPx = Number.isFinite(lineHeight) ? lineHeight : 20;
  return (
    lineHeightPx * TEXTAREA_MIN_ROWS +
    paddingTop +
    paddingBottom +
    borderTop +
    borderBottom
  );
}

function clampHighlightIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return Math.max(0, Math.min(index, itemCount - 1));
}

export function AgentChatInput({
  value,
  onChange,
  attachments: fileAttachments,
  onAttachmentsChange,
  onSend,
  onAfterSend,
  onStop,
  disabled = false,
  isLoading = false,
  modelLabel = null,
  skills,
  onEnsureSkills,
  activeSkillId,
  activeSkillName,
  onActiveSkillChange,
  onLoadContentFiles,
  onBuiltinCommand,
  onRegisterAddAttachment,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionListRef = useRef<HTMLDivElement>(null);
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  const [contentFiles, setContentFiles] = useState<AgentFileOption[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const syncTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const minHeight = measureTextareaMinHeight(textarea);
    const nextHeight = Math.max(
      minHeight,
      Math.min(textarea.scrollHeight, TEXTAREA_MAX_HEIGHT_PX),
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > TEXTAREA_MAX_HEIGHT_PX ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    syncTextareaHeight();
  }, [value, syncTextareaHeight]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const observer = new ResizeObserver(() => {
      syncTextareaHeight();
    });
    observer.observe(textarea);
    if (textarea.parentElement) {
      observer.observe(textarea.parentElement);
    }
    return () => observer.disconnect();
  }, [syncTextareaHeight]);

  const filteredSkills = useMemo(() => {
    const query = suggestion?.kind === "skill" ? suggestion.query : "";
    return filterSkills(skills, query);
  }, [skills, suggestion]);

  const filteredCommands = useMemo(() => {
    if (suggestion?.kind !== "skill") return [];
    return filterBuiltinCommands(suggestion.query);
  }, [suggestion]);

  const visibleFileOptions = useMemo(() => {
    if (suggestion?.kind !== "file") return [];
    return filterContentFiles(contentFiles, suggestion.query);
  }, [contentFiles, suggestion]);

  const visibleItems: SuggestionItem[] = useMemo(() => {
    if (suggestion?.kind === "skill") {
      return orderSlashSuggestionItems(filteredSkills, filteredCommands).map(
        (entry) =>
          entry.kind === "command"
            ? {
                kind: "command" as const,
                key: entry.item.id,
                primary: entry.item.name,
                secondary: entry.item.description,
              }
            : {
                kind: "skill" as const,
                key: entry.item.id,
                primary: entry.item.name,
                secondary: entry.item.description,
              },
      );
    }
    return visibleFileOptions.map((file) => ({
      kind: "file" as const,
      key: file.path,
      primary: file.relativePath ?? file.path,
      secondary: file.name,
      file,
    }));
  }, [filteredCommands, filteredSkills, suggestion?.kind, visibleFileOptions]);

  const activeHighlightIndex = clampHighlightIndex(
    highlightIndex,
    visibleItems.length,
  );

  useEffect(() => {
    if (!suggestion || visibleItems.length === 0) return;
    const list = suggestionListRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(
      `[data-suggestion-index="${activeHighlightIndex}"]`,
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [activeHighlightIndex, suggestion, visibleItems.length]);

  const loadContentFilesForSuggestion = useCallback(() => {
    setFilesLoading(true);
    void onLoadContentFiles()
      .then((files) => {
        setContentFiles(files);
      })
      .finally(() => {
        setFilesLoading(false);
      });
  }, [onLoadContentFiles]);

  const suggestionEmptyMessage =
    suggestion?.kind === "file"
      ? filesLoading
        ? "ファイル一覧を読み込み中..."
        : suggestion.query
          ? "一致するファイルがありません"
          : "プロジェクト内にファイルがありません"
      : "一致するスキルまたはコマンドがありません";

  const updateSuggestionFromCursor = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setSuggestion(null);
      setHighlightIndex(0);
      return;
    }
    const cursor = textarea.selectionStart ?? textarea.value.length;
    const next = detectSuggestion(textarea.value, cursor);
    if (next?.kind === "file") {
      loadContentFilesForSuggestion();
    }
    setSuggestion((prev) => {
      const unchanged =
        prev?.kind === next?.kind &&
        prev?.query === next?.query &&
        prev?.start === next?.start;
      if (!unchanged) {
        setHighlightIndex(0);
      }
      return next;
    });
  }, [loadContentFilesForSuggestion]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    const cursor = event.target.selectionStart ?? next.length;
    const detected = next ? detectSuggestion(next, cursor) : null;
    onChange(next);
    if (detected?.kind === "file") {
      loadContentFilesForSuggestion();
    }
    if (detected?.kind === "skill" && skills.length === 0) {
      // 初回取得の失敗・未取得から回復する（多重発火は親側でガード）
      onEnsureSkills?.();
    }
    setSuggestion(detected);
    setHighlightIndex(0);
  };

  const clearSlashToken = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !suggestion || suggestion.kind !== "skill") return;
    const before = value.slice(0, suggestion.start);
    const after = value.slice(textarea.selectionStart);
    onChange(`${before}${after}`.replace(/^\n/, ""));
    setSuggestion(null);
    requestAnimationFrame(() => textarea.focus());
  }, [onChange, suggestion, value]);

  const applySkillSelection = useCallback(
    (skillId: string) => {
      clearSlashToken();
      onActiveSkillChange(skillId);
    },
    [clearSlashToken, onActiveSkillChange],
  );

  const applyCommandSelection = useCallback(
    (commandId: AgentBuiltinCommand["id"]) => {
      clearSlashToken();
      onBuiltinCommand?.(commandId);
    },
    [clearSlashToken, onBuiltinCommand],
  );

  const applyFileSelection = useCallback(
    (file: AgentFileOption) => {
      const textarea = textareaRef.current;
      if (!textarea || !suggestion || suggestion.kind !== "file") return;
      const token = file.name;
      const before = value.slice(0, suggestion.start);
      const after = value.slice(textarea.selectionStart);
      const next = `${before}${token} ${after}`;
      onChange(next);
      if (!fileAttachments.some((item) => item.path === file.path)) {
        onAttachmentsChange([
          ...fileAttachments,
          { path: file.path, name: file.name },
        ]);
      }
      setSuggestion(null);
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = before.length + token.length + 1;
        textarea.setSelectionRange(pos, pos);
      });
    },
    [fileAttachments, onAttachmentsChange, onChange, suggestion, value],
  );

  const removeFileAttachment = useCallback(
    (filePath: string) => {
      onAttachmentsChange(
        fileAttachments.filter((item) => item.path !== filePath),
      );
    },
    [fileAttachments, onAttachmentsChange],
  );

  const addFileAttachment = useCallback(
    (attachment: AgentFileAttachment) => {
      if (fileAttachments.some((item) => item.path === attachment.path)) {
        return;
      }
      onAttachmentsChange([...fileAttachments, attachment]);
      // @ 由来と同様、本文にもファイル名トークンを挿入する（末尾に追記）
      const base = value.replace(/[ \t]+$/, "");
      onChange(
        base
          ? `${base}${base.endsWith("\n") ? "" : " "}${attachment.name} `
          : `${attachment.name} `,
      );
    },
    [fileAttachments, onAttachmentsChange, onChange, value],
  );

  useEffect(() => {
    onRegisterAddAttachment?.(addFileAttachment);
  }, [addFileAttachment, onRegisterAddAttachment]);

  const submitMessage = useCallback(() => {
    if (disabled || isLoading || !value.trim()) return;
    onSend([...fileAttachments]);
    onAfterSend?.();
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      syncTextareaHeight();
    });
  }, [
    disabled,
    fileAttachments,
    isLoading,
    onAfterSend,
    onSend,
    syncTextareaHeight,
    value,
  ]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestion) {
      if (visibleItems.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setHighlightIndex((index) =>
            clampHighlightIndex(index + 1, visibleItems.length),
          );
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setHighlightIndex((index) =>
            clampHighlightIndex(index - 1, visibleItems.length),
          );
          return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          const item = visibleItems[activeHighlightIndex];
          if (item.kind === "skill") {
            applySkillSelection(item.key);
          } else if (item.kind === "command") {
            applyCommandSelection(item.key as AgentBuiltinCommand["id"]);
          } else if (item.file) {
            applyFileSelection(item.file);
          }
          return;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSuggestion(null);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isLoading) submitMessage();
    }
  };

  const showChipRow = Boolean(activeSkillId) || fileAttachments.length > 0;

  return (
    <div className="flex shrink-0 flex-col gap-2 py-3">
      {showChipRow ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeSkillId ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary">
              <span>{activeSkillName ?? activeSkillId}</span>
              <button
                type="button"
                className="inline-flex size-4 items-center justify-center rounded-full text-inherit hover:bg-primary/15"
                aria-label="スキル選択を解除"
                onClick={() => onActiveSkillChange(null)}
              >
                <X className="size-3" />
              </button>
            </span>
          ) : null}
          {fileAttachments.map((file) => (
            <span
              key={file.path}
              className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/10 py-0.5 pl-2 pr-1 text-xs text-violet-700 dark:text-violet-300"
            >
              <WorkspaceTooltip
                label={file.path}
                render={<span>{file.name}</span>}
              />
              <button
                type="button"
                className="inline-flex size-4 items-center justify-center rounded-full text-inherit hover:bg-violet-500/15"
                aria-label={`${file.name} の添付を解除`}
                onClick={() => removeFileAttachment(file.path)}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        {suggestion ? (
          <div
            ref={suggestionListRef}
            className="workspace-scrollbar absolute inset-x-0 bottom-full z-20 mb-1 overflow-y-auto overscroll-y-contain rounded-md border border-border bg-popover shadow-md"
            style={{ maxHeight: `calc(${SUGGESTION_VISIBLE_COUNT} * 3.5rem)` }}
          >
            {filesLoading || visibleItems.length > 0 ? (
              filesLoading ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {suggestionEmptyMessage}
                </div>
              ) : (
                visibleItems.map((item, index) => (
                  <button
                    key={`${item.kind}-${item.key}`}
                    type="button"
                    data-suggestion-index={index}
                    className={cn(
                      "flex w-full shrink-0 flex-col justify-center gap-0.5 px-3 text-left text-xs",
                      SUGGESTION_ITEM_HEIGHT_CLASS,
                      index === activeHighlightIndex
                        ? "bg-muted"
                        : "hover:bg-muted/60",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => {
                      if (item.kind === "skill") {
                        applySkillSelection(item.key);
                      } else if (item.kind === "command") {
                        applyCommandSelection(
                          item.key as AgentBuiltinCommand["id"],
                        );
                      } else if (item.file) {
                        applyFileSelection(item.file);
                      }
                    }}
                  >
                    <span className="font-medium text-foreground">
                      {item.kind === "file" ? item.primary : `/${item.key}`}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {item.secondary}
                    </span>
                  </button>
                ))
              )
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {suggestionEmptyMessage}
              </div>
            )}
          </div>
        ) : null}

        <div className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-white dark:bg-muted">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInputChange}
            onClick={updateSuggestionFromCursor}
            onSelect={updateSuggestionFromCursor}
            onKeyDown={handleKeyDown}
            rows={TEXTAREA_MIN_ROWS}
            placeholder="メッセージを入力（/ でスキル、@ でファイル参照）"
            disabled={disabled}
            className="workspace-scrollbar w-full resize-none border-0 bg-transparent px-3 pt-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
          />

          <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
            <span className="truncate text-[10px] text-muted-foreground">
              {modelLabel ?? ""}
            </span>
            <div className="flex items-center gap-1">
              {isLoading ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label="生成を停止"
                  onClick={onStop}
                >
                  <Square className="size-3.5 fill-current" />
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon"
                className="size-7 shrink-0 rounded-full"
                disabled={disabled || isLoading || !value.trim()}
                aria-label="送信"
                onMouseDown={(event) => event.preventDefault()}
                onClick={submitMessage}
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
