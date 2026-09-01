import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAiImageTab } from "@/components/workspace/image-manager/use-ai-image-tab";
import type { Lesson } from "@/lib/schema";

const lesson = { id: "l1", lesson: "Test", content: "" } as Lesson;

describe("useAiImageTab", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("calls refreshScope after successful generate", async () => {
    const refreshScope = vi.fn(async () => undefined);
    const showNotice = vi.fn();
    const clearNotice = vi.fn();
    const onHighlightPaths = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          file: { path: "/staging/ai/a.png", name: "a.png" },
          alt: "alt text",
        }),
      })),
    );

    const { result } = renderHook(() =>
      useAiImageTab({
        lesson,
        language: "ja" as const,
        editorCommentPrompt: null,
        editorCursorOffset: null,
        refreshScope,
        showNotice,
        clearNotice,
        onHighlightPaths,
      }),
    );

    act(() => {
      result.current.setPrompt("draw a cat");
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await waitFor(() => {
      expect(refreshScope).toHaveBeenCalledWith("ai", { silent: true });
    });
    expect(onHighlightPaths).toHaveBeenCalledWith("/staging/ai/a.png");
    expect(showNotice).toHaveBeenCalledWith(
      "ai",
      expect.stringContaining("AI staging"),
      "success",
    );
  });

  it("shows warning tone when API returns warning", async () => {
    const refreshScope = vi.fn(async () => undefined);
    const showNotice = vi.fn();
    const clearNotice = vi.fn();
    const onHighlightPaths = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          file: { path: "/staging/ai/small.png", name: "small.png" },
          alt: "alt text",
          warning: "生成画像の幅が小さいです",
        }),
      })),
    );

    const { result } = renderHook(() =>
      useAiImageTab({
        lesson,
        language: "ja" as const,
        editorCommentPrompt: null,
        editorCursorOffset: null,
        refreshScope,
        showNotice,
        clearNotice,
        onHighlightPaths,
      }),
    );

    act(() => {
      result.current.setPrompt("tiny icon");
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(showNotice).toHaveBeenCalledWith(
      "ai",
      expect.stringMatching(/AI staging.*小さい/),
      "warning",
    );
  });

  describe("編集言語の受け渡し（image-pane-language）", () => {
    const enLesson = {
      id: "l1",
      lesson: "三大エリア",
      name_en: "Three areas",
      content: "English body",
    } as Lesson;

    function setupHook(language: "ja" | "en", lessonArg: Lesson) {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          file: { path: "/staging/ai/a.png", name: "a.png" },
          alt: "A flow",
          prompt: "A flow diagram",
        }),
      }));
      vi.stubGlobal("fetch", fetchMock);

      const { result } = renderHook(() =>
        useAiImageTab({
          lesson: lessonArg,
          language,
          editorCommentPrompt: null,
          editorCursorOffset: 12,
          refreshScope: vi.fn(async () => undefined),
          showNotice: vi.fn(),
          clearNotice: vi.fn(),
          onHighlightPaths: vi.fn(),
        }),
      );
      return { result, fetchMock };
    }

    function lastBody(fetchMock: ReturnType<typeof vi.fn>) {
      const call = fetchMock.mock.calls.at(-1) as [string, RequestInit];
      return JSON.parse(String(call[1].body)) as {
        language?: string;
        lesson?: Lesson;
        cursorOffset?: number;
      };
    }

    it("生成の POST に language と編集言語の本文が入る", async () => {
      const { result, fetchMock } = setupHook("en", enLesson);

      act(() => result.current.setPrompt("flow"));
      await act(async () => {
        await result.current.handleGenerate();
      });

      const body = lastBody(fetchMock);
      expect(body.language).toBe("en");
      expect(body.lesson?.content).toBe("English body");
      expect(body.lesson?.name_en).toBe("Three areas");
    });

    it("自動入力の POST にも language が入る", async () => {
      const { result, fetchMock } = setupHook("en", enLesson);

      await act(async () => {
        await result.current.handleAutoFill();
      });

      const body = lastBody(fetchMock);
      expect(body.language).toBe("en");
      expect(body.cursorOffset).toBe(12);
      expect(body.lesson?.content).toBe("English body");
    });

    it("英語ビューで生成した画像の alt は英語で、挿入に使われる", async () => {
      const { result, fetchMock } = setupHook("en", enLesson);

      act(() => result.current.setPrompt("flow"));
      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(lastBody(fetchMock).language).toBe("en");
      // 挿入時の alt は生成 API が返した英語の短い説明
      expect(
        result.current.resolveAlt({
          path: "/staging/ai/a.png",
          name: "a.png",
        } as Parameters<typeof result.current.resolveAlt>[0]),
      ).toBe("A flow");
    });

    it("日本語ビューでは language が ja のまま", async () => {
      const { result, fetchMock } = setupHook("ja", lesson);

      act(() => result.current.setPrompt("flow"));
      await act(async () => {
        await result.current.handleGenerate();
      });

      expect(lastBody(fetchMock).language).toBe("ja");
    });
  });
});
