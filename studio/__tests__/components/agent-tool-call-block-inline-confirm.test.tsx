import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentToolCallBlock } from "@/components/workspace/AgentToolCallBlock";
import type { ToolConfirmRequiredEvent } from "@/lib/agent/stream-client";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AgentToolCallBlock pendingConfirm (inline confirmation card)", () => {
  it("renders an overwrite confirm inline with approve/reject, without a modal", () => {
    const request: ToolConfirmRequiredEvent = {
      toolUseId: "t1",
      kind: "overwrite",
      path: "workspace/demo/_work/agenda_details_all.html",
      isNew: false,
    };
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <AgentToolCallBlock
        events={[]}
        pendingConfirm={request}
        onConfirmApprove={onApprove}
        onConfirmReject={onReject}
      />,
    );

    expect(
      screen.getByText("既存ファイルを上書きしますか？"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/workspace\/demo\/_work\/agenda_details_all.html/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("上書きする"));
    expect(onApprove).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("拒否する"));
    expect(onReject).toHaveBeenCalledTimes(1);

    // モーダル用の role="alertdialog" は使わない（Radix Portal を経由しない）
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("renders each new folder level with its label so typos are readable", () => {
    const request: ToolConfirmRequiredEvent = {
      toolUseId: "t-folder",
      kind: "create-content-folder",
      path: "contents/Git完全マスタシリーズ/新コース/新レッスン/contents.md",
      isNew: true,
      createFolder: {
        folders: [
          { level: "series", name: "Git完全マスタシリーズ" },
          { level: "course", name: "新コース" },
          { level: "lesson", name: "新レッスン" },
        ],
      },
    };
    const onApprove = vi.fn();

    render(
      <AgentToolCallBlock
        events={[]}
        pendingConfirm={request}
        onConfirmApprove={onApprove}
        onConfirmReject={vi.fn()}
      />,
    );

    expect(
      screen.getByText("新しいフォルダを作成しますか？"),
    ).toBeInTheDocument();
    // 打ち間違いを読んで判別できるよう、種別と名前が並ぶ
    expect(
      screen.getByText(/シリーズ「Git完全マスタシリーズ」/),
    ).toBeInTheDocument();
    expect(screen.getByText(/コース「新コース」/)).toBeInTheDocument();
    expect(screen.getByText(/レッスン「新レッスン」/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("作成する"));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("stays visible even when there are no paired tool events yet", () => {
    const request: ToolConfirmRequiredEvent = {
      toolUseId: "t2",
      kind: "web-search",
      path: "query text",
      isNew: false,
      search: { query: "query text", purpose: "調べもの" },
    };

    render(
      <AgentToolCallBlock
        events={[]}
        pendingConfirm={request}
        onConfirmApprove={vi.fn()}
        onConfirmReject={vi.fn()}
      />,
    );

    expect(screen.getByText("web 検索を実行しますか？")).toBeInTheDocument();
  });

  it("renders the manual search form inline for web-search-manual", () => {
    const request: ToolConfirmRequiredEvent = {
      toolUseId: "t3",
      kind: "web-search-manual",
      path: "query text",
      isNew: false,
      search: { query: "query text", purpose: "" },
    };
    const onManualSubmit = vi.fn();

    render(
      <AgentToolCallBlock
        events={[]}
        pendingConfirm={request}
        onConfirmApprove={vi.fn()}
        onConfirmReject={vi.fn()}
        onConfirmManualSubmit={onManualSubmit}
      />,
    );

    expect(
      screen.getByText("web 検索は自分で行ってください"),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("検索結果の要点を貼り付けてください"),
      {
        target: { value: "結果テキスト" },
      },
    );
    fireEvent.click(screen.getByText("貼り付けて続行"));
    expect(onManualSubmit).toHaveBeenCalledWith("結果テキスト");
  });

  it("renders the isolated-task confirm inline (subagent fallback substitute)", () => {
    const request: ToolConfirmRequiredEvent = {
      toolUseId: "t4",
      kind: "isolated-task",
      path: "(独立実行タスク)",
      isNew: false,
      generate: {
        purpose: "議事録を評価",
        instruction: "生成済みHTMLを評価して",
        sections: [],
        contextPaths: ["output/minutes.html"],
      },
    };

    render(
      <AgentToolCallBlock
        events={[]}
        pendingConfirm={request}
        onConfirmApprove={vi.fn()}
        onConfirmReject={vi.fn()}
      />,
    );

    expect(
      screen.getByText("独立した文脈でタスクを実行しますか？"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/親の会話履歴は引き継ぎません/),
    ).toBeInTheDocument();
  });

  it("renders nothing when there is no pendingConfirm and no tool events", () => {
    const { container } = render(<AgentToolCallBlock events={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
