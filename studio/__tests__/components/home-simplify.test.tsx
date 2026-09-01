import { describe, expect, it, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { WorkspaceMetaView } from "@/components/workspace/meta-views/WorkspaceMetaView";
import { NO_TRANSLATION_NOTICE } from "@/lib/translation/client";

const translationProps = {
  editLanguage: "ja" as const,
  translationNotice: NO_TRANSLATION_NOTICE,
};

type Call = [RequestInfo | URL, RequestInit | undefined];

function stubFetch(options: { changelog?: string } = {}) {
  const changelog = options.changelog ?? "## 2026-08-01\n\n- 既存エントリ\n";
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/content/workspace-meta")) {
      if (init?.method === "PUT") {
        return Promise.resolve(new Response("{}", { status: 200 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            name: "DX Training Mandala",
            description: "全体説明",
            hero: "hero-1.png",
            github_url: "https://github.com/x/y",
          }),
          { status: 200 },
        ),
      );
    }
    if (url.startsWith("/api/content/changelog")) {
      if (init?.method === "PUT") {
        return Promise.resolve(
          new Response(JSON.stringify({ mtimeMs: 2 }), { status: 200 }),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            exists: true,
            content: changelog,
            mtimeMs: 1,
            firstEntryDate: "2026-08-01",
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function putsTo(fetchMock: ReturnType<typeof stubFetch>, prefix: string) {
  return (fetchMock.mock.calls as unknown as Call[]).filter(
    ([url, init]) => String(url).startsWith(prefix) && init?.method === "PUT",
  );
}

async function renderHome() {
  render(<WorkspaceMetaView workspaceName="DX Training Studio" {...translationProps} />);
  const nameInput = await screen.findByLabelText<HTMLInputElement>("名前");
  await waitFor(() => expect(nameInput.value).toBe("DX Training Mandala"));
  await waitFor(() =>
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("変更履歴").value,
    ).toContain("既存エントリ"),
  );
  return nameInput;
}

describe("ホームの保存は1つ・dirty なものだけ書く", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("保存ボタンはホームに1つだけ（「履歴を保存」は無い）", async () => {
    stubFetch();
    await renderHome();
    expect(screen.getAllByRole("button", { name: /保存/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "履歴を保存" })).toBeNull();
    expect(screen.queryByRole("button", { name: "この内容で保存" })).toBeNull();
  });

  it("名前だけ変更した保存は changelog に書かない", async () => {
    const fetchMock = stubFetch();
    const nameInput = await renderHome();

    fireEvent.change(nameInput, { target: { value: "新しいサイト名" } });
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() =>
      expect(putsTo(fetchMock, "/api/content/workspace-meta")).toHaveLength(1),
    );
    expect(putsTo(fetchMock, "/api/content/changelog")).toHaveLength(0);
  });

  it("履歴だけ変更した保存は全体メタに書かない", async () => {
    const fetchMock = stubFetch();
    await renderHome();

    fireEvent.change(screen.getByLabelText("変更履歴"), {
      target: { value: "## 2026-08-22\n\n- 新しいエントリ\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() =>
      expect(putsTo(fetchMock, "/api/content/changelog")).toHaveLength(1),
    );
    expect(putsTo(fetchMock, "/api/content/workspace-meta")).toHaveLength(0);
  });

  it("何も変更していない保存はどちらにも書かない", async () => {
    const fetchMock = stubFetch();
    await renderHome();

    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => expect(screen.getByText("保存しました")).toBeTruthy());
    expect(putsTo(fetchMock, "/api/content/workspace-meta")).toHaveLength(0);
    expect(putsTo(fetchMock, "/api/content/changelog")).toHaveLength(0);
  });

  it("両方変更した保存は両方に書く", async () => {
    const fetchMock = stubFetch();
    const nameInput = await renderHome();

    fireEvent.change(nameInput, { target: { value: "新しいサイト名" } });
    fireEvent.change(screen.getByLabelText("変更履歴"), {
      target: { value: "## 2026-08-22\n\n- 新しいエントリ\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() =>
      expect(putsTo(fetchMock, "/api/content/workspace-meta")).toHaveLength(1),
    );
    await waitFor(() =>
      expect(putsTo(fetchMock, "/api/content/changelog")).toHaveLength(1),
    );
  });
});

describe("AI 下書きは正本に書かない", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /** 下書き API が1件返すようにした stub */
  function stubFetchWithDraft() {
    const base = stubFetch();
    const withDraft = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/content/changelog/draft")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              entry: "## 2026-08-22\n\n- AI が書いた項目\n",
              notes: [],
              baselineDate: "2026-08-01",
              usedLessons: [],
              truncated: false,
            }),
            { status: 200 },
          ),
        );
      }
      return base(input, init);
    });
    vi.stubGlobal("fetch", withDraft);
    return withDraft;
  }

  it("反映しただけでは正本に書かず、その後の保存で書かれる", async () => {
    const fetchMock = stubFetchWithDraft();
    await renderHome();

    fireEvent.click(screen.getByRole("button", { name: "AI で下書き" }));
    const apply = await screen.findByRole("button", { name: "反映" });

    // 「この内容で保存」は存在しない（AI が正本に書く経路をゼロにした）
    expect(screen.queryByRole("button", { name: "この内容で保存" })).toBeNull();

    fireEvent.click(apply);

    // 反映では PUT が飛ばない。textarea にだけ入る
    await waitFor(() =>
      expect(
        screen.getByLabelText<HTMLTextAreaElement>("変更履歴").value,
      ).toContain("AI が書いた項目"),
    );
    expect(putsTo(fetchMock, "/api/content/changelog")).toHaveLength(0);

    // 保存して初めて正本へ書かれる
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() =>
      expect(putsTo(fetchMock, "/api/content/changelog")).toHaveLength(1),
    );
    const body = JSON.parse(
      putsTo(fetchMock, "/api/content/changelog")[0]![1]!.body as string,
    ) as { content: string };
    expect(body.content).toContain("AI が書いた項目");
    expect(body.content).toContain("既存エントリ");
  });

  it("下書きは基準日を送らない（既定にサーバが従う）", async () => {
    const fetchMock = stubFetchWithDraft();
    await renderHome();

    fireEvent.click(screen.getByRole("button", { name: "AI で下書き" }));
    await screen.findByRole("button", { name: "反映" });

    const draftCall = (fetchMock.mock.calls as unknown as Call[]).find(([url]) =>
      String(url).startsWith("/api/content/changelog/draft"),
    );
    expect(draftCall).toBeDefined();
    expect(JSON.parse(draftCall![1]!.body as string)).toEqual({});
  });
});

describe("ホームから削った仕掛け", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("ヒーロー画像の項目が無い", async () => {
    stubFetch();
    await renderHome();
    expect(screen.queryByLabelText("ヒーロー画像")).toBeNull();
    expect(document.body.textContent).not.toContain("mandala/app/hero.jpg");
  });

  it("画像一覧を取りに行かない", async () => {
    const fetchMock = stubFetch();
    await renderHome();
    const imageCalls = (fetchMock.mock.calls as unknown as Call[]).filter(
      ([url]) => String(url).includes("/api/images/"),
    );
    expect(imageCalls).toHaveLength(0);
  });

  it("変更履歴は折りたたまずに開いている", async () => {
    stubFetch();
    await renderHome();
    // 開閉ボタンが無く、textarea が最初から見えている
    expect(screen.queryByRole("button", { expanded: false })).toBeNull();
    expect(screen.getByLabelText("変更履歴")).toBeTruthy();
  });

  it("基準日の入力が無い", async () => {
    stubFetch();
    await renderHome();
    expect(screen.queryByLabelText("基準日")).toBeNull();
    expect(document.body.textContent).not.toContain("基準日");
  });

  it("AI で下書きは見出し行のボタン列に保存の左隣で並ぶ", async () => {
    stubFetch();
    render(
      <WorkspaceMetaView workspaceName="DX Training Studio" {...translationProps} />,
    );
    await screen.findByLabelText("名前");
    // 見出し行 = 左にタイトル・右にボタン列（⚠ sticky ではない）
    const heading = screen.getByRole("heading", { name: "全体メタを編集" });
    const row = heading.parentElement!;
    const labels = [...row.querySelectorAll("button")].map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toEqual(["AI で下書き", "保存"]);
  });

  it("ボタン列はスクロールに追従しない（sticky を持たない）", async () => {
    stubFetch();
    const { container } = render(
      <WorkspaceMetaView workspaceName="DX Training Studio" {...translationProps} />,
    );
    await screen.findByLabelText("名前");
    // ⚠ 実機で「ついてくるのが違和感」と判明して廃止した。戻さないこと
    expect(container.querySelector(".sticky")).toBeNull();
  });
});
