"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: readonly string[];
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  onFlushReady?: (flush: () => string[]) => void;
};

function normalizeTagToken(raw: string): string {
  return raw.trim();
}

export function ContextTagsInput({
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

  const filteredSuggestions = useMemo(() => {
    const query = input.trim().toLowerCase();
    return suggestions
      .filter((tag) => !tags.includes(tag))
      .filter((tag) => !query || tag.toLowerCase().includes(query))
      .slice(0, 10);
  }, [suggestions, tags, input]);

  const showSuggestions = suggestOpen && filteredSuggestions.length > 0;

  const commitToken = useCallback(
    (raw: string) => {
      const token = normalizeTagToken(raw);
      if (!token) return false;
      if (tags.includes(token)) {
        setInput("");
        return true;
      }
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
    const next = [...tags, token];
    setInput("");
    onChange(next);
    return next;
  }, [input, tags, onChange]);

  useEffect(() => {
    onFlushReady?.(flushPending);
  }, [onFlushReady, flushPending]);

  const removeTag = (tag: string) => {
    onChange(tags.filter((item) => item !== tag));
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
      return;
    }
    if (e.key === "Escape") {
      setSuggestOpen(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/[\s,、]/.test(text)) return;
    e.preventDefault();
    const parts = text.split(/[\s,、]+/).map(normalizeTagToken).filter(Boolean);
    const next = [...tags];
    for (const token of parts) {
      if (!next.includes(token)) next.push(token);
    }
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
          ariaInvalid &&
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
              onClick={(event) => {
                event.stopPropagation();
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
          onChange={(event) => {
            setInput(event.target.value);
            setSuggestOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setSuggestOpen(true)}
          onBlur={() => {
            if (input.trim()) commitToken(input);
            window.setTimeout(() => setSuggestOpen(false), 120);
          }}
          className="min-w-[7rem] flex-1 border-0 bg-transparent py-0.5 text-sm outline-none"
          placeholder={tags.length === 0 ? "スペースで区切って追加" : ""}
          aria-invalid={ariaInvalid}
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
                onMouseDown={(event) => event.preventDefault()}
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
    </div>
  );
}
