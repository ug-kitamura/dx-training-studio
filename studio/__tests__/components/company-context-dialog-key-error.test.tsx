import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CompanyContextDialog } from "@/components/workspace/CompanyContextDialog";
import { AI_KEY_ERROR } from "@/lib/api-keys";

// AI整形の 401（キー未設定）で設定ダイアログを開く——company-context-dialog spec。
// 判定はサーバーと共有する AI_KEY_ERROR 定数との一致で行う（文言分裂すると恒偽になる）。

// jsdom は matchMedia を実装していない（BusySpinner のテーマ解決が参照する）
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const originalFetch = global.fetch;

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

function stubFetch(formatResponse: () => Response) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/context/format")) return formatResponse();
    if (url.includes("/api/context/items")) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (url.includes("/api/context/tags")) {
      return new Response(JSON.stringify({ tags: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as never;
}

async function openFormAndFormat() {
  const onOpenSettings = vi.fn();
  render(
    <CompanyContextDialog
      open
      onOpenChange={() => {}}
      onOpenSettings={onOpenSettings}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "新規追加" }));
  fireEvent.change(screen.getByLabelText("本文"), {
    target: { value: "整形対象のテキスト" },
  });
  fireEvent.click(screen.getByRole("button", { name: "AI整形" }));
  return onOpenSettings;
}

describe("CompanyContextDialog のキー未設定 401", () => {
  it("キー未設定の 401 で設定ダイアログを開く", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: AI_KEY_ERROR }), { status: 401 }),
    );
    const onOpenSettings = await openFormAndFormat();
    await waitFor(() => {
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(AI_KEY_ERROR)).toBeTruthy();
  });

  it("キー以外の理由の 401 では設定ダイアログを開かない", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: "トークンが失効しています" }), {
          status: 401,
        }),
    );
    const onOpenSettings = await openFormAndFormat();
    await waitFor(() => {
      expect(screen.getByText("トークンが失効しています")).toBeTruthy();
    });
    expect(onOpenSettings).not.toHaveBeenCalled();
  });
});
