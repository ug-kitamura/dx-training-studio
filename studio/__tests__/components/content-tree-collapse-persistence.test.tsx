import { describe, expect, it, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

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
import {
  TREE_COLLAPSE_COOKIE_NAME,
  parseTreeCollapseCookie,
  readTreeCollapseCookieFromDocument,
} from "@/lib/tree-collapse-cookie";
import type { Series } from "@/lib/schema";

// ミニ曼陀羅（React Flow）はこのテストの対象外。jsdom での描画副作用を避ける
vi.mock("@/components/workspace/MiniMandalaSection", () => ({
  MiniMandalaSection: () => null,
}));

function lesson(id: string, name: string) {
  return {
    id,
    series: "Git基礎シリーズ",
    course: "Git概念コース",
    lesson: name,
    status: "open" as const,
    content: "",
    description: "",
    tags: [] as string[],
    estimated_minutes: 10,
    author: "",
  };
}

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
        lessons: [lesson("lsn-1", "バージョン管理ってなに？")],
      },
    ],
  },
  {
    id: "srs-2",
    name: "GitHub基礎シリーズ",
    courses: [
      {
        id: "crs-2",
        name: "GitHub入門コース",
        target: "",
        cross_series_prev: [],
        cross_series_next: [],
        lessons: [lesson("lsn-2", "GitHubとは")],
      },
    ],
  },
];

function noop() {}

function renderTree(
  overrides: Partial<Parameters<typeof ContentTreePane>[0]> = {},
) {
  return render(
    <SidebarProvider defaultOpen>
      <ContentTreePane
        workspaceName="DX Training Studio"
        editLanguage="ja"
        series={series}
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
        {...overrides}
      />
    </SidebarProvider>,
  );
}

/** 書かれた cookie。⚠ 未書き込み（記憶なし）は `null` になるので、その判定には `storedCookieRaw` を使う */
function storedCookie() {
  const parsed = parseTreeCollapseCookie(readTreeCollapseCookieFromDocument());
  if (parsed === null) throw new Error("cookie が書かれていない（記憶なし）");
  return parsed;
}

function clearCookie() {
  document.cookie = `${TREE_COLLAPSE_COOKIE_NAME}=; path=/; max-age=0`;
}

beforeEach(clearCookie);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearCookie();
});

describe("ツリーの開閉状態の永続化（cookie → props）", () => {
  it("initialCollapse で渡したシリーズの配下は最初から出ない", () => {
    renderTree({ initialCollapse: { series: ["srs-2"], courses: [] } });

    expect(screen.getByText("GitHub基礎シリーズ")).toBeDefined();
    expect(screen.queryByText("GitHub入門コース")).toBeNull();
    // 畳んでいないシリーズは展開のまま
    expect(screen.getByText("Git概念コース")).toBeDefined();
  });

  it("initialCollapse のコースも効く", () => {
    renderTree({ initialCollapse: { series: [], courses: ["crs-1"] } });

    expect(screen.getByText("Git概念コース")).toBeDefined();
    expect(screen.queryByText("バージョン管理ってなに？")).toBeNull();
  });

  it("省略時（サーバーが全展開を渡したとき）は全展開で始まる", () => {
    // ⚠ ここで検証しているのは「渡された集合どおりに描く」だけ。
    // 「記憶が無いとき全折りたたみで始まる」は**サーバー側**の責務で、
    // `__tests__/lib/tree-collapse-cookie.test.ts` の `allCollapsed` が持つ
    renderTree();

    expect(screen.getByText("Git概念コース")).toBeDefined();
    expect(screen.getByText("GitHub入門コース")).toBeDefined();
  });

  it("畳む操作が cookie に書かれる", () => {
    renderTree();

    fireEvent.click(screen.getAllByLabelText("コースを折りたたむ")[0]);

    expect(storedCookie().courses).toEqual(["crs-1"]);
  });

  it("選択中の行を畳んでも cookie には含まれない（リロードで開くため）", () => {
    renderTree({
      selectedSeriesId: "srs-1",
      selectedCourseId: "crs-1",
      selectedLessonId: "lsn-1",
    });

    // 選択の祖先（srs-1）を畳む
    fireEvent.click(screen.getAllByLabelText("シリーズを折りたたむ")[0]);
    expect(screen.queryByText("Git概念コース")).toBeNull();

    // 画面上は畳まれているが、cookie には書かれない
    expect(storedCookie().series).toEqual([]);
  });

  it("選択と無関係なシリーズは cookie に書かれる", () => {
    renderTree({
      selectedSeriesId: "srs-1",
      selectedCourseId: "crs-1",
      selectedLessonId: "lsn-1",
    });

    // GitHub基礎シリーズ（2つ目）を畳む
    fireEvent.click(screen.getAllByLabelText("シリーズを折りたたむ")[1]);

    expect(storedCookie().series).toEqual(["srs-2"]);
  });

  it("選択が後から届いたら、その祖先を一度だけ開く（保険）", () => {
    const view = renderTree({
      initialCollapse: { series: ["srs-1"], courses: ["crs-1"] },
    });
    expect(screen.queryByText("Git概念コース")).toBeNull();

    // 親の選択復元が届いた体で props を差し替える
    view.rerender(
      <SidebarProvider defaultOpen>
        <ContentTreePane
          workspaceName="DX Training Studio"
          editLanguage="ja"
          series={series}
          selectedSeriesId="srs-1"
          selectedCourseId="crs-1"
          selectedLessonId="lsn-1"
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

    expect(screen.getByText("Git概念コース")).toBeDefined();
    expect(screen.getByText("バージョン管理ってなに？")).toBeDefined();

    // 開いたあとは普通に畳める（保険は一度きり）
    fireEvent.click(screen.getAllByLabelText("シリーズを折りたたむ")[0]);
    expect(screen.queryByText("Git概念コース")).toBeNull();
  });
});
