import { describe, expect, it, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { WorkspaceMetaView } from "@/components/workspace/meta-views/WorkspaceMetaView";
import { SeriesMetaView } from "@/components/workspace/meta-views/SeriesMetaView";
import { CourseMetaView } from "@/components/workspace/meta-views/CourseMetaView";
import { META_HEADING_TEXT } from "@/components/workspace/metaDialogLayout";
import type { Course, Series } from "@/lib/schema";
import { NO_TRANSLATION_NOTICE } from "@/lib/translation/client";

// ミニ曼陀羅（React Flow）はこのテストの対象外。jsdom での描画副作用を避ける
vi.mock("@/components/workspace/MiniMandalaSection", () => ({
  MiniMandalaSection: () => <div data-testid="mini-mandala" />,
}));

function course(id: string, overrides: Partial<Course> = {}): Course {
  return {
    id,
    name: id,
    target: "",
    cross_series_prev: [],
    cross_series_next: [],
    lessons: [],
    ...overrides,
  };
}

const sampleSeries: Series[] = [
  {
    id: "srs-1",
    name: "はじめにシリーズ",
    slug: "start",
    catch: "ここから旅がはじまる",
    description: "最初のシリーズ",
    courses: [course("crs-1", { name: "DX入門コース", slug: "intro" })],
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const translationProps = {
  editLanguage: "ja" as const,
  translationNotice: NO_TRANSLATION_NOTICE,
};

describe("WorkspaceMetaView", () => {
  function stubFetch() {
    const fetchMock = vi.fn((...[input]: [RequestInfo | URL, RequestInit?]) => {
      const url = String(input);
      if (url.startsWith("/api/content/workspace-meta")) {
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
      if (url.startsWith("/api/images/list")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              files: [
                {
                  path: "images/hero-1.png",
                  name: "hero-1.png",
                  source: "uploaded",
                  uploadedAt: "",
                },
              ],
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

  it("全体メタを読み込んでフォームに表示し、保存で PUT する", async () => {
    const fetchMock = stubFetch();
    render(<WorkspaceMetaView workspaceName="DX Training Studio" {...translationProps} />);

    const nameInput = await screen.findByLabelText<HTMLInputElement>(
      "名前",
    );
    await waitFor(() => expect(nameInput.value).toBe("DX Training Mandala"));

    fireEvent.change(nameInput, { target: { value: "新しいサイト名" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as {
        name: string;
        hero?: string;
      };
      expect(body.name).toBe("新しいサイト名");
      // ⚠ hero はフォームが持たない。送らないことで PUT の「省略＝保全」規約に乗り、
      //    .meta.json の既存値が保たれる
      expect(body.hero).toBeUndefined();
    });
  });

  it("不正な GitHub URL では保存せずエラーを出す", async () => {
    const fetchMock = stubFetch();
    render(<WorkspaceMetaView workspaceName="DX Training Studio" {...translationProps} />);
    const urlInput = await screen.findByLabelText<HTMLInputElement>(
      "GitHub リンク",
    );
    await waitFor(() => expect(urlInput.value).toContain("github.com"));

    fireEvent.change(urlInput, { target: { value: "not-a-url" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("URL 形式で入力してください")).toBeDefined();
    expect(
      fetchMock.mock.calls.some(
        (c) => (c[1] as RequestInit | undefined)?.method === "PUT",
      ),
    ).toBe(false);
  });
});

describe("SeriesMetaView", () => {
  it("フォームは シリーズ名 → 説明 → キャッチ → スラッグ の順に並ぶ", () => {
    render(
      <SeriesMetaView
        {...translationProps}
        seriesItem={sampleSeries[0]}
        onRenameSeries={vi.fn()}
        onSaveMeta={vi.fn()}
      />,
    );

    const labels = screen
      .getAllByText(/^(シリーズ名|説明|キャッチ|スラッグ（公開 URL 用）)$/)
      .map((el) => el.textContent);

    expect(labels).toEqual([
      "シリーズ名",
      "説明",
      "キャッチ",
      "スラッグ（公開 URL 用）",
    ]);
  });

  it("見出しはレッスンメタ編集モーダルのタイトルと同じ体裁を使う", () => {
    // workspace-meta-views spec: メタ編集の入口がビューかモーダルかで
    // 見出しの大きさが変わってはいけない。体裁は META_HEADING_TEXT で共有する
    render(
      <SeriesMetaView
        {...translationProps}
        seriesItem={sampleSeries[0]}
        onRenameSeries={vi.fn()}
        onSaveMeta={vi.fn()}
      />,
    );

    const heading = screen.getByRole("heading", { name: "シリーズメタを編集" });
    for (const cls of META_HEADING_TEXT.split(" ")) {
      expect(heading.className).toContain(cls);
    }
  });

  it("ペイン2 ヘッダーのタイトルは見出しと同寸にしない", () => {
    // ヘッダー＝いまどこにいるか / 見出し＝何を編集しているか。
    // 大きさの差がその区別を示すので、揃えないことを固定する
    render(
      <SeriesMetaView
        {...translationProps}
        seriesItem={sampleSeries[0]}
        onRenameSeries={vi.fn()}
        onSaveMeta={vi.fn()}
      />,
    );

    const header = screen.getByRole("heading", { level: 2 });
    expect(header.className).toContain("text-sm");
    expect(header.className).not.toContain("text-base");
  });

  it("メタを保存し、名前が変わっていればリネームも呼ぶ", () => {
    const onRenameSeries = vi.fn();
    const onSaveMeta = vi.fn();
    render(
      <SeriesMetaView
        {...translationProps}
        seriesItem={sampleSeries[0]}
        onRenameSeries={onRenameSeries}
        onSaveMeta={onSaveMeta}
      />,
    );

    expect(
      screen.getByLabelText<HTMLInputElement>("スラッグ（公開 URL 用）").value,
    ).toBe("start");

    fireEvent.change(screen.getByLabelText("シリーズ名"), {
      target: { value: "新シリーズ名" },
    });
    fireEvent.change(screen.getByLabelText("キャッチ"), {
      target: { value: "新キャッチ" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSaveMeta).toHaveBeenCalledWith("srs-1", {
      slug: "start",
      catch: "新キャッチ",
      description: "最初のシリーズ",
    });
    expect(onRenameSeries).toHaveBeenCalledWith("srs-1", "新シリーズ名");
  });

  it("不正な slug は保存を拒否する", () => {
    const onSaveMeta = vi.fn();
    render(
      <SeriesMetaView
        {...translationProps}
        seriesItem={sampleSeries[0]}
        onRenameSeries={vi.fn()}
        onSaveMeta={onSaveMeta}
      />,
    );
    fireEvent.change(screen.getByLabelText("スラッグ（公開 URL 用）"), {
      target: { value: "Git基礎" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSaveMeta).not.toHaveBeenCalled();
    expect(
      screen.getByText("slug は小文字英数とハイフンのみで構成してください"),
    ).toBeDefined();
  });
});

describe("CourseMetaView", () => {
  it("フォームとミニ曼陀羅を表示し、保存で slug / catch / description を含む", () => {
    const onSave = vi.fn();
    render(
      <CourseMetaView
        {...translationProps}
        seriesName={sampleSeries[0].name}
        series={sampleSeries}
        course={sampleSeries[0].courses[0]}
        onSave={onSave}
        onSelectCourse={vi.fn()}
        mandalaModalOpen={false}
        onMandalaModalOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("mini-mandala")).toBeDefined();
    expect(
      screen.getByLabelText<HTMLInputElement>("スラッグ（公開 URL 用）").value,
    ).toBe("intro");

    fireEvent.change(screen.getByLabelText("キャッチ"), {
      target: { value: "地図を手に入れる" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSave).toHaveBeenCalledWith(
      "crs-1",
      expect.objectContaining({
        name: "DX入門コース",
        slug: "intro",
        catch: "地図を手に入れる",
      }),
    );
  });

  it("フォームは コース名 → 説明 → 左列4項目 → コースフロー の順に並ぶ", () => {
    render(
      <CourseMetaView
        {...translationProps}
        seriesName={sampleSeries[0].name}
        series={sampleSeries}
        course={sampleSeries[0].courses[0]}
        onSave={vi.fn()}
        onSelectCourse={vi.fn()}
        mandalaModalOpen={false}
        onMandalaModalOpenChange={vi.fn()}
      />,
    );

    const labels = screen
      .getAllByText(
        /^(コース名|スラッグ（公開 URL 用）|キャッチ|受講対象者|受講形態|説明|ミニ曼陀羅|前のコース（同シリーズ）)$/,
      )
      .map((el) => el.textContent);

    expect(labels).toEqual([
      "コース名",
      "説明",
      "キャッチ",
      "スラッグ（公開 URL 用）",
      "受講対象者",
      "受講形態",
      "ミニ曼陀羅",
      "前のコース（同シリーズ）",
    ]);
  });

  it("説明はコース名と同じ全幅で表示する", () => {
    render(
      <CourseMetaView
        {...translationProps}
        seriesName={sampleSeries[0].name}
        series={sampleSeries}
        course={sampleSeries[0].courses[0]}
        onSave={vi.fn()}
        onSelectCourse={vi.fn()}
        mandalaModalOpen={false}
        onMandalaModalOpenChange={vi.fn()}
      />,
    );

    const field = document
      .querySelector("#course-meta-description")!
      .closest("div[class]")!;
    expect(field.className).toContain("col-span-2");
  });

  it("ミニ曼陀羅は右列に配置され、外側に追加の枠を持たない", () => {
    render(
      <CourseMetaView
        {...translationProps}
        seriesName={sampleSeries[0].name}
        series={sampleSeries}
        course={sampleSeries[0].courses[0]}
        onSave={vi.fn()}
        onSelectCourse={vi.fn()}
        mandalaModalOpen={false}
        onMandalaModalOpenChange={vi.fn()}
      />,
    );

    const field = screen
      .getByTestId("mini-mandala")
      .closest('[class*="row-span-4"]')!;
    expect(field.className).toContain("col-start-2");
    // 説明が2行目を全幅で占めるので、曼陀羅は3行目から4行分
    expect(field.className).toContain("row-start-3");
    // 枠はサムネイル側が持つ。フィールドで囲わない
    expect(field.className).not.toContain("border");
    // 中身は absolute で行の高さ計算から外す（左列の行間を引き伸ばさない）
    const inner = screen.getByTestId("mini-mandala").closest(".absolute");
    expect(inner).not.toBeNull();
  });
});
