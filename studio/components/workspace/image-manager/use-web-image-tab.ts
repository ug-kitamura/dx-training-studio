"use client";

import { useCallback, useState } from "react";
import type { ImageGridItem } from "@/components/workspace/ImageGrid";
import {
  AI_KEY_ERROR,
  AI_PIXABAY_KEY_ERROR,
} from "@/components/workspace/image-manager/image-manager-constants";
import { aiRequestHeaders } from "@/components/workspace/image-manager/image-manager-utils";
import { useEditorPromptSync } from "@/components/workspace/image-manager/use-editor-prompt-sync";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";
import type { ImageAsset, Lesson } from "@/lib/schema";

type RefreshScope = (
  scope: "web",
  options?: { silent?: boolean },
) => Promise<void>;

export function useWebImageTab(options: {
  lesson: Lesson | undefined;
  editorCommentPrompt: string | null;
  editorCursorOffset: number | null;
  refreshScope: RefreshScope;
  showNotice: (tab: "web", message: string, tone: "error" | "success") => void;
  clearNotice: (tab: "web") => void;
  onHighlightPaths: (paths: string | string[]) => void;
}) {
  const {
    lesson,
    editorCommentPrompt,
    editorCursorOffset,
    refreshScope,
    showNotice,
    clearNotice,
    onHighlightPaths,
  } = options;

  const [prompt, setPrompt] = useState("");
  const [stagingAlts, setStagingAlts] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEditorPromptSync(editorCommentPrompt, setPrompt);

  const resolveAlt = useCallback(
    (item: ImageGridItem) => stagingAlts[item.path] ?? stagingAlts[item.name],
    [stagingAlts],
  );

  const handleSearch = useCallback(async () => {
    // lesson は任意。無ければ文脈ブロック無しで著者の検索指示だけを送る
    const trimmed = prompt.trim();
    if (!trimmed) {
      showNotice("web", "プロンプトを入力してください", "error");
      return;
    }
    const settings = loadWorkspaceSettings();
    const headers = aiRequestHeaders(settings, true);
    setSearching(true);
    clearNotice("web");
    try {
      const res = await fetch("/api/images/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ lesson, prompt: trimmed }),
      });
      let data: {
        results?: Array<{ file: ImageAsset; alt?: string }>;
        error?: string;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        showNotice("web", "サーバー応答の解析に失敗しました", "error");
        return;
      }
      if (!res.ok || !data.results?.length) {
        showNotice(
          "web",
          data.error ??
            (res.status === 401 ? AI_PIXABAY_KEY_ERROR : "画像の検索に失敗しました"),
          "error",
        );
        return;
      }
      setStagingAlts((prev) => {
        const next = { ...prev };
        for (const item of data.results!) {
          if (item.alt) {
            next[item.file.path] = item.alt;
            next[item.file.name] = item.alt;
          }
        }
        return next;
      });
      await refreshScope("web", { silent: true });
      onHighlightPaths(data.results!.map((item) => item.file.path));
      showNotice(
        "web",
        `Web staging に ${data.results.length} 件保存しました`,
        "success",
      );
    } catch (error) {
      showNotice(
        "web",
        error instanceof Error ? error.message : "画像の検索に失敗しました",
        "error",
      );
    } finally {
      setSearching(false);
    }
  }, [lesson, prompt, refreshScope, showNotice, clearNotice, onHighlightPaths]);

  const handleAutoFill = useCallback(async () => {
    if (!lesson) return;

    const settings = loadWorkspaceSettings();
    const headers = aiRequestHeaders(settings);
    const seedPrompt = editorCommentPrompt ?? undefined;

    setSuggesting(true);
    clearNotice("web");
    try {
      const res = await fetch("/api/images/suggest-web-prompt", {
        method: "POST",
        headers,
        body: JSON.stringify({
          lesson,
          cursorOffset: editorCursorOffset ?? 0,
          seedPrompt,
        }),
      });
      let data: { prompt?: string; error?: string };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        showNotice("web", "サーバー応答の解析に失敗しました", "error");
        return;
      }
      if (!res.ok || !data.prompt) {
        showNotice(
          "web",
          data.error ??
            (res.status === 401 ? AI_KEY_ERROR : "プロンプトの自動入力に失敗しました"),
          "error",
        );
        return;
      }
      setPrompt(data.prompt);
    } catch (error) {
      showNotice(
        "web",
        error instanceof Error ? error.message : "プロンプトの自動入力に失敗しました",
        "error",
      );
    } finally {
      setSuggesting(false);
    }
  }, [
    lesson,
    editorCommentPrompt,
    editorCursorOffset,
    clearNotice,
    showNotice,
  ]);

  const handleResetPrompt = useCallback(() => {
    setPrompt("");
    clearNotice("web");
  }, [clearNotice]);

  return {
    prompt,
    setPrompt,
    searching,
    suggesting,
    stagingAlts,
    resolveAlt,
    handleSearch,
    handleAutoFill,
    handleResetPrompt,
  };
}
