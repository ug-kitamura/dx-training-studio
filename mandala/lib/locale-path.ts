export type Locale = "ja" | "en";

export const LOCALES: Locale[] = ["ja", "en"];

/** 日本語はルート、英語は `/en` サブツリー */
export const DEFAULT_LOCALE: Locale = "ja";

export function localeOf(pathname: string): Locale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "ja";
}

/** ロケールを外した純粋なパス（`/en/git/x` → `/git/x`、`/en` → `/`） */
export function stripLocale(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice("/en".length);
  return pathname;
}

export function withLocale(pathname: string, locale: Locale): string {
  const base = stripLocale(pathname);
  if (locale === "ja") return base;
  return base === "/" ? "/en" : `/en${base}`;
}

/** 現在のパスの言語を反転したパス */
export function toggleLocalePath(pathname: string): string {
  return withLocale(pathname, localeOf(pathname) === "ja" ? "en" : "ja");
}

/** ロケール無しの href（`/git/concepts`）を、そのロケールの href にする */
export function localizedHref(href: string, locale: Locale): string {
  return withLocale(href, locale);
}
