import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { Workspace } from "@/components/workspace/Workspace";
import { STALE_NOTICE_TEXT } from "@/components/workspace/translation/translationLabels";
import { clearLessonEditorStateCache } from "@/lib/lesson-editor-state-cache";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import type { Series } from "@/lib/schema";
import type { WorkspaceMeta } from "@/lib/workspace-meta";

/**
 * 「いま編集している本文」が編集言語に従うことの結合テスト（studio-translation spec）。
 *
 * 事故の経緯: 英語ビューの入力が日本語の保存経路へ流れ `contents.md` を英文で
 * 上書きした。同じ根で、コメント→AI プロンプトの同期が**日本語本文**に対して
 * 引かれていたため、英語ビューでは同期しない／無関係なコメントが飛ぶ状態だった。
 */

/**
 * `next/dynamic` は jsdom では ref を読み込み後のコンポーネントへ渡さないため、
 * ペイン2 が `editorRef` からスクロール要素を取れずに落ちる（アプリの不具合ではなく
 * テスト環境の差）。loader を解決して ref を素通しする最小の代替に差し替える。
 */
vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: (loader: () => Promise<unknown>) => {
      let loaded: unknown = null;
      const ready = loader().then((mod) => {
        loaded = mod;
      });
      return React.forwardRef(function Dynamic(
        props: Record<string, unknown>,
        ref: React.Ref<unknown>,
      ) {
        const [, bump] = React.useState(0);
        React.useEffect(() => {
          if (!loaded) void ready.then(() => bump((n) => n + 1));
        }, []);
        if (!loaded) return null;
        return React.createElement(
          loaded as React.ComponentType<Record<string, unknown>>,
          { ...props, ref },
        );
      });
    },
  };
});

const JA_BODY = [
  "# 三大エリア",
  "",
  "<!-- 日本語のプロンプト -->",
  "",
  "本文です。",
].join("\n");

const EN_BODY = ["# Three areas", "", "<!-- English prompt -->", ""].join("\n");

const series: Series[] = [
  {
    id: "srs-1",
    name: "Gitシリーズ",
    slug: "git",
    catch: "",
    description: "",
    courses: [
      {
        id: "crs-1",
        name: "概念コース",
        slug: "concepts",
        catch: "",
        description: "",
        target: "",
        style: "self-study",
        cross_series_prev: [],
        cross_series_next: [],
        lessons: [
          {
            id: "lsn-1",
            series: "Gitシリーズ",
            course: "概念コース",
            lesson: "三大エリア",
            slug: "three-areas",
            status: "done",
            description: "",
            tags: [],
            estimated_minutes: 10,
            author: "",
            content: JA_BODY,
          },
        ],
      },
    ],
  },
];

const workspace: WorkspaceMeta = {
  name: "DX Training Studio",
  icon: "sparkles",
};

/** 鮮度スタブ。赤字の置き場テストだけ true にする */
let staleStatus = false;

type Call = [RequestInfo | URL, RequestInit | undefined];

function stubFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    if (url.startsWith("/api/content/lesson-en")) {
      return json({ exists: true, body: EN_BODY, sourceHash: null });
    }
    if (url.startsWith("/api/content/translation-status")) {
      return json({
        statuses: staleStatus
          ? {
              lesson: {
                meta: "stale",
                metaMissing: [],
                body: "stale",
                bodyMissing: false,
              },
            }
          : {},
        changelog: null,
        changelogMissing: false,
      });
    }
    if (url.startsWith("/api/content/mtime")) {
      return json({ mtime: 1, fingerprint: "f1" });
    }
    if (url.startsWith("/api/content/load")) {
      return json(series);
    }
    if (url.startsWith("/api/images/list")) {
      return json({ files: [] });
    }
    if (url.startsWith("/api/agent/skills")) {
      return json({ skills: [] });
    }
    if (url.startsWith("/api/agent/files")) {
      return json({ files: [] });
    }
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function savesTo(fetchMock: ReturnType<typeof stubFetch>) {
  return (fetchMock.mock.calls as unknown as Call[])
    .filter(([url, init]) =>
      String(url).startsWith("/api/content/save-lesson") && init?.method === "POST",
    )
    .map(([, init]) => JSON.parse(String(init?.body)) as {
      language?: string;
      content: string;
    });
}

function editorContent(): HTMLElement {
  const el = document.querySelector(".cm-content");
  if (!el) throw new Error("CodeMirror content not found");
  return el as HTMLElement;
}

async function toEnglish() {
  screen.getByRole("button", { name: "英語ビューに切り替える" }).click();
  await waitFor(() =>
    expect(editorContent().textContent).toContain("Three areas"),
  );
}

async function toJapanese() {
  screen.getByRole("button", { name: "日本語ビューに戻る" }).click();
  await waitFor(() =>
    expect(editorContent().textContent).toContain("三大エリア"),
  );
}

async function renderWorkspaceInEnglish() {
  const fetchMock = stubFetch();
  render(<Workspace initialSeries={series} workspace={workspace} />);

  // 編集ビューのエディタは dynamic import。日本語本文が出るまで待つ
  await waitFor(() => expect(editorContent().textContent).toContain("三大エリア"));

  await toEnglish();
  return fetchMock;
}

beforeEach(() => {
  // jsdom は matchMedia を実装していない（テーマ解決とサイドバーが参照する）
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  staleStatus = false;
  clearLessonEditorStateCache();
  localStorage.clear();
  // ペイン4 は画像ビューで開く（AI タブのプロンプト欄を見るため）
  localStorage.setItem(STORAGE_KEYS.pane4View, "images");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ワークスペース全体を描画する（CodeMirror・ペイン4 まで含む）ため、
// 既定の 5s では並列実行時に足りない
describe("翻訳が古いことの赤字の置き場", { timeout: 30_000 }, () => {
  it("レッスン本文の英語ビューではヘッダーのタイトル右隣に出る", async () => {
    staleStatus = true;
    await renderWorkspaceInEnglish();

    const notice = await screen.findByText(STALE_NOTICE_TEXT);
    // ヘッダー（h2 と同じ行）に居ること
    const header = document.querySelector("h2")?.parentElement;
    expect(header?.contains(notice)).toBe(true);
    // タイトルの後ろに並ぶこと
    const h2 = document.querySelector("h2") as HTMLElement;
    expect(
      h2.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("本文領域の先頭位置は鮮度で変わらない", async () => {
    staleStatus = true;
    await renderWorkspaceInEnglish();
    await screen.findByText(STALE_NOTICE_TEXT);
    const staleSiblings = editorContent().closest(".cm-editor")?.parentElement
      ?.parentElement?.childElementCount;

    cleanup();
    clearLessonEditorStateCache();
    staleStatus = false;
    await renderWorkspaceInEnglish();
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();
    const freshSiblings = editorContent().closest(".cm-editor")?.parentElement
      ?.parentElement?.childElementCount;

    expect(staleSiblings).toBe(freshSiblings);
  });

  it("日本語ビューでは出ない", async () => {
    staleStatus = true;
    stubFetch();
    render(<Workspace initialSeries={series} workspace={workspace} />);
    await waitFor(() =>
      expect(editorContent().textContent).toContain("三大エリア"),
    );
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();
  });
});

describe("編集言語に従う本文の経路", { timeout: 30_000 }, () => {
  it("英語ビューのコメントが AI タブのプロンプトへ同期する", async () => {
    await renderWorkspaceInEnglish();

    const aiTab = await screen.findByRole("button", { name: /AI/ });
    aiTab.click();

    const prompt = await screen.findByPlaceholderText<HTMLTextAreaElement>(
      "画像生成プロンプトを入力してください",
    );

    // 英語本文のコメント内へカーソルを移す
    const offset = EN_BODY.indexOf("English prompt");
    const view = EditorView.findFromDOM(document.body as HTMLElement);
    if (!view) throw new Error("EditorView not found");
    view.dispatch({ selection: { anchor: offset } });

    await waitFor(() => expect(prompt.value).toBe("English prompt"));
    expect(prompt.value).not.toBe("日本語のプロンプト");
  });

  it("言語を往復した後でも英語ビューの編集は contents.en.md へ保存される", async () => {
    const fetchMock = await renderWorkspaceInEnglish();

    // 事故の再現手順: ja → en → ja → en（2回目の英語ビューが state を復元する）
    await toJapanese();
    await toEnglish();

    const view = EditorView.findFromDOM(document.body as HTMLElement);
    if (!view) throw new Error("EditorView not found");
    const at = view.state.doc.length;
    view.dispatch({ changes: { from: at, insert: "Edited." } });

    await waitFor(() => expect(savesTo(fetchMock).length).toBeGreaterThan(0));
    const saves = savesTo(fetchMock);
    expect(saves.every((s) => s.language === "en")).toBe(true);
    expect(saves.some((s) => s.content.includes("Edited."))).toBe(true);
  });
});
