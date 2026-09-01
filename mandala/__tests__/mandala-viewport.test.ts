import { describe, expect, it } from "vitest";
import {
  ANCHOR_TOP_MARGIN,
  anchoredViewport,
  GLOBAL_DEFAULT_ZOOM,
  resolveAnchor,
  type AnchorCandidate,
} from "../lib/mandala/viewport";

const CANVAS = { width: 600, height: 400 };

const node = (
  id: string,
  x: number,
  y: number,
  extra: Partial<AnchorCandidate> = {},
): AnchorCandidate => ({ id, x, y, width: 240, height: 72, ...extra });

describe("resolveAnchor", () => {
  it("現在地があれば現在地を基準にする", () => {
    const anchor = resolveAnchor([
      node("terminal:start:crs-1", 0, 0),
      node("crs-2", 0, 200, { here: true }),
    ]);
    expect(anchor?.kind).toBe("here");
    expect(anchor?.bounds.minY).toBe(200);
  });

  it("現在地が無ければ Start を基準にする", () => {
    const anchor = resolveAnchor([
      node("crs-1", 0, 200),
      node("terminal:start:crs-1", 40, 0),
    ]);
    expect(anchor?.kind).toBe("start");
    expect(anchor?.bounds.minX).toBe(40);
  });

  it("Start が複数あれば合成した外接箱を使う", () => {
    const anchor = resolveAnchor([
      node("terminal:start:crs-1", 0, 0),
      node("terminal:start:crs-2", 400, 0),
    ]);
    expect(anchor?.kind).toBe("start");
    expect(anchor?.bounds.minX).toBe(0);
    expect(anchor?.bounds.maxX).toBe(640);
  });

  it("どちらも無ければグラフ全体を使う", () => {
    const anchor = resolveAnchor([node("crs-1", 10, 20), node("crs-2", 10, 300)]);
    expect(anchor?.kind).toBe("graph");
    expect(anchor?.bounds.minY).toBe(20);
  });

  it("ノードが無ければ null", () => {
    expect(resolveAnchor([])).toBeNull();
  });
});

describe("anchoredViewport", () => {
  it("コンテンツ量によらず既定倍率で描く（収めるための縮小をしない）", () => {
    // キャンバス 400px に対し縦 2000px を超えるグラフでも倍率は既定のまま
    const tall = Array.from({ length: 30 }, (_, i) => node(`crs-${i}`, 0, i * 100));
    expect(anchoredViewport(tall, CANVAS)?.zoom).toBe(GLOBAL_DEFAULT_ZOOM);
  });

  it("既定倍率はズームイン 1 回（1.2 倍）で等倍へ戻る", () => {
    expect(GLOBAL_DEFAULT_ZOOM * 1.2).toBeCloseTo(1, 10);
  });

  it("現在地は縦横とも中央に置く", () => {
    const vp = anchoredViewport([node("crs-1", 100, 1000, { here: true })], CANVAS);
    // 中心 (220, 1036) が倍率を掛けたうえで (300, 200) に来る
    expect(vp).toEqual({
      x: 300 - GLOBAL_DEFAULT_ZOOM * 220,
      y: 200 - GLOBAL_DEFAULT_ZOOM * 1036,
      zoom: GLOBAL_DEFAULT_ZOOM,
    });
  });

  it("Start は横中央・上端そろえに置く", () => {
    const vp = anchoredViewport(
      [node("terminal:start:crs-1", 100, 500), node("crs-1", 100, 700)],
      CANVAS,
    );
    expect(vp).toEqual({
      x: 300 - GLOBAL_DEFAULT_ZOOM * 220,
      y: ANCHOR_TOP_MARGIN - GLOBAL_DEFAULT_ZOOM * 500,
      zoom: GLOBAL_DEFAULT_ZOOM,
    });
  });

  it("倍率を渡すと位置の式にその倍率が掛かる", () => {
    // 等倍を渡せば従来どおりの座標になる（式の回帰用の基準）
    const vp = anchoredViewport(
      [node("crs-1", 100, 1000, { here: true })],
      CANVAS,
      ANCHOR_TOP_MARGIN,
      1,
    );
    expect(vp).toEqual({ x: 300 - 220, y: 200 - 1036, zoom: 1 });
  });

  it("基準ノードが無ければ null", () => {
    expect(anchoredViewport([], CANVAS)).toBeNull();
  });
});
