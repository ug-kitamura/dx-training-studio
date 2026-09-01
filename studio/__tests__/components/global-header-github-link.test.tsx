import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GlobalHeader } from "@/components/workspace/GlobalHeader";

// 曼陀羅モーダルは開かないので React Flow の描画経路には入らないが、
// import 時点の副作用を避けるためスタブしておく
vi.mock("@/components/workspace/mandala/LazyMandala", () => ({
  LazyMandala: () => null,
}));

const baseProps = {
  seriesName: "はじめにシリーズ",
  courseName: "DX入門コース",
  lessonName: "L01",
  editLanguage: "ja" as const,
  onEditLanguageChange: () => {},
};

afterEach(cleanup);

describe("GlobalHeader の GitHub リンク", () => {
  it("github_url があると設定アイコンの左にリンクが出る", () => {
    render(
      <GlobalHeader {...baseProps} githubUrl="https://github.com/acme/repo" />,
    );

    const link = screen.getByLabelText("GitHub リポジトリを開く");
    expect(link).toHaveAttribute("href", "https://github.com/acme/repo");
    expect(link).toHaveAttribute("target", "_blank");

    // DOM 順が「社内コンテキスト → GitHub → 設定」であること
    const settings = screen.getByLabelText("設定");
    const context = screen.getByText("社内コンテキスト");
    expect(
      context.compareDocumentPosition(link) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      link.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("github_url が無いとリンクを描かない", () => {
    render(<GlobalHeader {...baseProps} />);

    expect(screen.queryByLabelText("GitHub リポジトリを開く")).toBeNull();
    expect(screen.getByLabelText("設定")).toBeTruthy();
  });
});
