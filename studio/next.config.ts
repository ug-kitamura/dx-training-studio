import type { NextConfig } from "next";
import path from "node:path";

// 入れ物ルート。正本（`../contents/` `../images/`）はアプリ（`studio/`）の外＝ここの直下にある。
const containerRoot = path.resolve(__dirname, "..");

// Vercel 上でリポジトリが展開される場所。
//
// 正本 `../contents/` は Root Directory（= `studio/`）の外にあるため、Vercel の
// `Include files outside the root directory` を Enabled にしている。すると Vercel は
// リポジトリ丸ごとをここへ置き、`@vercel/next` は「Next アプリのルート == この場所」と
// 決めつけて `.next` と `.nft.json` を re-root する。`outputFileTracingRoot` をそこへ
// 合わせないと、ビルド生成物の回収先を取り違えて
// `ENOENT: .../.next/routes-manifest-deterministic.json` で落ちる
// （Next 16 + Turbopack + Root Directory + include-outside の噛み合わせ。
//  上流の同一症状: https://github.com/resend/react-email/issues/3557）。
//
// ⚠ この前提が崩れていないかは `scripts/check-vercel-build-root.mjs` がビルド前に検査する。
const VERCEL_SOURCE_ROOT = "/vercel/path0";

// tracing と Turbopack の共通ルート。値はどちらの環境でも「入れ物ルート」を指す。
//
// ⚠ `outputFileTracingRoot` と `turbopack.root` に違う値を入れないこと。Next 16 は
// この 2 つを 1 つのルートへ畳み、食い違うと警告のうえ `turbopack.root` を捨てる
// （`node_modules/next/dist/server/config.js` の `result.outputFileTracingRoot = rootDir`）。
// 以前ここは `turbopack.root` だけ `studio/` を指していたが、Vercel 上では Next が
// `/vercel/path0` へ書き換えており、指定は効かないままビルドログに警告が出続けていた。
const tracingRoot = process.env.VERCEL ? VERCEL_SOURCE_ROOT : containerRoot;

const nextConfig: NextConfig = {
  turbopack: {
    root: tracingRoot,
  },
  outputFileTracingRoot: tracingRoot,
  // NFT が追跡できないものを、関数へ明示同梱する。
  //
  // ・`.meta.json` の焼き込みは `createRequire` で読む（parity プローブが静的
  //   JSON import を扱えないため）。取りこぼさないよう全ルートへ明示同梱する
  // ・正本画像は `/api/images/file` が論理パスから絶対パスを動的に組み立てて
  //   `fs.readFile` するため、NFT からは見えない
  //
  // ⚠ 画像の行を消すと、デプロイ先で一覧が空・実体が 404 になる（ローカルは fs を
  //   直接読むので気づけない）。リポジトリ切り出し前は Root Directory の外が Vercel に
  //   よって暗黙に同梱されていて偶然動いていたが、アプリが `/vercel/path0` の直下へ
  //   移った時点でその副作用は消えた。`Include files outside the root directory` が
  //   保証するのは**ビルドコンテナへの配置まで**で、関数への同梱は別の話。
  // ⚠ glob は上の `tracingRoot` の内側でなければ Turbopack に拒否される。
  // ⚠ 拡張子は `lib/image-store.ts` の `MIME_BY_EXT` のうち `image/*` に揃えている。
  //   `mp4` は `.gitignore` が正本から除外しているので含めない。
  outputFileTracingIncludes: {
    "/*": [
      "./lib/contents-meta.generated.json",
      "../images/*.png",
      "../images/*.jpg",
      "../images/*.jpeg",
      "../images/*.gif",
      "../images/*.webp",
      "../images/*.svg",
    ],
  },
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
