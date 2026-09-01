import { describe, expect, it, afterEach, beforeAll, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

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
import { Button } from "@/components/ui/button";
import { GlobalHeader } from "@/components/workspace/GlobalHeader";
import { ContentTreePane } from "@/components/workspace/ContentTreePane";
import type { Series } from "@/lib/schema";

// 曼陀羅（React Flow）はこのテストの対象外。import 時点の副作用を避ける
vi.mock("@/components/workspace/mandala/LazyMandala", () => ({
  LazyMandala: () => null,
}));
vi.mock("@/components/workspace/MiniMandalaSection", () => ({
  MiniMandalaSection: () => null,
}));

const headerProps = {
  seriesName: "はじめにシリーズ",
  courseName: "DX入門コース",
  lessonName: "L01",
  editLanguage: "ja" as const,
  onEditLanguageChange: () => {},
};

const series: Series[] = [
  {
    id: "srs-1",
    name: "はじめにシリーズ",
    courses: [],
  },
];

function noop() {}

function renderTree() {
  render(
    <SidebarProvider defaultOpen>
      <ContentTreePane
        workspaceName="DX Training Studio"
        series={series}
        editLanguage="ja"
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
}

afterEach(cleanup);

/** ラベル付き要素から実際のボタン要素を取る（中身が <a> のものも拾う） */
function actionEl(label: string): HTMLElement {
  return screen.getByLabelText(label);
}

/** テキストを持つボタン（曼陀羅・社内コンテキスト）はラベル span から親を辿る */
function actionElByText(text: string): HTMLElement {
  const el = screen.getByText(text).closest("button");
  if (!el) throw new Error(`button not found for: ${text}`);
  return el;
}

describe("GlobalHeader 右上4ボタンの色", () => {
  const cases = [
    () => actionElByText("DXトレーニング曼陀羅"),
    () => actionElByText("社内コンテキスト"),
    () => actionEl("GitHub リポジトリを開く"),
    () => actionEl("設定"),
  ];

  it("通常色はヘッダー操作色で、サブテキスト色ではない", () => {
    render(
      <GlobalHeader {...headerProps} githubUrl="https://github.com/acme/repo" />,
    );

    for (const get of cases) {
      const el = get();
      expect(el.className).toContain("text-header-action");
      expect(el.className).not.toContain("text-muted-foreground");
    }
  });

  it("ホバーで primary（青）にしない", () => {
    render(
      <GlobalHeader {...headerProps} githubUrl="https://github.com/acme/repo" />,
    );

    // ghost バリアント既定の hover:text-foreground に任せる。呼び出し側で
    // hover の色を指定していないこと（＝青への上書きが無いこと）を固定する
    for (const get of cases) {
      expect(get().className).not.toContain("hover:text-primary");
    }
  });
});

describe("押せる要素のカーソル", () => {
  it("共有 Button はポインタカーソルを持つ", () => {
    render(<Button>押す</Button>);
    expect(screen.getByRole("button").className).toContain("cursor-pointer");
  });

  it("ペイン1 ヘッダーのホームボタンもポインタカーソルを持つ", () => {
    renderTree();
    expect(actionEl("ホームを表示").className).toContain("cursor-pointer");
  });
});

describe("ペイン1 ヘッダーのホバー", () => {
  it("不透明度だけを下げ、色・背景は変えない", () => {
    renderTree();
    const el = actionEl("ホームを表示");

    expect(el.className).toContain("hover:opacity-75");
    expect(el.className).toContain("transition-opacity");
    expect(el.className).not.toContain("hover:text-");
    expect(el.className).not.toContain("hover:bg-");
  });
});
