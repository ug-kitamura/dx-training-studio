import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { GlobalHeader } from "@/components/workspace/GlobalHeader";
import { BreadcrumbLink } from "@/components/ui/breadcrumb";

// 曼陀羅モーダルは開かないが、import 時点の副作用を避けるためスタブしておく
vi.mock("@/components/workspace/mandala/LazyMandala", () => ({
  LazyMandala: () => null,
}));

const names = {
  seriesName: "はじめにシリーズ",
  courseName: "DX入門コース",
  lessonName: "トレーニングの進め方",
};

const ids = {
  selectedSeriesId: "srs-1",
  selectedCourseId: "crs-1",
  editLanguage: "ja" as const,
  onEditLanguageChange: () => {},
};

function crumbNav(): HTMLElement | null {
  return screen.queryByLabelText("パンくず");
}

/** パンくずの段（リンク段＋現在地）をラベルの配列で返す */
function crumbLabels(): string[] {
  const nav = crumbNav();
  if (!nav) return [];
  return [
    ...nav.querySelectorAll(
      '[data-slot="breadcrumb-link"], [data-slot="breadcrumb-page"]',
    ),
  ].map((el) => (el.textContent ?? "").trim());
}

afterEach(cleanup);

describe("GlobalHeader のパンくず: 出す階層", () => {
  it("ホーム選択（すべて空）では描かない", () => {
    render(
      <GlobalHeader seriesName="" courseName="" lessonName="" {...ids} />,
    );

    expect(crumbNav()).toBeNull();
  });

  it("シリーズ選択（1段だけ）では描かない", () => {
    render(
      <GlobalHeader
        seriesName={names.seriesName}
        courseName=""
        lessonName=""
        {...ids}
      />,
    );

    expect(crumbNav()).toBeNull();
  });

  it("コース選択では2段", () => {
    render(
      <GlobalHeader
        seriesName={names.seriesName}
        courseName={names.courseName}
        lessonName=""
        {...ids}
      />,
    );

    expect(crumbLabels()).toEqual([names.seriesName, names.courseName]);
  });

  it("レッスン選択では3段", () => {
    render(<GlobalHeader {...names} {...ids} />);

    expect(crumbLabels()).toEqual([
      names.seriesName,
      names.courseName,
      names.lessonName,
    ]);
  });
});

describe("GlobalHeader のパンくず: 区切りと太字", () => {
  it("区切りは段と段の間だけで、末尾に残らない", () => {
    render(
      <GlobalHeader
        seriesName={names.seriesName}
        courseName={names.courseName}
        lessonName=""
        {...ids}
      />,
    );

    const nav = crumbNav()!;
    const separators = nav.querySelectorAll(
      '[data-slot="breadcrumb-separator"]',
    );
    // 2段なら区切りは1つ（末尾には出ない）
    expect(separators).toHaveLength(1);

    // 最後の子要素は区切りではなく段であること
    const list = nav.querySelector('[data-slot="breadcrumb-list"]')!;
    expect(list.lastElementChild?.getAttribute("data-slot")).toBe(
      "breadcrumb-item",
    );
  });

  it("3段でも区切りは2つ", () => {
    render(<GlobalHeader {...names} {...ids} />);

    expect(
      crumbNav()!.querySelectorAll('[data-slot="breadcrumb-separator"]'),
    ).toHaveLength(2);
  });

  it("コース選択ではコース名だけが太字", () => {
    render(
      <GlobalHeader
        seriesName={names.seriesName}
        courseName={names.courseName}
        lessonName=""
        {...ids}
      />,
    );

    const page = crumbNav()!.querySelector('[data-slot="breadcrumb-page"]')!;
    expect(page.textContent).toBe(names.courseName);
    expect(page.className).toContain("font-bold");

    // シリーズ名はリンク段（太字にしない）
    const link = crumbNav()!.querySelector('[data-slot="breadcrumb-link"]')!;
    expect(link.textContent).toBe(names.seriesName);
    expect(link.className).not.toContain("font-bold");
  });

  it("レッスン選択ではレッスン名だけが太字", () => {
    render(<GlobalHeader {...names} {...ids} />);

    const pages = crumbNav()!.querySelectorAll('[data-slot="breadcrumb-page"]');
    expect(pages).toHaveLength(1);
    expect(pages[0].textContent).toBe(names.lessonName);
    expect(pages[0].className).toContain("font-bold");
  });
});

describe("GlobalHeader のパンくず: 上位段のリンク", () => {
  it("シリーズ名クリックでシリーズを選択する", () => {
    const onSelectSeries = vi.fn();
    render(
      <GlobalHeader {...names} {...ids} onSelectSeries={onSelectSeries} />,
    );

    fireEvent.click(screen.getByText(names.seriesName));
    expect(onSelectSeries).toHaveBeenCalledWith("srs-1");
  });

  it("コース名クリックでコースを選択する", () => {
    const onSelectCourse = vi.fn();
    render(
      <GlobalHeader {...names} {...ids} onSelectCourse={onSelectCourse} />,
    );

    fireEvent.click(screen.getByText(names.courseName));
    expect(onSelectCourse).toHaveBeenCalledWith("crs-1");
  });

  it("現在地（最後の段）はボタンではない", () => {
    const onSelectCourse = vi.fn();
    render(
      <GlobalHeader
        seriesName={names.seriesName}
        courseName={names.courseName}
        lessonName=""
        {...ids}
        onSelectCourse={onSelectCourse}
      />,
    );

    fireEvent.click(screen.getByText(names.courseName));
    expect(onSelectCourse).not.toHaveBeenCalled();
  });

  it("上位段は <button> として描かれる", () => {
    render(<GlobalHeader {...names} {...ids} />);

    for (const label of [names.seriesName, names.courseName]) {
      expect(screen.getByText(label).tagName).toBe("BUTTON");
    }
  });
});

describe("BreadcrumbLink の quiet variant", () => {
  it("quiet はカーソルだけ変え、ホバーで色を変えない", () => {
    render(<BreadcrumbLink variant="quiet">戻る</BreadcrumbLink>);

    const el = screen.getByText("戻る");
    expect(el.className).toContain("cursor-pointer");
    expect(el.className).not.toContain("hover:text-foreground");
  });

  it("既定 variant は従来どおりホバーで前景色になる", () => {
    render(<BreadcrumbLink>戻る</BreadcrumbLink>);

    expect(screen.getByText("戻る").className).toContain(
      "hover:text-foreground",
    );
  });
});
