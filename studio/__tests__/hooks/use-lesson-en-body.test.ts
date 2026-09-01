import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLessonEnBody } from "@/components/workspace/hooks/use-lesson-en-body";

const fetchLessonEnBody = vi.fn();
const saveLessonEnBody = vi.fn();
const translateLessonBody = vi.fn();

vi.mock("@/lib/translation/client", () => ({
  fetchLessonEnBody: (...args: unknown[]) => fetchLessonEnBody(...args),
  saveLessonEnBody: (...args: unknown[]) => saveLessonEnBody(...args),
  translateLessonBody: (...args: unknown[]) => translateLessonBody(...args),
}));

const names = { series: "S", course: "C", lesson: "L" };

function renderEnBody(onBodyChange: (content: string) => void) {
  return renderHook(() =>
    useLessonEnBody({ enabled: true, ...names, onBodyChange }),
  );
}

describe("useLessonEnBody の onBodyChange", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("本文の編集をツリーへ通知する（保存の debounce を待たない）", async () => {
    fetchLessonEnBody.mockResolvedValue({ exists: true, body: "old", sourceHash: null });
    const onBodyChange = vi.fn();
    const { result } = renderEnBody(onBodyChange);

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    act(() => {
      result.current.updateBody("![a](images/en-only.png)");
    });

    // 画像の参照走査は即時に追随する必要があるので、保存（800ms debounce）を待たない
    expect(onBodyChange).toHaveBeenCalledWith("![a](images/en-only.png)");
    expect(saveLessonEnBody).not.toHaveBeenCalled();
  });

  it("翻訳の適用もツリーへ通知する", async () => {
    fetchLessonEnBody.mockResolvedValue({ exists: false, body: "", sourceHash: null });
    translateLessonBody.mockResolvedValue({
      body: "![a](images/translated.png)",
      sourceHash: "abc",
    });
    saveLessonEnBody.mockResolvedValue(undefined);
    const onBodyChange = vi.fn();
    const { result } = renderEnBody(onBodyChange);

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    act(() => {
      result.current.translate();
    });

    await waitFor(() => {
      expect(onBodyChange).toHaveBeenCalledWith("![a](images/translated.png)");
    });
  });
});
