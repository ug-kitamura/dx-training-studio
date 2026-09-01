import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePromoteAndInsert } from "@/components/workspace/image-manager/use-promote-and-insert";

describe("usePromoteAndInsert", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const item = { path: "images/ai/foo.png", name: "foo.png" };

  it("promotes, inserts markdown, and refreshes scopes on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          file: { path: "images/foo.png", name: "foo.png" },
        }),
      })),
    );

    const tryInsert = vi.fn(() => true);
    const refreshScopes = vi.fn(async () => {});
    const showNotice = vi.fn();
    const onImageAssetsChanged = vi.fn();

    const { result } = renderHook(() =>
      usePromoteAndInsert({
        tryInsert,
        refreshScopes,
        showNotice,
        onImageAssetsChanged,
      }),
    );

    await act(async () => {
      await result.current.promoteAndInsert(item, {
        tab: "ai",
        stagingScope: "ai",
        resolveAlt: () => "alt text",
      });
    });

    expect(tryInsert).toHaveBeenCalledWith("![alt text](images/foo.png)", "ai");
    expect(refreshScopes).toHaveBeenCalledWith(["ai", "used"], { silent: true });
    expect(onImageAssetsChanged).toHaveBeenCalled();
    expect(showNotice).not.toHaveBeenCalled();
  });

  it("shows error notice when promote API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "promote failed" }),
      })),
    );

    const tryInsert = vi.fn(() => true);
    const refreshScopes = vi.fn(async () => {});
    const showNotice = vi.fn();

    const { result } = renderHook(() =>
      usePromoteAndInsert({ tryInsert, refreshScopes, showNotice }),
    );

    await act(async () => {
      await result.current.promoteAndInsert(item, {
        tab: "upload",
        stagingScope: "uploaded",
      });
    });

    expect(showNotice).toHaveBeenCalledWith("upload", "promote failed", "error");
    expect(tryInsert).not.toHaveBeenCalled();
    expect(refreshScopes).not.toHaveBeenCalled();
  });

  it("does not refresh when insert is rejected (edit mode off)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          file: { path: "images/foo.png", name: "foo.png" },
        }),
      })),
    );

    const tryInsert = vi.fn(() => false);
    const refreshScopes = vi.fn(async () => {});
    const showNotice = vi.fn();

    const { result } = renderHook(() =>
      usePromoteAndInsert({ tryInsert, refreshScopes, showNotice }),
    );

    await act(async () => {
      await result.current.promoteAndInsert(item, {
        tab: "web",
        stagingScope: "web",
      });
    });

    expect(tryInsert).toHaveBeenCalled();
    expect(refreshScopes).not.toHaveBeenCalled();
    expect(showNotice).not.toHaveBeenCalled();
  });
});
