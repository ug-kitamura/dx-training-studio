"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BusySpinner } from "@/components/workspace/BusySpinner";
import { LessonTagsInput } from "@/components/workspace/LessonTagsInput";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_FORM,
  META_DIALOG_STACK,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import { aiRequestHeaders } from "@/components/workspace/image-manager/image-manager-utils";
import { AI_KEY_ERROR } from "@/components/workspace/image-manager/image-manager-constants";
import { isContextItemStale } from "@/lib/context-freshness";
import { matchesContextSearchText } from "@/lib/context-search";
import { withContextMode } from "@/lib/context-api-client";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";
import type { ContextItem } from "@/lib/context-db/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings?: () => void;
};

type FormDraft = {
  title: string;
  body: string;
  tags: string[];
  source_url: string;
  source_last_updated_at: string;
};

const EMPTY_DRAFT: FormDraft = {
  title: "",
  body: "",
  tags: [],
  source_url: "",
  source_last_updated_at: "",
};

function itemToDraft(item: ContextItem): FormDraft {
  return {
    title: item.title,
    body: item.body,
    tags: [...item.tags],
    source_url: item.source_url,
    source_last_updated_at: item.source_last_updated_at ?? "",
  };
}

export function CompanyContextDialog({ open, onOpenChange, onOpenSettings }: Props) {
  const [items, setItems] = useState<ContextItem[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleOnly, setStaleOnly] = useState(false);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
  const [sourceUrlError, setSourceUrlError] = useState<string | null>(null);
  const [keywordQuery, setKeywordQuery] = useState("");
  const flushTagsRef = useRef<(() => string[]) | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, tagsRes] = await Promise.all([
        fetch(withContextMode("/api/context/items")),
        fetch(withContextMode("/api/context/tags")),
      ]);

      if (!itemsRes.ok) {
        const data = (await itemsRes.json()) as { error?: string };
        throw new Error(data.error ?? "一覧の取得に失敗しました");
      }
      if (!tagsRes.ok) {
        const data = (await tagsRes.json()) as { error?: string };
        throw new Error(data.error ?? "タグ一覧の取得に失敗しました");
      }

      const itemsData = (await itemsRes.json()) as { items?: ContextItem[] };
      const tagsData = (await tagsRes.json()) as { tags?: string[] };
      setItems(itemsData.items ?? []);
      setTagSuggestions(tagsData.tags ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      // 親 state から open だけ更新された場合も一覧を再取得する
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期取得の結果を state に入れる正当な用途
      void loadData();
    }
  }, [open, loadData]);

  const resetFormState = useCallback(() => {
    setMode("list");
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setSourceUrlError(null);
    setStaleOnly(false);
    setKeywordQuery("");
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (nextOpen) {
        void loadData();
      } else {
        resetFormState();
      }
    },
    [loadData, onOpenChange, resetFormState],
  );

  const filteredItems = useMemo(() => {
    const query = keywordQuery.trim();
    if (!query) return items;
    return items.filter((item) => {
      const haystack = [
        item.title,
        item.body,
        item.source_url,
        ...item.tags,
      ].join("\n");
      return matchesContextSearchText(haystack, query);
    });
  }, [items, keywordQuery]);

  const visibleItems = staleOnly
    ? filteredItems.filter((item) => isContextItemStale(item.source_last_updated_at))
    : filteredItems;

  const openCreateForm = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setSourceUrlError(null);
    setMode("form");
  };

  const openEditForm = (item: ContextItem) => {
    setEditingId(item.id);
    setDraft(itemToDraft(item));
    setSourceUrlError(null);
    setMode("form");
  };

  const handleDelete = async (item: ContextItem) => {
    if (!window.confirm(`「${item.title}」を削除しますか？`)) return;
    setError(null);
    try {
      const res = await fetch(withContextMode(`/api/context/items/${item.id}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "削除に失敗しました");
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  const handleFormat = async () => {
    if (!draft.body.trim()) {
      setError("AI整形するテキストを本文欄に入力してください");
      return;
    }
    setFormatting(true);
    setError(null);
    try {
      const settings = loadWorkspaceSettings();
      const res = await fetch("/api/context/format", {
        method: "POST",
        headers: aiRequestHeaders(settings),
        body: JSON.stringify({
          rawText: draft.body,
          existingTags: tagSuggestions,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const message = data.error ?? "AI整形に失敗しました";
        if (res.status === 401 && message === AI_KEY_ERROR) {
          onOpenSettings?.();
        }
        throw new Error(message);
      }
      const data = (await res.json()) as {
        title?: string;
        body?: string;
        suggestedTags?: string[];
        source_last_updated_at?: string | null;
      };
      setDraft((prev) => ({
        ...prev,
        title: data.title ?? prev.title,
        body: data.body ?? prev.body,
        tags: data.suggestedTags?.length ? data.suggestedTags : prev.tags,
        source_last_updated_at:
          data.source_last_updated_at ?? prev.source_last_updated_at,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI整形に失敗しました");
    } finally {
      setFormatting(false);
    }
  };

  const handleSave = async () => {
    const tags = flushTagsRef.current?.() ?? draft.tags;
    if (!draft.source_url.trim()) {
      setSourceUrlError("ソース URL は必須です");
      return;
    }
    if (!draft.title.trim() || !draft.body.trim()) {
      setError("タイトルと本文は必須です");
      return;
    }

    setSaving(true);
    setError(null);
    setSourceUrlError(null);
    try {
      const payload = {
        title: draft.title.trim(),
        body: draft.body.trim(),
        tags,
        source_url: draft.source_url.trim(),
        source_last_updated_at: draft.source_last_updated_at.trim() || null,
      };

      const res = await fetch(
        withContextMode(
          editingId ? `/api/context/items/${editingId}` : "/api/context/items",
        ),
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "保存に失敗しました");
      }

      await loadData();
      setMode("list");
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === "list" ? "社内コンテキスト" : editingId ? "社内コンテキストを編集" : "社内コンテキストを追加"}
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {mode === "list" ? (
          <div className="flex min-h-[40vh] flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                value={keywordQuery}
                onChange={(event) => setKeywordQuery(event.target.value)}
                placeholder="キーワードで検索..."
                className={cn(META_DIALOG_CONTROL, "flex-1")}
                aria-label="キーワード検索"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={staleOnly}
                  onChange={(event) => setStaleOnly(event.target.checked)}
                />
                ソース最終更新日が古い・未入力のみ
              </label>
              <Button type="button" size="sm" onClick={openCreateForm}>
                <Plus className="size-3.5" />
                新規追加
              </Button>
            </div>

            <div className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                  <BusySpinner className="size-4" />
                  読み込み中...
                </div>
              ) : visibleItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {staleOnly || keywordQuery.trim()
                    ? "該当するアイテムがありません"
                    : "登録された社内コンテキストがありません"}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {visibleItems.map((item) => {
                    const stale = isContextItemStale(item.source_last_updated_at);
                    return (
                      <li key={item.id} className="flex flex-col gap-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-foreground">{item.title}</p>
                              {stale ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                                  <AlertTriangle className="size-3" />
                                  要確認
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {item.body}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <p className="mt-1 truncate text-[11px] text-muted-foreground">
                              <a
                                href={item.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {item.source_url}
                              </a>
                              {item.source_last_updated_at
                                ? ` · ソース最終更新日: ${item.source_last_updated_at}`
                                : " · ソース最終更新日: 未入力"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label="編集"
                              onClick={() => openEditForm(item)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              aria-label="削除"
                              onClick={() => void handleDelete(item)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className={cn(META_DIALOG_FORM, META_DIALOG_STACK, "min-h-0 flex-1 overflow-y-auto")}>
            <MetaDialogField>
              <Label htmlFor="context-title">タイトル</Label>
              <Input
                id="context-title"
                className={META_DIALOG_CONTROL}
                value={draft.title}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </MetaDialogField>

            <MetaDialogField>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="context-body">本文</Label>
                <WorkspaceTooltip
                  label="要約・タグ提案・Markdown 整形"
                  render={
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      disabled={formatting || !draft.body.trim()}
                      onClick={() => void handleFormat()}
                    >
                      {formatting ? (
                        <BusySpinner className="size-3.5" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      AI整形
                    </Button>
                  }
                />
              </div>
              <textarea
                id="context-body"
                className={cn(
                  META_DIALOG_CONTROL,
                  "min-h-40 w-full rounded-md border border-input px-3 py-2 text-sm",
                )}
                value={draft.body}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, body: event.target.value }))
                }
              />
            </MetaDialogField>

            <MetaDialogField>
              <Label id="context-tags-label">タグ</Label>
              <LessonTagsInput
                id="context-tags"
                tags={draft.tags}
                suggestions={tagSuggestions}
                onChange={(tags) => setDraft((prev) => ({ ...prev, tags }))}
                onFlushReady={(flush) => {
                  flushTagsRef.current = flush;
                }}
              />
            </MetaDialogField>

            <MetaDialogField>
              <Label htmlFor="context-source-url">ソース URL</Label>
              <Input
                id="context-source-url"
                className={META_DIALOG_CONTROL}
                value={draft.source_url}
                aria-invalid={Boolean(sourceUrlError)}
                onChange={(event) => {
                  setSourceUrlError(null);
                  setDraft((prev) => ({ ...prev, source_url: event.target.value }));
                }}
              />
              {sourceUrlError ? (
                <p className="text-xs text-destructive">{sourceUrlError}</p>
              ) : null}
            </MetaDialogField>

            <MetaDialogField>
              <Label htmlFor="context-source-updated">ソース最終更新日（任意）</Label>
              <div className="relative">
                <Input
                  id="context-source-updated"
                  type="date"
                  className={cn(
                    META_DIALOG_CONTROL,
                    "context-date-input",
                    !draft.source_last_updated_at && "context-date-input--empty",
                  )}
                  value={draft.source_last_updated_at}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      source_last_updated_at: event.target.value,
                    }))
                  }
                />
                {!draft.source_last_updated_at ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground"
                  >
                    YYYY/MM/DD
                  </span>
                ) : null}
              </div>
            </MetaDialogField>
          </div>
        )}

        <DialogFooter>
          {mode === "form" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMode("list");
                  setEditingId(null);
                  setDraft(EMPTY_DRAFT);
                  setSourceUrlError(null);
                  setError(null);
                }}
              >
                一覧に戻る
              </Button>
              <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <BusySpinner className="size-4" /> : null}
                保存
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              閉じる
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
