import { describe, expect, it, afterEach, beforeAll, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";

// SidebarProvider（use-mobile）が参照する matchMedia は jsdom に無い
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});
import { SidebarProvider } from "@/components/ui/sidebar";
import { ContentTreePane } from "@/components/workspace/ContentTreePane";
import { HOME_ROW_ID, seriesRowId } from "@/lib/content-tree-flatten";
import { TREE_COLLAPSE_COOKIE_NAME } from "@/lib/tree-collapse-cookie";
import type { Series } from "@/lib/schema";

// ミニ曼陀羅（React Flow）はこのテストの対象外。jsdom での描画副作用を避ける
vi.mock("@/components/workspace/MiniMandalaSection", () => ({
  MiniMandalaSection: () => null,
}));

const series: Series[] = [
  {
    id: "srs-1",
    name: "Git基礎シリーズ",
    courses: [
      {
        id: "crs-1",
        name: "Git概念コース",
        target: "",
        cross_series_prev: [],
        cross_series_next: [],
        lessons: [
          {
            id: "lsn-1",
            series: "Git基礎シリーズ",
            course: "Git概念コース",
            lesson: "バージョン管理ってなに？",
            status: "done",
            content: "",
            description: "",
            tags: [],
            estimated_minutes: 10,
            author: "",
          },
          {
            id: "lsn-2",
            series: "Git基礎シリーズ",
            course: "Git概念コース",
            lesson: "Gitの三大エリア",
            status: "open",
            content: "",
            description: "",
            tags: [],
            estimated_minutes: 15,
            author: "",
          },
        ],
      },
    ],
  },
];

function noop() {}

function renderTree(overrides: Partial<Parameters<typeof ContentTreePane>[0]> = {}) {
  const handlers = {
    onSelectHome: vi.fn(),
    onSelectSeries: vi.fn(),
    onSelectCourse: vi.fn(),
    onSelectLesson: vi.fn(),
    onUpdateLessonStatus: vi.fn(),
  };
  render(
    <SidebarProvider defaultOpen>
      <ContentTreePane
        workspaceName="DX Training Studio"
        editLanguage="ja"
        series={series}
        selectedSeriesId="srs-1"
        selectedCourseId=""
        selectedLessonId=""
        onSelectHome={handlers.onSelectHome}
        onSelectSeries={handlers.onSelectSeries}
        onSelectCourse={handlers.onSelectCourse}
        onSelectLesson={handlers.onSelectLesson}
        onReorderSeries={noop}
        onReorderCourses={noop}
        onReorderLessons={noop}
        onAddSeries={() => "srs-new"}
        onAddCourse={noop}
        onAddLesson={noop}
        onDeleteSeries={noop}
        onDeleteCourse={noop}
        onDeleteLesson={noop}
        onUpdateSeriesName={noop}
        onUpdateCourseMeta={noop}
        onUpdateLessonMeta={noop}
        onUpdateLessonStatus={handlers.onUpdateLessonStatus}
        {...overrides}
      />
    </SidebarProvider>,
  );
  return handlers;
}

function treeContainer(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-slot="sidebar-content"]');
  if (!el) throw new Error("sidebar-content not found");
  return el;
}

function rowById(rowId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-row-id="${rowId}"]`);
  if (!el) throw new Error(`row not found: ${rowId}`);
  return el;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // ⚠ ツリーの開閉は cookie に保存される（`lib/tree-collapse-cookie.ts`）。
  // 復元はサーバーが props で渡す設計なので、jsdom の cookie が次のマウントへ
  // 影響することは無いが、テスト間で残さないよう消しておく
  document.cookie = `${TREE_COLLAPSE_COOKIE_NAME}=; path=/; max-age=0`;
});

describe("ContentTreePane", () => {
  it("ホーム行と3階層、シリーズ行右端の完了/総レッスン数を表示する", () => {
    renderTree();
    expect(screen.getByText("ホーム")).toBeDefined();
    expect(screen.getByText("Git基礎シリーズ")).toBeDefined();
    expect(screen.getByText("Git概念コース")).toBeDefined();
    expect(screen.getByText("Gitの三大エリア")).toBeDefined();
    // done 1 / 総 2
    expect(screen.getByText("1/2")).toBeDefined();
  });

  it("ホーム行クリックで onSelectHome が呼ばれる", () => {
    const handlers = renderTree();
    fireEvent.click(screen.getByText("ホーム"));
    expect(handlers.onSelectHome).toHaveBeenCalled();
  });

  it("英語ビューではホーム行のラベルが Home になる", () => {
    renderTree({ editLanguage: "en" });
    expect(screen.getByText("Home")).toBeDefined();
    expect(screen.queryByText("ホーム")).toBeNull();
  });

  it("英語ビューのホーム行はワークスペース名を出さない", () => {
    // ホーム行はナビゲーションの原点であり、コンテンツ名の表示行ではない
    // （unified-content-tree spec）。他ホストの表示名に引きずられないこと
    renderTree({ editLanguage: "en", workspaceName: "DX Training Mandala" });
    expect(rowById(HOME_ROW_ID).textContent).toContain("Home");
    expect(rowById(HOME_ROW_ID).textContent).not.toContain("DX Training Mandala");
  });

  it("レッスン行クリックで onSelectLesson が呼ばれる", () => {
    const handlers = renderTree();
    fireEvent.click(screen.getByText("Gitの三大エリア"));
    expect(handlers.onSelectLesson).toHaveBeenCalledWith("lsn-2");
  });

  it("未選択の開いているシリーズ行のクリックは選択するが畳まない", () => {
    // 選択はコース階層に置き、シリーズ行を「未選択の行」にする
    const handlers = renderTree({ selectedCourseId: "crs-1" });
    fireEvent.click(screen.getByText("Git基礎シリーズ"));
    expect(handlers.onSelectSeries).toHaveBeenCalledWith("srs-1");
    // 開いたままなのでコースは見えている
    expect(screen.getByText("Git概念コース")).toBeDefined();
  });

  it("選択済みのシリーズ行の再クリックは開閉をトグルする", () => {
    // 既定 props はシリーズ srs-1 が選択済み
    renderTree();
    fireEvent.click(screen.getByText("Git基礎シリーズ"));
    expect(screen.queryByText("Git概念コース")).toBeNull();
    fireEvent.click(screen.getByText("Git基礎シリーズ"));
    expect(screen.getByText("Git概念コース")).toBeDefined();
  });

  it("未選択の閉じているシリーズ行のクリックは選択して展開する", () => {
    const handlers = renderTree({ selectedCourseId: "crs-1" });
    // chevron で畳んでからクリック
    fireEvent.click(screen.getByLabelText("シリーズを折りたたむ"));
    expect(screen.queryByText("Git概念コース")).toBeNull();
    fireEvent.click(screen.getByText("Git基礎シリーズ"));
    expect(handlers.onSelectSeries).toHaveBeenCalledWith("srs-1");
    expect(screen.getByText("Git概念コース")).toBeDefined();
  });

  it("シリーズを開き直しても配下コースの開閉状態は保たれる", () => {
    renderTree();
    // コースを畳む → シリーズを畳む → シリーズ行クリックで開き直す
    fireEvent.click(screen.getByLabelText("コースを折りたたむ"));
    fireEvent.click(screen.getByLabelText("シリーズを折りたたむ"));
    fireEvent.click(screen.getByText("Git基礎シリーズ"));
    // シリーズは開くが、コースは畳んだままなのでレッスンは出ない
    expect(screen.getByText("Git概念コース")).toBeDefined();
    expect(screen.queryByText("Gitの三大エリア")).toBeNull();
  });

  it("Enter は未選択の開いている行を畳まない", () => {
    // 選択＝コース階層。カーソル初期位置は選択行（コース行）→ ↑ でシリーズ行へ
    renderTree({ selectedCourseId: "crs-1" });
    const container = treeContainer();
    fireEvent.keyDown(container, { key: "ArrowUp" });
    fireEvent.keyDown(container, { key: "Enter" });
    expect(screen.getByText("Git概念コース")).toBeDefined();
  });

  it("Enter は選択済みの行では開閉をトグルする", () => {
    renderTree();
    const container = treeContainer();
    // カーソル初期位置は選択行（シリーズ行）
    fireEvent.keyDown(container, { key: "Enter" });
    expect(screen.queryByText("Git概念コース")).toBeNull();
  });

  it("外部要因で選択が変わるとカーソル背景も追随する", () => {
    // 曼陀羅ナビゲーション等、ツリー外から選択が変わるケースを props の
    // 差し替えで再現する
    const props = {
      workspaceName: "DX Training Studio",
      series,
      selectedSeriesId: "srs-1",
      selectedCourseId: "",
      selectedLessonId: "",
      onSelectHome: noop,
      onSelectSeries: noop,
      onSelectCourse: noop,
      onSelectLesson: noop,
      onReorderSeries: noop,
      onReorderCourses: noop,
      onReorderLessons: noop,
      onAddSeries: () => "srs-new",
      onAddCourse: noop,
      onAddLesson: noop,
      onDeleteSeries: noop,
      onDeleteCourse: noop,
      onDeleteLesson: noop,
      onUpdateSeriesName: noop,
      onUpdateCourseMeta: noop,
      onUpdateLessonMeta: noop,
      onUpdateLessonStatus: noop,
      editLanguage: "ja" as const,
    };
    const { rerender } = render(
      <SidebarProvider defaultOpen>
        <ContentTreePane {...props} />
      </SidebarProvider>,
    );
    rerender(
      <SidebarProvider defaultOpen>
        <ContentTreePane
          {...props}
          selectedCourseId="crs-1"
          selectedLessonId="lsn-2"
        />
      </SidebarProvider>,
    );
    expect(rowById("lesson:lsn-2").className).toContain(
      "bg-workspace-tree-row",
    );
  });

  it("カーソル行が折りたたみで消えたら祖先へ付け替わる", () => {
    const handlers = renderTree();
    // レッスン行へカーソルを移す（シリーズ → コース → レッスン）
    const container = treeContainer();
    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "ArrowDown" });
    // コースを畳むとカーソル行（レッスン）が消える → コース行へ付け替わる
    fireEvent.click(screen.getByLabelText("コースを折りたたむ"));
    fireEvent.keyDown(container, { key: "Enter" });
    expect(handlers.onSelectCourse).toHaveBeenCalledWith("crs-1");
  });

  it("選択行だけが太字になる（シリーズ常時太字は廃止）", () => {
    renderTree({ selectedSeriesId: "srs-1", selectedCourseId: "crs-1" });
    expect(rowById("course:crs-1").className).toContain("font-semibold");
    expect(rowById("series:srs-1").className).not.toContain("font-semibold");
  });

  it("選択を含むシリーズブロックに青レールが付く", () => {
    renderTree();
    const block = rowById("series:srs-1").parentElement;
    expect(block?.className).toContain("before:bg-primary");
  });

  it("ステータスボタンは循環値で onUpdateLessonStatus を呼び、行選択を発生させない", () => {
    const handlers = renderTree();
    // lsn-2 は open → クリックで in_progress へ
    const statusButtons = screen.getAllByLabelText("未着手、クリックで変更");
    fireEvent.click(statusButtons[0]);
    expect(handlers.onUpdateLessonStatus).toHaveBeenCalledWith(
      "lsn-2",
      "in_progress",
    );
    expect(handlers.onSelectLesson).not.toHaveBeenCalled();
  });

  it("chevron クリックは開閉のみで選択を変えない", () => {
    const handlers = renderTree();
    fireEvent.click(screen.getByLabelText("コースを折りたたむ"));
    // 折りたたまれてレッスンが消える
    expect(screen.queryByText("Gitの三大エリア")).toBeNull();
    expect(handlers.onSelectCourse).not.toHaveBeenCalled();
    expect(handlers.onSelectSeries).not.toHaveBeenCalled();
  });

  it("矢印キーで移動し Enter で選択できる", () => {
    const handlers = renderTree();
    const container = treeContainer();
    // カーソルの初期位置は選択行（シリーズ行）。コース行 → レッスン行へ降りる
    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "Enter" });
    expect(handlers.onSelectLesson).toHaveBeenCalledWith("lsn-1");
  });

  it("F2 でリネームダイアログが開く", async () => {
    renderTree();
    fireEvent.click(screen.getByText("Gitの三大エリア"));
    fireEvent.keyDown(treeContainer(), { key: "F2" });
    await waitFor(() => {
      expect(screen.getByText("レッスン名を変更")).toBeDefined();
    });
  });

  it("Delete で削除確認ダイアログが開く", async () => {
    renderTree();
    fireEvent.click(screen.getByText("Gitの三大エリア"));
    fireEvent.keyDown(treeContainer(), { key: "Delete" });
    await waitFor(() => {
      expect(screen.getByText("レッスンを削除しますか？")).toBeDefined();
    });
  });

  it("Ctrl+C → Ctrl+V でレッスンの複製 API を呼ぶ", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderTree();
    const container = treeContainer();
    fireEvent.click(screen.getByText("Gitの三大エリア"));
    fireEvent.keyDown(container, { key: "c", ctrlKey: true });
    // コース行へカーソルを移して paste（lsn-2 → lsn-1 → コース行）
    fireEvent.keyDown(container, { key: "ArrowUp" });
    fireEvent.keyDown(container, { key: "ArrowUp" });
    fireEvent.keyDown(container, { key: "v", ctrlKey: true });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/content/duplicate",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const body = JSON.parse(
      (fetchMock.mock.calls.find(
        (c) => c[0] === "/api/content/duplicate",
      )?.[1] as RequestInit).body as string,
    ) as Record<string, string>;
    expect(body).toMatchObject({
      type: "lesson",
      lesson: "Gitの三大エリア",
      targetCourse: "Git概念コース",
    });
  });

  it("名前フィルタで一致レッスンと祖先だけが残る", () => {
    renderTree();
    const input = screen.getByPlaceholderText(
      "Filter... (? to search contents)",
    );
    fireEvent.change(input, { target: { value: "三大" } });
    expect(screen.getByText("Gitの三大エリア")).toBeDefined();
    expect(screen.queryByText("バージョン管理ってなに？")).toBeNull();
    // クリアで全件へ戻る
    fireEvent.click(screen.getByLabelText("検索をクリア"));
    expect(screen.getByText("バージョン管理ってなに？")).toBeDefined();
  });

  it("? 入力でコンテンツ検索 API を呼び、一致でツリーを絞る", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          matches: [
            {
              series: "Git基礎シリーズ",
              course: "Git概念コース",
              lesson: "Gitの三大エリア",
            },
          ],
          truncated: false,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderTree();
    const input = screen.getByPlaceholderText(
      "Filter... (? to search contents)",
    );
    fireEvent.change(input, { target: { value: "?ステージ" } });
    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalled();
        expect(screen.queryByText("バージョン管理ってなに？")).toBeNull();
        expect(screen.getByText("Gitの三大エリア")).toBeDefined();
      },
      { timeout: 2000 },
    );
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/content/search?q=");
  });

  it("右クリックメニューに properties が無い", async () => {
    renderTree();
    fireEvent.contextMenu(screen.getByText("Git概念コース"));
    await screen.findByText("add lesson");
    expect(screen.queryByText("properties")).toBeNull();
  });

  it("collapse all は選択への道だけ残して畳む", async () => {
    // レッスン lsn-1 を選択 → 祖先（srs-1 / crs-1）は開いたまま残る
    renderTree({
      selectedSeriesId: "srs-1",
      selectedCourseId: "crs-1",
      selectedLessonId: "lsn-1",
    });
    fireEvent.contextMenu(screen.getByText("ホーム"));
    const item = await screen.findByText("collapse all");
    fireEvent.click(item);
    // 選択の祖先は畳まれないので、レッスンは見えたまま
    expect(screen.getByText("バージョン管理ってなに？")).toBeDefined();
  });

  it("collapse all は選択中のシリーズ自身も畳む", async () => {
    // シリーズだけ選択 → 祖先は無いのでシリーズ自身が畳まれ、配下が消える
    renderTree();
    fireEvent.contextMenu(screen.getByText("ホーム"));
    const item = await screen.findByText("collapse all");
    fireEvent.click(item);
    expect(screen.queryByText("Git概念コース")).toBeNull();
    expect(screen.queryByText("Gitの三大エリア")).toBeNull();
    // シリーズ行そのものは畳んでも見えている（選択が迷子にならない）
    expect(screen.getByText("Git基礎シリーズ")).toBeDefined();
  });

  it("collapse all のあとカーソルは選択中の行に移る", async () => {
    // メニューを開いた時点でカーソルは右クリックした場所（ホーム／空きスペース）へ
    // 移る。畳んだ後もそこがハイライトされたままだと、選択の在り処が分からなくなる
    renderTree(); // 選択はシリーズ srs-1
    fireEvent.contextMenu(screen.getByText("ホーム"));
    fireEvent.click(await screen.findByText("collapse all"));

    const rowOf = (id: string) =>
      document.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
    // ⚠ `classList` で見ること——素朴な部分文字列だと `hover:bg-workspace-tree-row` に当たる
    expect(
      rowOf(seriesRowId("srs-1"))?.classList.contains("bg-workspace-tree-row"),
    ).toBe(true);
    expect(
      rowOf(HOME_ROW_ID)?.classList.contains("bg-workspace-tree-row"),
    ).toBe(false);
  });

  it("collapse all は畳み済みの選択中シリーズを展開しない", async () => {
    // 報告されたバグ: 選択自身を畳む対象から外していたため、畳み済みが逆に開いていた
    renderTree({ initialCollapse: { series: ["srs-1"], courses: [] } });
    expect(screen.queryByText("Git概念コース")).toBeNull();
    fireEvent.contextMenu(screen.getByText("ホーム"));
    const item = await screen.findByText("collapse all");
    fireEvent.click(item);
    expect(screen.queryByText("Git概念コース")).toBeNull();
  });

  it("シリーズ 0 件では右クリック案内の空状態を表示する", () => {
    render(
      <SidebarProvider defaultOpen>
        <ContentTreePane
          workspaceName="DX Training Studio"
        editLanguage="ja"
          series={[]}
          selectedSeriesId=""
          selectedCourseId=""
          selectedLessonId=""
          onSelectHome={noop}
          onSelectSeries={noop}
          onSelectCourse={noop}
          onSelectLesson={noop}
          onReorderSeries={noop}
          onReorderCourses={noop}
          onReorderLessons={noop}
          onAddSeries={() => "srs-new"}
          onAddCourse={noop}
          onAddLesson={noop}
          onDeleteSeries={noop}
          onDeleteCourse={noop}
          onDeleteLesson={noop}
          onUpdateSeriesName={noop}
          onUpdateCourseMeta={noop}
          onUpdateLessonMeta={noop}
          onUpdateLessonStatus={noop}
        />
      </SidebarProvider>,
    );
    expect(
      screen.getByText(/右クリックからシリーズを追加できます/),
    ).toBeDefined();
  });
});

describe("階層のインデント（tree-indent-tighten）", () => {
  it("コース群・レッスン群の子コンテナは同じ定数で、線は ml-[14px]・線から行は pl-0", () => {
    renderTree();
    const guides = [
      ...treeContainer().querySelectorAll<HTMLElement>(".border-l"),
    ].filter((el) => el.className.includes("ml-[14px]"));
    // シリーズ配下（コース群）とコース配下（レッスン群）の 2 つ
    expect(guides).toHaveLength(2);
    for (const guide of guides) {
      // 3 区間（レール→シリーズ線 13 / シリーズ線→コース線 14 / コース線→レッスン 13）を
      // 揃えるため pl は 0。ml を変えるとシリーズ線が動くので据え置き
      expect(guide.className).toContain("pl-0");
      expect(guide.className).not.toMatch(/pl-\[\d+px\]/);
    }
    expect(guides[0]!.className).toBe(guides[1]!.className);
  });
});
