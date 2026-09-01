"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Layout, Navbar } from "nextra-theme-docs";
import { GitHubIcon } from "nextra/icons";
import type { PageMapItem } from "nextra";
import { siteChrome } from "@/lib/site-data";
import { LanguageToggle } from "@/components/LanguageToggle";
import { MandalaModal } from "@/components/MandalaModal";
import { localeOf } from "@/lib/locale-path";

const navbar = (
  <Navbar
    logo={
      <span className="dxm-logo">
        <span className="dxm-logo-mark" aria-hidden="true" />
        {siteChrome().name}
      </span>
    }
    projectLink={siteChrome().githubUrl}
    /* テーマの既定は 24px だが、`GitHubIcon` は viewBox が `3 3 18 18` で
       余白を持たないため、lucide の 24px より一回り大きく見える。
       ここで寸法を与えて CSS での上書きを避ける（理由は globals.css の
       `.dxm-mandala-button` を参照） */
    projectIcon={
      <GitHubIcon
        height="16"
        aria-label="Project repository"
        /* 色は globals.css の「ナビバー右上の3ボタン」が `:has()` で親の
           `<a>` を掴んで与える。ここはその掴みどころ */
        className="dxm-navbar-icon"
      />
    }
  >
    {/* テーマは `[projectLink, chatLink, children]` の順に描くので、
        children の先頭に置くと「GitHub → 曼陀羅 → 言語」の並びになる */}
    <MandalaModal />
    <LanguageToggle />
  </Navbar>
);

/**
 * サイドバーには「いま見ている言語のツリーだけ」を出す。
 * 日本語はルートの pageMap から `en` を除き、英語は `en` フォルダの中身を使う
 * （`getPageMap("/en")` と同じもの）。言語の行き来はナビバーのトグルが担う。
 */
function localePageMap(
  pageMap: PageMapItem[],
  pathname: string,
): PageMapItem[] {
  if (localeOf(pathname) === "en") {
    const en = pageMap.find((item) => "name" in item && item.name === "en");
    return en && "children" in en ? en.children : pageMap;
  }
  return pageMap.filter((item) => !("name" in item && item.name === "en"));
}

/**
 * テーマの `<Layout>`（ナビバー・サイドバー）を描く。
 *
 * ⚠ **動的セグメント配下のレイアウトに置いてはならない。**
 * `app/[[...mdxPath]]/layout.tsx` に置くと、クライアント遷移のたびにレイアウトごと
 * 作り直され、next-themes の `<script>` が再マウントされて console エラーを撒く
 * （`Encountered a script tag while rendering React component` と、その巻き添えの
 * `Element type is invalid`）。ルートレイアウトは遷移をまたいで保たれるので、
 * `<Layout>` はそこに置き、「いま見ている言語」は params ではなく
 * `usePathname()` から得る——これがクライアント境界をここに引いている理由。
 */
export function SiteShell({
  pageMap,
  children,
}: {
  pageMap: PageMapItem[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const localizedPageMap = useMemo(
    () => localePageMap(pageMap, pathname),
    [pageMap, pathname],
  );

  // `<html lang>` を現在地の言語へ同期する。静的 HTML は postbuild
  // （scripts/set-en-lang.mts）が正しくするので、これはクライアント遷移
  // （ja ⇄ en の SPA 遷移）と dev サーバーのための補完。
  // ⚠ Pagefind の索引言語は「検索を最初に開いた時点」の lang で決まる——
  // 遷移前に一度検索していると、次のフルロードまで前言語の索引が残る（既知の限界）
  const locale = localeOf(pathname);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <Layout
      navbar={navbar}
      pageMap={localizedPageMap}
      docsRepositoryBase={siteChrome().githubUrl}
      editLink={null}
      feedback={{ content: null }}
    >
      {children}
    </Layout>
  );
}
