import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImageGrid } from "@/components/workspace/ImageGrid";
import { ImageManagerPane } from "@/components/workspace/image-manager/ImageManagerPane";
import type { Pane3Mode } from "@/components/workspace/Workspace";
import type { Lesson } from "@/lib/schema";

/**
 * 挿入操作の可否は「レッスン選択中 かつ 編集モード」でのみ有効。
 * 満たさないときはボタンを消さず disabled で残す（押せないので通知も出さない）。
 */

const originalFetch = global.fetch;

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

const gridItem = {
  path: "images/uploaded/a.png",
  name: "a.png",
  showInsert: true,
  showDelete: true,
};

describe("ImageGrid の挿入ボタン", () => {
  it("canInsert が true なら押せて onInsert が呼ばれる", () => {
    const onInsert = vi.fn();
    render(
      <ImageGrid
        items={[gridItem]}
        emptyMessage="なし"
        canInsert
        onPreview={() => {}}
        onInsert={onInsert}
      />,
    );

    const button = screen.getByLabelText("エディタに挿入") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onInsert).toHaveBeenCalledTimes(1);
  });

  it("canInsert が false ならボタンは残るが disabled でクリックが通らない", () => {
    const onInsert = vi.fn();
    render(
      <ImageGrid
        items={[gridItem]}
        emptyMessage="なし"
        canInsert={false}
        onPreview={() => {}}
        onInsert={onInsert}
      />,
    );

    const button = screen.getByLabelText("エディタに挿入") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("showInsert が false の行は canInsert に関係なくボタン自体を持たない", () => {
    render(
      <ImageGrid
        items={[
          {
            path: "images/gone.png",
            name: "gone.png",
            missing: true,
            statusLabel: "画像が存在しません",
            showInsert: false,
            showDelete: false,
          },
        ]}
        emptyMessage="なし"
        canInsert
        onPreview={() => {}}
        onInsert={() => {}}
      />,
    );

    expect(screen.queryByLabelText("エディタに挿入")).toBeNull();
  });
});

function mockStagingList() {
  global.fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ files: [{ path: "images/uploaded/a.png", name: "a.png" }] }),
        { status: 200 },
      ),
  ) as never;
}

function lessonFixture(): Lesson {
  return {
    id: "lsn-1",
    series: "s",
    course: "c",
    lesson: "l",
    status: "open",
    description: "",
    tags: [],
    estimated_minutes: 10,
    author: "",
    content: "",
  } as Lesson;
}

async function renderPane(lesson: Lesson | undefined, pane3Mode: Pane3Mode) {
  mockStagingList();
  render(
    <ImageManagerPane
      series={[]}
      lesson={lesson}
      pane3Mode={pane3Mode}
      activeTab="upload"
      onActiveTabChange={() => {}}
      onInsertImage={() => true}
      editorCommentPrompt={null}
      editorCursorOffset={null}
      editLanguage="ja"
      contextLesson={lesson}
      pane4Open
    />,
  );
  await waitFor(() => expect(screen.getByLabelText("エディタに挿入")).toBeTruthy());
  return screen.getByLabelText("エディタに挿入") as HTMLButtonElement;
}

describe("ImageManagerPane の挿入可否の導出", () => {
  it("レッスン選択中かつ編集モードでのみ有効になる", async () => {
    const button = await renderPane(lessonFixture(), "raw");
    expect(button.disabled).toBe(false);
  });

  it("レッスン選択中でもプレビューモードなら無効", async () => {
    const button = await renderPane(lessonFixture(), "inline");
    expect(button.disabled).toBe(true);
  });

  it("編集モードでもレッスン未選択なら無効", async () => {
    const button = await renderPane(undefined, "raw");
    expect(button.disabled).toBe(true);
  });

  it("レッスン未選択かつプレビューモードでも無効", async () => {
    const button = await renderPane(undefined, "inline");
    expect(button.disabled).toBe(true);
  });

  it("挿入不可を告げる常設バーを表示しない", async () => {
    await renderPane(undefined, "inline");
    expect(screen.queryByText("画像の挿入は編集モードでのみ利用できます")).toBeNull();
    expect(
      screen.queryByText("編集モードに切り替えてから挿入してください"),
    ).toBeNull();
  });
});
