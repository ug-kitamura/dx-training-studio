import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AiImagesTab } from "@/components/workspace/image-manager/AiImagesTab";
import { WebImagesTab } from "@/components/workspace/image-manager/WebImagesTab";

/**
 * staging はレッスンに紐づかないので、メタ編集画面（レッスン未選択）へ移っても
 * プロンプト欄とグリッドは消えない。自動入力だけはカーソル周辺の本文を読むため無効。
 */

afterEach(cleanup);

const common = {
  editorCommentPrompt: null,
  editorCursorOffset: null,
  showNotice: () => {},
  clearNotice: () => {},
  onHighlightPaths: () => {},
  gridItems: [],
  canInsert: false,
  onResolveAltReady: () => {},
  onPreview: () => {},
  onInsert: () => {},
  onDelete: () => {},
};

describe("AI タブ（レッスン未選択）", () => {
  it("プロンプト欄とグリッドが表示され、自動入力だけ無効になる", () => {
    render(
      <AiImagesTab
        lesson={undefined}
        language="ja"
        refreshScope={async () => {}}
        {...common}
      />,
    );

    expect(screen.queryByText("レッスンを選択してください")).toBeNull();
    expect(
      screen.getByPlaceholderText("画像生成プロンプトを入力してください"),
    ).toBeTruthy();
    expect(screen.getByText("AI staging に画像がありません")).toBeTruthy();

    const autoFill = screen.getByText("自動入力").closest("button");
    expect((autoFill as HTMLButtonElement).disabled).toBe(true);
    const reset = screen.getByText("リセット").closest("button");
    expect((reset as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("Web タブ（レッスン未選択）", () => {
  it("プロンプト欄とグリッドが表示され、自動入力だけ無効になる", () => {
    render(
      <WebImagesTab
        lesson={undefined}
        refreshScope={async () => {}}
        {...common}
      />,
    );

    expect(screen.queryByText("レッスンを選択してください")).toBeNull();
    expect(
      screen.getByPlaceholderText("画像検索条件を入力してください"),
    ).toBeTruthy();
    expect(screen.getByText("Web staging に画像がありません")).toBeTruthy();

    const autoFill = screen.getByText("自動入力").closest("button");
    expect((autoFill as HTMLButtonElement).disabled).toBe(true);
  });
});
