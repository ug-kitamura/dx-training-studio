"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { toggleLocalePath, localeOf } from "@/lib/locale-path";

/**
 * 日本語（ルート）と英語（/en サブツリー）を切り替える。
 * ブラウザ言語による自動リダイレクトはしない（静的 export では middleware が動かない）。
 */
export function LanguageToggle() {
  const pathname = usePathname() ?? "/";
  const current = localeOf(pathname);
  const target = toggleLocalePath(pathname);

  return (
    <Link
      href={target}
      className="dxm-lang-toggle"
      hrefLang={current === "ja" ? "en" : "ja"}
      aria-label={current === "ja" ? "Switch to English" : "日本語に切り替える"}
    >
      {current === "ja" ? "EN" : "日本語"}
    </Link>
  );
}
