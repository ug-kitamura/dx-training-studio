import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useImageLists } from "@/components/workspace/image-manager/use-image-lists";
import { WORKSPACE_SETTINGS_CHANGED_EVENT } from "@/lib/workspace-settings";

describe("useImageLists", () => {
  afterEach(() => {
    // 前のテストの hook（イベント購読）を残さない——設定変更イベントのテストが汚染される
    cleanup();
    vi.unstubAllGlobals();
  });

  it("fetches only active tab scope when pane4 opens on used tab", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useImageLists({ pane4Open: true, activeTab: "used" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/images/list?scope=used&storageMode=storage");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches staging only for upload tab without storage-check", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useImageLists({ pane4Open: true, activeTab: "upload" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/images/list?scope=staging&source=uploaded",
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches when activeTab changes", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    type Props = { activeTab: "used" | "ai" };
    const initialProps: Props = { activeTab: "used" };
    const { rerender } = renderHook(
      ({ activeTab }: Props) => useImageLists({ pane4Open: true, activeTab }),
      { initialProps },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender({ activeTab: "ai" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/images/list?scope=staging&source=ai",
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("フォントサイズ等ストレージ無関係の設定変更では再取得しない", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useImageLists({ pane4Open: true, activeTab: "used" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(WORKSPACE_SETTINGS_CHANGED_EVENT, {
          detail: { changedKeys: ["editorFontSizePx"] },
        }),
      );
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ストレージモードの変更では再取得する", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useImageLists({ pane4Open: true, activeTab: "used" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(WORKSPACE_SETTINGS_CHANGED_EVENT, {
          detail: { changedKeys: ["imageStorage"] },
        }),
      );
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("detail の無い設定変更イベントは安全側に倒して再取得する", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useImageLists({ pane4Open: true, activeTab: "used" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      window.dispatchEvent(new CustomEvent(WORKSPACE_SETTINGS_CHANGED_EVENT));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("does not fetch when pane4 is closed", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useImageLists({ pane4Open: false, activeTab: "used" }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
