import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LessonPreviewImage } from "@/components/workspace/LessonPreviewImage";
import { ImageGrid } from "@/components/workspace/ImageGrid";
import { resetImageErrorProbe } from "@/lib/image-error";

afterEach(cleanup);

const originalFetch = global.fetch;

function mockProbe(kind: string, status = 503) {
  global.fetch = vi.fn(
    async () => new Response(JSON.stringify({ kind }), { status }),
  ) as never;
}

describe("LessonPreviewImage のエラー表示", () => {
  beforeEach(() => resetImageErrorProbe());
  afterEach(() => {
    global.fetch = originalFetch;
    resetImageErrorProbe();
  });

  it("一覧に無い＝実体なしは「画像が存在しません」", () => {
    render(
      <LessonPreviewImage
        src="images/gone.png"
        alt="図"
        availableImagePaths={new Set(["images/other.png"])}
      />,
    );
    expect(screen.getByText("画像が存在しません")).toBeTruthy();
  });

  it("実在するがストレージがブロック中なら別文言になる", async () => {
    mockProbe("blocked");
    render(
      <LessonPreviewImage
        src="images/a.png"
        alt="図"
        availableImagePaths={new Set(["images/a.png"])}
      />,
    );

    fireEvent.error(screen.getByAltText("図"));

    await waitFor(() => {
      expect(
        screen.getByText("ストレージが利用上限でブロックされています"),
      ).toBeTruthy();
    });
    expect(screen.queryByText("画像が存在しません")).toBeNull();
  });

  it("読み出し失敗も「存在しません」とは言わない", async () => {
    mockProbe("read-failed", 502);
    render(
      <LessonPreviewImage
        src="images/a.png"
        alt="図"
        availableImagePaths={new Set(["images/a.png"])}
      />,
    );

    fireEvent.error(screen.getByAltText("図"));

    await waitFor(() => {
      expect(screen.getByText("ストレージから読み込めません")).toBeTruthy();
    });
  });
});

describe("ImageGrid のエラー表示", () => {
  const noop = () => {};

  beforeEach(() => resetImageErrorProbe());
  afterEach(() => {
    global.fetch = originalFetch;
    resetImageErrorProbe();
  });

  it("missing 行は「画像が存在しません」", () => {
    render(
      <ImageGrid
        items={[{ path: "images/gone.png", name: "gone.png", missing: true }]}
        emptyMessage="なし"
        onPreview={noop}
      />,
    );
    expect(screen.getByText("画像が存在しません")).toBeTruthy();
  });

  it("サムネイルの取得失敗はストレージ側の文言になる", async () => {
    mockProbe("blocked");
    render(
      <ImageGrid
        items={[{ path: "images/a.png", name: "a.png" }]}
        emptyMessage="なし"
        onPreview={noop}
      />,
    );

    fireEvent.error(screen.getByAltText("a.png"));

    await waitFor(() => {
      expect(
        screen.getByText("ストレージが利用上限でブロックされています"),
      ).toBeTruthy();
    });
    expect(screen.queryByText("画像が存在しません")).toBeNull();
  });
});
