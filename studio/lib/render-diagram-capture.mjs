/**
 * Playwright HTML fragment → PNG capture for AI diagram generation.
 */
import { chromium } from "playwright";

export const DEVICE_SCALE_FACTOR_PREFERRED = 2;
export const INITIAL_VIEWPORT = { width: 768, height: 600 };
export const MAX_PHYSICAL_LONG_EDGE = 2048;
export const MIN_CSS_WIDTH_WARNING = 480;
export const MAX_VIEWPORT_CSS = 4096;

export function wrapFragment(fragment) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            custom: {
              bg: '#FFFFFF',
              surface: '#F8FAFC',
              hover: '#F1F5F9',
              border: '#E2E8F0',
              accent: '#3B82F6',
              'accent-light': '#2563EB',
              text: '#1E293B',
              muted: '#64748B',
              dim: '#94A3B8',
              positive: '#10B981',
              negative: '#EF4444',
              warning: '#F59E0B',
            }
          },
          fontFamily: {
            sans: ['"Noto Sans JP"', '"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic UI"', '"Meiryo"', 'sans-serif'],
          }
        }
      }
    };
  </script>
</head>
<body class="bg-custom-bg text-slate-600 antialiased m-0 p-4 font-sans">
  <div id="capture-root">${fragment}</div>
  <script src="https://unpkg.com/lucide@latest"></script>
  <script>if (window.lucide) lucide.createIcons();</script>
</body>
</html>`;
}

/** @param {import('playwright').Page} page */
export async function measureCaptureViewport(page) {
  const size = await page.evaluate((maxCss) => {
    const el = document.getElementById("capture-root");
    if (!el) throw new Error("capture-root not found");
    const bodyStyle = getComputedStyle(document.body);
    const padX =
      parseFloat(bodyStyle.paddingLeft) + parseFloat(bodyStyle.paddingRight);
    const padY =
      parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
    const width = Math.ceil(el.scrollWidth + padX);
    const height = Math.ceil(el.scrollHeight + padY);
    return {
      width: Math.min(Math.max(width, 1), maxCss),
      height: Math.min(Math.max(height, 1), maxCss),
    };
  }, MAX_VIEWPORT_CSS);
  return size;
}

/**
 * @param {number} cssWidth
 * @param {number} cssHeight
 * @param {number} [maxPhysical]
 * @param {number} [preferredDsf]
 */
export function computeDeviceScaleFactor(
  cssWidth,
  cssHeight,
  maxPhysical = MAX_PHYSICAL_LONG_EDGE,
  preferredDsf = DEVICE_SCALE_FACTOR_PREFERRED,
) {
  const longCss = Math.max(cssWidth, cssHeight);
  if (longCss <= 0) return preferredDsf;
  return Math.min(preferredDsf, maxPhysical / longCss);
}

/** @param {Buffer} pngBuffer */
export function readPngDimensions(pngBuffer) {
  if (pngBuffer.length < 24) {
    throw new Error("invalid PNG buffer");
  }
  const signature = pngBuffer.subarray(0, 8);
  const expected = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!signature.equals(expected)) {
    throw new Error("invalid PNG signature");
  }
  const width = pngBuffer.readUInt32BE(16);
  const height = pngBuffer.readUInt32BE(20);
  return { width, height };
}

/**
 * @param {number} cssWidth
 * @returns {string | null}
 */
export function buildSmallWidthWarning(cssWidth) {
  if (cssWidth >= MIN_CSS_WIDTH_WARNING) return null;
  return `生成画像の幅が ${Math.round(cssWidth)}px と小さいです。プロンプトを調整して再生成することをおすすめします。`;
}

/** @param {import('playwright').Page} page */
async function preparePageContent(page, fragment) {
  await page.setContent(wrapFragment(fragment), {
    waitUntil: "load",
    timeout: 60_000,
  });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(800);
  const root = page.locator("#capture-root");
  await root.waitFor({ state: "visible", timeout: 15_000 });
  return root;
}

/**
 * @param {string} fragment
 * @returns {Promise<{ png: Buffer; cssWidth: number; cssHeight: number }>}
 */
export async function renderDiagramToPng(fragment) {
  const browser = await chromium.launch();
  try {
    const probePage = await browser.newPage({
      viewport: INITIAL_VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR_PREFERRED,
    });
    await preparePageContent(probePage, fragment);
    const contentViewport = await measureCaptureViewport(probePage);
    const deviceScaleFactor = computeDeviceScaleFactor(
      contentViewport.width,
      contentViewport.height,
    );
    await probePage.close();

    const page = await browser.newPage({
      viewport: contentViewport,
      deviceScaleFactor,
    });
    const root = await preparePageContent(page, fragment);
    const png = Buffer.from(await root.screenshot({ type: "png" }));
    const { width, height } = readPngDimensions(png);
    const longEdge = Math.max(width, height);
    if (longEdge > MAX_PHYSICAL_LONG_EDGE) {
      throw new Error(
        `PNG long edge ${longEdge}px exceeds max ${MAX_PHYSICAL_LONG_EDGE}px after normalization`,
      );
    }
    return {
      png,
      cssWidth: width / deviceScaleFactor,
      cssHeight: height / deviceScaleFactor,
    };
  } finally {
    await browser.close();
  }
}

/** @returns {Promise<boolean>} */
export async function isPlaywrightChromiumAvailable() {
  try {
    const browser = await chromium.launch();
    await browser.close();
    return true;
  } catch {
    return false;
  }
}
