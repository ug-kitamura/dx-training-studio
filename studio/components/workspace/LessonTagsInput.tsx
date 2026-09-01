"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isValidTag,
  normalizeTagToken,
} from "@/lib/lesson-tags";

type Props = {
  id?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: readonly string[];
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** 保存前などに未確定の入力をタグへ反映する */
  onFlushReady?: (flush: () => string[]) => void;
};

export function LessonTagsInput({
  id: idProp,
  tags,
  onChange,
  suggestions = [],
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  onFlushReady,
}: Props) {
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const filteredSuggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    return suggestions
      .filter((t) => !tags.includes(t))
      .filter((t) => !q || t.toLowerCase().includes(q))
      .slice(0, 10);
  }, [suggestions, tags, input]);

  const showSuggestions = suggestOpen && filteredSuggestions.length > 0;

  const commitToken = useCallback(
    (raw: string) => {
      const token = normalizeTagToken(raw);
      if (!token) return false;
      if (tags.includes(token)) {
        setInput("");
        setInlineError(null);
        return true;
      }
      if (!isValidTag(token)) {
        setInlineError(`タグは小文字英字・数字・ハイフンのみ: ${token}`);
        return false;
      }
      setInlineError(null);
      onChange([...tags, token]);
      setInput("");
      return true;
    },
    [tags, onChange],
  );

  const flushPending = useCallback((): string[] => {
    const token = normalizeTagToken(input);
    if (!token) return tags;
    if (tags.includes(token)) {
      setInput("");
      return tags;
    }
    if (!isValidTag(token)) {
      setInlineError(`タグは小文字英字・数字・ハイフンのみ: ${token}`);
      return tags;
    }
    const next = [...tags, token];
    setInlineError(null);
    setInput("");
    onChange(next);
    return next;
  }, [input, tags, onChange]);

  useEffect(() => {
    onFlushReady?.(flushPending);
  }, [onFlushReady, flushPending]);

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
    setInlineError(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " " || e.key === ",") {
      e.preventDefault();
      commitToken(input);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showSuggestions && filteredSuggestions.length > 0) {
        commitToken(filteredSuggestions[0]);
      } else {
        commitToken(input);
      }
      return;
    }
    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
      setInlineError(null);
      return;
    }
    if (e.key === "Escape") {
      setSuggestOpen(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/[\s,]/.test(text)) return;
    e.preventDefault();
    const parts = text.split(/[\s,]+/).map(normalizeTagToken).filter(Boolean);
    const next = [...tags];
    let hadError = false;
    for (const token of parts) {
      if (next.includes(token)) continue;
      if (!isValidTag(token)) {
        setInlineError(`タグは小文字英字・数字・ハイフンのみ: ${token}`);
        hadError = true;
        continue;
      }
      next.push(token);
    }
    if (!hadError) setInlineError(null);
    onChange(next);
    setInput("");
  };

  return (
    <div className={cn("relative", className)}>
      <div
        role="group"
        aria-labelledby={`${inputId}-label`}
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-white px-2 py-1.5 dark:bg-input/30",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25",
          (ariaInvalid || inlineError) &&
            "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground dark:bg-[color-mix(in_oklch,var(--input)_45%,var(--foreground)_16%)] dark:text-foreground"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              className="rounded-full p-0.5 text-secondary-foreground/80 hover:bg-primary/15 hover:text-primary dark:text-foreground/70 dark:hover:text-primary"
              aria-label={`${tag} を削除`}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setInlineError(null);
            setSuggestOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setSuggestOpen(true)}
          onBlur={() => {
            if (input.trim()) commitToken(input);
            window.setTimeout(() => setSuggestOpen(false), 120);
          }}
          className="min-w-[7rem] flex-1 border-0 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
          placeholder={tags.length === 0 ? "スペースで区切って追加" : ""}
          aria-invalid={ariaInvalid || Boolean(inlineError)}
          aria-describedby={ariaDescribedBy}
          autoComplete="off"
        />
      </div>

      {showSuggestions ? (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
          role="listbox"
        >
          {filteredSuggestions.map((suggestion) => (
            <li key={suggestion} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full px-3 py-1.5 text-left hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  commitToken(suggestion);
                  inputRef.current?.focus();
                }}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {inlineError ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {inlineError}
        </p>
      ) : null}
    </div>
  );
}
