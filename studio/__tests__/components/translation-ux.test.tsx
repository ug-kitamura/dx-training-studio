import { describe, expect, it, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { SaveButton } from "@/components/workspace/SaveButton";
import { SeriesMetaView } from "@/components/workspace/meta-views/SeriesMetaView";
import { TranslationNotice } from "@/components/workspace/translation/TranslationNotice";
import {
  STALE_NOTICE_TEXT,
  UNTRANSLATED_NOTICE_TEXT,
} from "@/components/workspace/translation/translationLabels";
import {
  NO_TRANSLATION_NOTICE,
  type TranslationNoticeState,
} from "@/lib/translation/client";
import type { Series } from "@/lib/schema";

const seriesItem: Series = {
  id: "srs-1",
  name: "はじめにシリーズ",
  slug: "start",
  catch: "ここから旅がはじまる",
  description: "最初のシリーズ",
  courses: [],
};

function stubMetaEnFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/content/meta-en")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ja: { name: "はじめにシリーズ", catch: "旅の始まり", description: "説明" },
            en: { name_en: "Getting Started", catch_en: "", description_en: "" },
            en_source_hash: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  vi.stubGlobal("fetch", fetchMock);
}

function renderSeries(
  language: "ja" | "en",
  notice: TranslationNoticeState = NO_TRANSLATION_NOTICE,
) {
  return render(
    <SeriesMetaView
      seriesItem={seriesItem}
      onRenameSeries={() => {}}
      onSaveMeta={() => {}}
      editLanguage={language}
      translationNotice={notice}
    />,
  );
}

const STALE_ONLY: TranslationNoticeState = { untranslated: false, stale: true };
const UNTRANSLATED_ONLY: TranslationNoticeState = {
  untranslated: true,
  stale: false,
};
const BOTH: TranslationNoticeState = { untranslated: true, stale: true };

describe("SaveButton", () => {
  afterEach(cleanup);

  it("保存が成功したらチェックマークで知らせる", async () => {
    render(<SaveButton onSave={() => Promise.resolve()} />);
    expect(screen.queryByText("保存しました")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() => expect(screen.getByText("保存しました")).toBeTruthy());
  });

  it("保存が失敗したらチェックマークを出さない", async () => {
    render(<SaveButton onSave={() => Promise.reject(new Error("boom"))} />);
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /保存/ }).hasAttribute("disabled")).toBe(
        false,
      ),
    );
    expect(screen.queryByText("保存しました")).toBeNull();
  });
});

describe("TranslationNotice", () => {
  afterEach(cleanup);

  it("空欄があれば未翻訳の1行を描く", () => {
    render(<TranslationNotice state={UNTRANSLATED_ONLY} />);
    expect(screen.getByText(UNTRANSLATED_NOTICE_TEXT)).toBeTruthy();
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();
  });

  it("空欄が無く stale なら古い翻訳の1行を描く", () => {
    render(<TranslationNotice state={STALE_ONLY} />);
    expect(screen.getByText(STALE_NOTICE_TEXT)).toBeTruthy();
    expect(screen.queryByText(UNTRANSLATED_NOTICE_TEXT)).toBeNull();
  });

  it("両方成立しても未翻訳を優先して1行だけ描く", () => {
    // ⚠ 訳が入っていないブロックがあるうちは鮮度より先に埋めるべき
    render(<TranslationNotice state={BOTH} />);
    expect(screen.getByText(UNTRANSLATED_NOTICE_TEXT)).toBeTruthy();
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();
  });

  it("どちらでもなければ何も描かない", () => {
    const { container } = render(
      <TranslationNotice state={NO_TRANSLATION_NOTICE} />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("メタビューの配置と鮮度の見せ方", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("日本語ビューでは stale でも赤字を出さない", () => {
    renderSeries("ja", STALE_ONLY);
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();
  });

  it("日本語ビューでは空欄があっても赤字を出さない", () => {
    renderSeries("ja", UNTRANSLATED_ONLY);
    expect(screen.queryByText(UNTRANSLATED_NOTICE_TEXT)).toBeNull();
  });

  it("英語ビューで stale なら赤字を出す", async () => {
    stubMetaEnFetch();
    renderSeries("en", STALE_ONLY);
    await waitFor(() =>
      expect(screen.getByText(STALE_NOTICE_TEXT)).toBeTruthy(),
    );
  });

  it("英語ビューで空欄があれば未翻訳の赤字を出す", async () => {
    stubMetaEnFetch();
    renderSeries("en", UNTRANSLATED_ONLY);
    await waitFor(() =>
      expect(screen.getByText(UNTRANSLATED_NOTICE_TEXT)).toBeTruthy(),
    );
  });

  it("鮮度チップを表示しない", () => {
    renderSeries("ja", STALE_ONLY);
    expect(screen.queryByText("未翻訳")).toBeNull();
    expect(screen.queryByText("英語版が古い")).toBeNull();
    expect(screen.queryByText("最新として扱う")).toBeNull();
  });

  it("ヘッダーには保存ボタンを置かない（本文側にだけある）", () => {
    const { container } = renderSeries("ja");
    const header = container.querySelector(".h-12");
    expect(header).toBeTruthy();
    expect(header!.textContent).not.toContain("保存");
    expect(screen.getByRole("button", { name: /保存/ })).toBeTruthy();
  });

  it("英語ビューの項目順は 名前 → 説明 → キャッチ", async () => {
    stubMetaEnFetch();
    renderSeries("en");
    await waitFor(() => expect(screen.getByLabelText("Series name")).toBeTruthy());
    const labels = screen
      .getAllByText(/^(Series name|Description|Catch)$/)
      .map((el) => el.textContent);
    expect(labels).toEqual(["Series name", "Description", "Catch"]);
  });
});
