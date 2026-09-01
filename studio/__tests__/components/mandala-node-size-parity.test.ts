import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SIZES } from "@/components/workspace/mandala/Mandala";

/**
 * 曼陀羅のノード寸法は 2 箇所に二重で持たれている。
 *
 *   - `Mandala.tsx` の `SIZES`     … dagre へ渡す固定寸法（座標計算の前提）
 *   - `globals.css` の `.dxm-node-*` … 実際に描かれる箱の寸法
 *
 * dagre は寸法を固定値として受け取って座標を出すので、片方だけを変えると
 * **辺の接続位置がノードの縁からずれる**。目視の申し合わせでは止められないので、
 * ここで一致を固定する。
 *
 * ⚠ 値そのもの（260 等）はこのテストに書かない。寸法を意図して変えたときに
 * 機械的に落ちるのは守りたい不変量ではない。見るのは「2 箇所が一致すること」だけ。
 */

// ⚠ グローバルの `URL` で相対解決しないこと。jsdom 環境の `URL` は `file:` の
// ベースを無視して**jsdom のドキュメント基準**（`http://localhost:3000/`）へ
// 解決してしまい、`http://localhost:3000/app/globals.css` になる。
// `fileURLToPath` は文字列を受けるので、そちらで実パスへ落としてから `path` で組む。
// cwd に依存しないのは意図的——テストの起動位置が変わっても壊れない
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.join(HERE, "..", "..", "app", "globals.css");

/** `SIZES` のキー → `globals.css` のクラス名 */
const CLASS_OF: Record<keyof typeof SIZES, string | null> = {
  compact: "dxm-node-compact",
  thumbnail: "dxm-node-thumbnail",
  card: "dxm-node-card",
  collapsedSeries: "dxm-node-collapsed",
  // 端子（Start / Goal）はインラインスタイルで描くので CSS に対応クラスを持たない
  terminal: null,
};

type Size = { width: number; height: number };

/**
 * 単一クラスのルール（`.foo { … }`）をすべて集めて宣言を統合し、
 * `width` / `height` を px で取り出す。
 *
 * 同じクラスに複数のルールがあっても拾えるようにするのは、`.dxm-node-card` が
 * 「寸法」と「配置・逃げ」の 2 ブロックに分かれているため。子孫セレクタ
 * （`.dxm-node-card .dxm-node-style`）は `{` の直前で終わらないので拾わない。
 */
function readSizeFromCss(css: string, className: string): Size {
  const rule = new RegExp(`\\.${className}(?![\\w-])\\s*\\{([^}]*)\\}`, "g");
  const bodies = [...css.matchAll(rule)].map((m) => m[1]);

  if (bodies.length === 0) {
    throw new Error(`globals.css に .${className} のルールが見つからない`);
  }

  const pick = (prop: "width" | "height"): number => {
    const decl = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)px\\s*(?:;|$)`);
    for (const body of bodies) {
      const hit = body.match(decl);
      if (hit) return Number(hit[1]);
    }
    // 読めないことを「一致」と誤判定しないため、失敗させる
    throw new Error(`.${className} の ${prop} を px で読み取れない`);
  };

  return { width: pick("width"), height: pick("height") };
}

describe("曼陀羅ノードの寸法は SIZES と globals.css で一致する", () => {
  const css = readFileSync(CSS_PATH, "utf8");

  const targets = (
    Object.entries(CLASS_OF) as Array<[keyof typeof SIZES, string | null]>
  ).filter((entry): entry is [keyof typeof SIZES, string] => entry[1] !== null);

  it.each(targets)("%s は .%s と一致する", (key, className) => {
    expect(readSizeFromCss(css, className)).toEqual({
      width: SIZES[key].width,
      height: SIZES[key].height,
    });
  });

  it("CSS に無いクラスを指定したら失敗する", () => {
    expect(() => readSizeFromCss(css, "dxm-node-does-not-exist")).toThrow();
  });

  it("寸法を宣言していないクラスは失敗する", () => {
    expect(() => readSizeFromCss(css, "dxm-node-style")).toThrow();
  });
});
