import type { NextConfig } from "next";
import path from "node:path";

// プロジェクトルートを明示する。次の事故を防ぐ目的:
//   1. 親ディレクトリ（ホーム直下など）に lockfile が紛れていると Next.js が
//      そこをワークスペースルートと誤認識し、`outputFileTracing` が想定外の範囲を辿る
//   2. モノレポ内でも本ディレクトリを tracing の基準にする
const projectRoot = path.resolve(__dirname);

// Vercel 上でリポジトリが展開される場所。
//
// 正本 `../contents/` は Root Directory（= 本ディレクトリ）の外にあるため、Vercel の
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

const nextConfig: NextConfig = {
  // ⚠ `turbopack.root` はリポジトリルートへ向けない。向けると ebex / mandala /
  // minutes-maid の lockfile を巻き込んで走査し、上のコメントが防いでいる事故を自ら招く
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: process.env.VERCEL ? VERCEL_SOURCE_ROOT : projectRoot,
  // `.meta.json` の焼き込みは `createRequire` で読む（parity プローブが静的
  // JSON import を扱えないため）。NFT が取りこぼさないよう全ルートへ明示同梱する
  outputFileTracingIncludes: {
    "/*": ["./lib/contents-meta.generated.json"],
  },
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
