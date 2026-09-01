import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { SiteShell } from "@/components/SiteShell";
import { siteChrome } from "@/lib/site-data";
import { resolveReleaseInfo } from "@/lib/release-info";
import supergraphicImage from "./supergraphic.png";
import "nextra-theme-docs/style.css";
import "./globals.css";

export const metadata = {
  // 全ページ共通でサイト名のみを表示する（ページ別の title は使わない）。
  // 実際の上書きは app/[[...mdxPath]]/page.jsx の generateMetadata が担う。
  title: siteChrome().name,
  description:
    "DX ツールを業務で使えるようになるためのトレーニング。曼陀羅で全体の道のりを見渡しながら進められます。",
};

/**
 * テーマの `<Layout>` は `SiteShell` が描く。
 *
 * ⚠ `SiteShell` を動的セグメント配下のレイアウトへ移さないこと——
 * クライアント遷移のたびに作り直され、console エラーの原因になる（理由は SiteShell 参照）。
 * pageMap は言語を問わないルート全体を1回だけ組み立て、言語による絞り込みは
 * `SiteShell` がパスから行う。
 */
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { lineJa, lineEn } = resolveReleaseInfo();

  return (
    <html lang="ja" dir="ltr" suppressHydrationWarning>
      <Head />
      {/* 更新日の行はサイドバー最上部に `::before` で描く（テーマに差し込み口が無いため）。
          全ビルドで出す（Vercel=日付のみ / Pages=日付＋タグ番号）。日付もタグも
          解決できなかったビルドでは変数を置かない——`content` が無効になり、
          擬似要素そのものが生成されないので、行も余白も残らない。
          ⚠ 表記は言語で変わる（`… 更新` / `Updated on …`）が、このレイアウトは
          サーバ側で**現在の言語を知らない**（言語はパスで決まる）。そこで日英2本を
          両方注いでおき、選ぶのは CSS 側（`html[lang="en"]` セレクタ）に任せる。
          `<html lang>` は静的 HTML では postbuild、SPA 遷移では SiteShell が
          正しくしているので、この方式なら JS を1行も足さずに両方へ追随する。
          日英は同じ入力から作るので片方だけ欠けることはない（→ release-info.ts）。 */}
      <body
        style={
          lineJa && lineEn
            ? ({
                "--dxm-release-ja": JSON.stringify(lineJa),
                "--dxm-release-en": JSON.stringify(lineEn),
              } as CSSProperties)
            : undefined
        }
      >
        {/* 装飾目的の supergraphic バナー。縦帯構成なので cover で中央を切り出しても
            色帯の横並びは保たれる。スクロール中も画面最上部に留まる——
            固定は `globals.css` 側の `position: fixed` が担う。帯はフローから外れ、
            その 6px はテーマの `--nextra-navbar-height` を 1 本増やして navbar 側に
            確保している。`sticky` にすると帯がフローに 6px 残り、navbar がその分
            ずり上がってから固定される（詳細は `.dxm-supergraphic` のコメント）。 */}
        <Image
          src={supergraphicImage}
          alt=""
          aria-hidden
          priority
          className="dxm-supergraphic"
        />
        <SiteShell pageMap={await getPageMap()}>{children}</SiteShell>
      </body>
    </html>
  );
}
