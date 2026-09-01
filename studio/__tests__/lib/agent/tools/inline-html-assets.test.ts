import { describe, expect, it } from "vitest";
import {
  compileCss,
  expandIcons,
  extractTailwindConfig,
  injectStyle,
  inlineHtmlAssets,
  stripCdn,
} from "@/lib/agent/tools/inline-html-assets";

describe("stripCdn", () => {
  it("removes tailwind/lucide CDN, tailwind.config and createIcons", () => {
    const html = [
      "<head>",
      '  <script src="https://cdn.tailwindcss.com"></script>',
      "  <script>",
      "    tailwind.config = { theme: { extend: { colors: { a: '#fff' } } } }",
      "  </script>",
      "</head>",
      "<body>",
      '  <script src="https://unpkg.com/lucide@latest"></script>',
      "  <script>lucide.createIcons();</script>",
      "</body>",
    ].join("\n");

    const out = stripCdn(html);
    expect(out).not.toContain("cdn.tailwindcss.com");
    expect(out).not.toContain("unpkg.com/lucide");
    expect(out).not.toContain("tailwind.config");
    expect(out).not.toContain("createIcons");
  });

  it("keeps web font <link> and the data: favicon", () => {
    // フォントは埋め込まない。描画はローカルフォントへ倒れて成立し、
    // 日本語フォントの埋め込みはサイズ的に見合わない
    const html = [
      "<head>",
      '  <link rel="icon" href="data:image/svg+xml,<svg/>">',
      '  <link rel="preconnect" href="https://fonts.googleapis.com">',
      '  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP" rel="stylesheet">',
      "</head>",
    ].join("\n");

    const out = stripCdn(html);
    expect(out).toContain("fonts.googleapis.com");
    expect(out).toContain('href="data:image/svg+xml');
  });
});

describe("extractTailwindConfig", () => {
  it("parses theme.extend written as a JS object literal", () => {
    const html = `<script>
      tailwind.config = {
        theme: {
          extend: {
            colors: { bosch: { bg: '#FFFFFF', 'accent-light': "#2563EB" } },
            fontFamily: { sans: ['"Bosch Sans"', 'sans-serif'] },
          }
        }
      }
    </script>`;
    const config = extractTailwindConfig(html);
    const theme = config?.theme as Record<string, unknown> | undefined;
    const extend = theme?.extend as Record<string, unknown> | undefined;
    const colors = extend?.colors as Record<string, unknown> | undefined;
    expect((colors?.bosch as Record<string, string>).bg).toBe("#FFFFFF");
    expect((colors?.bosch as Record<string, string>)["accent-light"]).toBe("#2563EB");
    expect((extend?.fontFamily as Record<string, string[]>).sans).toContain("sans-serif");
  });

  it("returns null when no config is present", () => {
    expect(extractTailwindConfig("<html><body>hi</body></html>")).toBeNull();
  });

  it("refuses to evaluate code and falls back to null", () => {
    const html = `<script>tailwind.config = { theme: require('./evil') }</script>`;
    expect(extractTailwindConfig(html)).toBeNull();
  });

  it("refuses template literals containing expressions", () => {
    const html = "<script>tailwind.config = { theme: { a: `${process.env.X}` } }</script>";
    expect(extractTailwindConfig(html)).toBeNull();
  });
});

describe("expandIcons", () => {
  it("carries class and style over to the generated svg", () => {
    const html =
      '<i data-lucide="file-text" class="w-6 h-6" style="color:var(--gray-40)"></i>';
    const { html: out, expanded } = expandIcons(html);
    expect(expanded).toBe(1);
    expect(out).toContain("<svg");
    expect(out).toContain('class="w-6 h-6"');
    expect(out).toContain('style="color:var(--gray-40)"');
    expect(out).not.toContain("data-lucide");
  });

  it("resolves legacy names through their re-export", () => {
    // circle-help は circle-question-mark への再エクスポート
    const { html: out, expanded, fallback } = expandIcons(
      '<i data-lucide="circle-help"></i><i data-lucide="alert-circle"></i>',
    );
    expect(expanded).toBe(2);
    expect(fallback).toEqual([]);
    expect(out).toContain("<svg");
  });

  it("falls back instead of aborting on an unknown icon name", () => {
    const { html: out, expanded, fallback } = expandIcons(
      '<i data-lucide="totally-not-an-icon"></i>',
    );
    expect(expanded).toBe(1);
    expect(fallback).toEqual(["totally-not-an-icon"]);
    expect(out).toContain("<svg");
  });
});

describe("injectStyle", () => {
  it("inserts into the FIRST head when the document is nested", () => {
    const html = [
      "<html><head><title>outer</title></head><body><main>",
      "<!DOCTYPE html><html><head><title>inner</title></head><body>x</body></html>",
      "</main></body></html>",
    ].join("");
    const out = injectStyle(html, ".a{color:red}");
    const styleAt = out.indexOf("data-inlined-tailwind");
    const innerHeadAt = out.indexOf("<title>inner</title>");
    expect(styleAt).toBeGreaterThan(-1);
    expect(styleAt).toBeLessThan(innerHeadAt);
  });

  it("creates a head when the document has none", () => {
    const out = injectStyle("<html><body>x</body></html>", ".a{color:red}");
    expect(out).toContain("<head>");
    expect(out).toContain("data-inlined-tailwind");
  });
});

describe("compileCss", () => {
  // Tailwind v3 の実コンパイルを含むため、全スイート並列時のコールドスタートで
  // 既定 5 秒を稀に超える（単独実行は ~300ms。回帰ではなく起動コスト）
  it("generates classes that a prebuilt subset would have missed", { timeout: 20_000 }, async () => {
    const html = `<div class="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800
      md:grid-cols-3 lg:grid-cols-4 hover:shadow-lg space-y-8 animate-bounce
      blur-3xl bg-opacity-50"></div>`;
    const css = await compileCss(html, null);
    for (const probe of [
      ".bg-gradient-to-br",
      ".from-slate-900",
      ".via-blue-900",
      ".space-y-8",
      ".animate-bounce",
      ".blur-3xl",
      ".bg-opacity-50",
      "md\\:grid-cols-3",
      "lg\\:grid-cols-4",
      "hover\\:shadow-lg",
    ]) {
      expect(css, `missing ${probe}`).toContain(probe);
    }
  });

  it("generates arbitrary-value classes", async () => {
    const css = await compileCss('<div class="w-[137px]"></div>', null);
    expect(css).toContain("w-\\[137px\\]");
  });

  it("applies theme.extend from the template", async () => {
    const extend = {
      theme: { extend: { colors: { bosch: { bg: "#FFFFFF", dim: "#94A3B8" } } } },
    };
    const css = await compileCss(
      '<div class="bg-bosch-bg text-bosch-dim"></div>',
      extend,
    );
    // Tailwind は hex を rgb + opacity 変数へ展開する
    expect(css).toContain(".bg-bosch-bg");
    expect(css).toContain("rgb(255 255 255");
    expect(css).toContain(".text-bosch-dim");
    expect(css).toContain("rgb(148 163 184"); // #94A3B8
  });
});

describe("inlineHtmlAssets", () => {
  it("produces a self-contained document in one pass", async () => {
    const html = [
      '<!DOCTYPE html><html lang="ja"><head>',
      '<script src="https://cdn.tailwindcss.com"></script>',
      "<script>tailwind.config = { theme: { extend: { colors: { bosch: { bg: '#FFFFFF' } } } } }</script>",
      "</head><body>",
      '<div class="bg-bosch-bg md:grid-cols-3"><i data-lucide="file-text" class="w-6 h-6"></i></div>',
      '<script src="https://unpkg.com/lucide@latest"></script>',
      "<script>lucide.createIcons();</script>",
      "</body></html>",
    ].join("\n");

    const { html: out, report } = await inlineHtmlAssets(html);

    expect(out).not.toContain("cdn.tailwindcss.com");
    expect(out).not.toContain("unpkg.com/lucide");
    expect(out).not.toContain("data-lucide");
    expect(out).toContain("data-inlined-tailwind");
    expect(out).toContain(".bg-bosch-bg");
    expect(out).toContain("md\\:grid-cols-3");
    expect(report.iconsExpanded).toBe(1);
    expect(report.iconsFallback).toEqual([]);
    expect(report.cssBytes).toBeGreaterThan(0);
  });
});
