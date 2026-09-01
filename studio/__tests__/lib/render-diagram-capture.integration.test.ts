import { describe, expect, it } from "vitest";
import {
  isPlaywrightChromiumAvailable,
  readPngDimensions,
  renderDiagramToPng,
} from "../../lib/render-diagram-capture.mjs";

const fragments = {
  wide:
    '<div class="w-[900px] h-32 bg-blue-500 flex items-center justify-end pr-2 text-white font-bold">RIGHT EDGE</div>',
  wideFlexRow: `<div class="flex gap-4">
    <div class="w-64 h-24 bg-red-400 shrink-0">A</div>
    <div class="w-64 h-24 bg-red-400 shrink-0">B</div>
    <div class="w-64 h-24 bg-red-400 shrink-0">C</div>
    <div class="w-64 h-24 bg-red-400 shrink-0">D</div>
    <div class="w-64 h-24 bg-red-400 shrink-0 text-right pr-1">E RIGHT</div>
  </div>`,
  tall: '<div class="w-full h-[1200px] bg-green-500 flex items-end justify-center pb-4 text-white font-bold">BOTTOM</div>',
  largeForNormalize:
    '<div class="w-[1400px] h-[900px] bg-purple-500 flex items-center justify-center text-white font-bold">LARGE</div>',
};

/**
 * ⚠ 可用性は**トップレベル await**で確定させること。理由は2つあり、
 * どちらか一方だけ直しても「常時スキップ」のままになる。
 *
 *  ① `skipIf` は引数を**真偽値**として扱う。関数を渡すと関数オブジェクトが
 *     常に truthy と評価され、無条件にスキップされる。
 *  ② `describe.skipIf` は**収集時**に評価される。`beforeAll` で代入した値は
 *     間に合わず、条件は初期値のまま読まれる。
 *
 * 実際、以前は `beforeAll` + `skipIf(() => !chromiumAvailable)` だったため、
 * Chromium が導入済みの環境でも4件が一度も走っていなかった。
 */
const chromiumAvailable = await isPlaywrightChromiumAvailable();

describe.skipIf(!chromiumAvailable)("renderDiagramToPng integration", () => {
  it("captures 900px wide content without clipping", async () => {
    const { png, cssWidth } = await renderDiagramToPng(fragments.wide);
    const { width } = readPngDimensions(png);
    expect(cssWidth).toBeGreaterThanOrEqual(900);
    expect(width).toBeGreaterThanOrEqual(900 * (width / cssWidth) - 2);
  }, 60_000);

  it("captures flex row overflow without clipping right edge", async () => {
    const { png, cssWidth } = await renderDiagramToPng(fragments.wideFlexRow);
    expect(cssWidth).toBeGreaterThan(768);
    const { width } = readPngDimensions(png);
    expect(width / cssWidth).toBeGreaterThanOrEqual(1);
    // w-64 x5 + gap-4 x4 = 1344px。Math.ceil で 1 CSS px 未満の丸めを許す——
    // 要素スクリーンショットは整数デバイスピクセルへ切り捨てられるため、
    // cssWidth（= 物理幅 / dsf の逆算値）は最大 1/dsf CSS px だけ小さく出る。
    // 実測: viewport 1376（内容 1344 + body padding 32）→ dsf = 2048/1376 = 1.48837、
    // 必要な物理幅 2000.37 → 2000 に切り捨て → cssWidth 1343.75。
    // 本物のクリッピング（初期 viewport 768 に留まる等）はこの許容では通らない。
    expect(Math.ceil(cssWidth)).toBeGreaterThanOrEqual(1344);
  }, 60_000);

  it("captures 1200px tall content without clipping bottom", async () => {
    const { png, cssHeight } = await renderDiagramToPng(fragments.tall);
    expect(cssHeight).toBeGreaterThanOrEqual(1200);
    const { height } = readPngDimensions(png);
    expect(height / cssHeight).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it("normalizes physical long edge to 2048px or below", async () => {
    const { png } = await renderDiagramToPng(fragments.largeForNormalize);
    const { width, height } = readPngDimensions(png);
    expect(Math.max(width, height)).toBeLessThanOrEqual(2048);
  }, 60_000);
});

describe("Playwright chromium availability", () => {
  it("reports availability for test harness", () => {
    expect(typeof chromiumAvailable).toBe("boolean");
  });
});
