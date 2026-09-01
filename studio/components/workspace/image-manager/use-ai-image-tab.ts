"use client";

import { useCallback, useState } from "react";
import type { ImageGridItem } from "@/components/workspace/ImageGrid";
import {
  AI_KEY_ERROR,
} from "@/components/workspace/image-manager/image-manager-constants";
import { aiRequestHeaders } from "@/components/workspace/image-manager/image-manager-utils";
import { useEditorPromptSync } from "@/components/workspace/image-manager/use-editor-prompt-sync";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";
import type { EditLanguage } from "@/lib/display-name";
import type { ImageAsset, Lesson } from "@/lib/schema";

type RefreshScope = (
  scope: "ai",
  options?: { silent?: boolean },
) => Promise<void>;

export function useAiImageTab(options: {
  /** AI へ渡す文脈。`content` は編集言語の本文（英語ビューでは訳文） */
  lesson: Lesson | undefined;
  /** 生成する図解と alt の言語（編集言語） */
  language: EditLanguage;
  editorCommentPrompt: string | null;
  editorCursorOffset: number | null;
  refreshScope: RefreshScope;
  showNotice: (
    tab: "ai",
    message: string,
    tone: "error" | "success" | "warning",
  ) => void;
  clearNotice: (tab: "ai") => void;
  onHighlightPaths: (paths: string | string[]) => void;
}) {
  const {
    lesson,
    language,
    editorCommentPrompt,
    editorCursorOffset,
    refreshScope,
    showNotice,
    clearNotice,
    onHighlightPaths,
  } = options;

  const [prompt, setPrompt] = useState("");
  const [stagingAlts, setStagingAlts] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEditorPromptSync(editorCommentPrompt, setPrompt);

  const resolveAlt = useCallback(
    (item: ImageGridItem) => stagingAlts[item.path] ?? stagingAlts[item.name],
    [stagingAlts],
  );

  const handleGenerate = useCallback(async () => {
    // lesson は任意。無ければ文脈ブロック無しで著者プロンプトだけを送る
    const trimmed = prompt.trim();
    if (!trimmed) {
      showNotice("ai", "プロンプトを入力してください", "error");
      return;
    }
    const settings = loadWorkspaceSettings();
    const headers = aiRequestHeaders(settings);
    setGenerating(true);
    clearNotice("ai");
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ lesson, prompt: trimmed, language }),
      });
      let data: {
        file?: ImageAsset;
        alt?: string;
        error?: string;
        warning?: string;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        showNotice("ai", "サーバー応答の解析に失敗しました", "error");
        return;
      }
      if (!res.ok || !data.file) {
        showNotice(
          "ai",
          data.error ??
            (res.status === 401 ? AI_KEY_ERROR : "画像の生成に失敗しました"),
          "error",
        );
        return;
      }
      if (data.alt) {
        setStagingAlts((prev) => ({
          ...prev,
          [data.file!.path]: data.alt!,
          [data.file!.name]: data.alt!,
        }));
      }
      await refreshScope("ai", { silent: true });
      onHighlightPaths(data.file.path);
      const savedMessage = `AI staging に保存しました: ${data.file.name}`;
      if (data.warning) {
        showNotice("ai", `${savedMessage} ${data.warning}`, "warning");
      } else {
        showNotice("ai", savedMessage, "success");
      }
    } catch (error) {
      showNotice(
        "ai",
        error instanceof Error ? error.message : "画像の生成に失敗しました",
        "error",
      );
    } finally {
      setGenerating(false);
    }
  }, [
    lesson,
    language,
    prompt,
    refreshScope,
    showNotice,
    clearNotice,
    onHighlightPaths,
  ]);

  const handleAutoFill = useCallback(async () => {
    if (!lesson) return;

    const settings = loadWorkspaceSettings();
    const headers = aiRequestHeaders(settings);
    const seedPrompt = editorCommentPrompt ?? undefined;

    setSuggesting(true);
    clearNotice("ai");
    try {
      const res = await fetch("/api/images/suggest-prompt", {
        method: "POST",
        headers,
        body: JSON.stringify({
          lesson,
          cursorOffset: editorCursorOffset ?? 0,
          seedPrompt,
          language,
        }),
      });
      let data: { prompt?: string; error?: string };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        showNotice("ai", "サーバー応答の解析に失敗しました", "error");
        return;
      }
      if (!res.ok || !data.prompt) {
        showNotice(
          "ai",
          data.error ??
            (res.status === 401 ? AI_KEY_ERROR : "プロンプトの自動入力に失敗しました"),
          "error",
        );
        return;
      }
      setPrompt(data.prompt);
    } catch (error) {
      showNotice(
        "ai",
        error instanceof Error ? error.message : "プロンプトの自動入力に失敗しました",
        "error",
      );
    } finally {
      setSuggesting(false);
    }
  }, [
    lesson,
    language,
    editorCommentPrompt,
    editorCursorOffset,
    clearNotice,
    showNotice,
  ]);

  const handleResetPrompt = useCallback(() => {
    setPrompt("");
    clearNotice("ai");
  }, [clearNotice]);

  return {
    prompt,
    setPrompt,
    generating,
    suggesting,
    stagingAlts,
    resolveAlt,
    handleGenerate,
    handleAutoFill,
    handleResetPrompt,
  };
}
