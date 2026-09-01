import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * `window.innerWidth < 768px` を購読する。
 *
 * 初期値は **常に `false`**（PC レイアウト相当）。SSR で必ず `false`、CSR でも初回 commit は
 * `false` を返し、`useEffect` の中で実際のメディアクエリ結果に同期する。これにより
 * サーバー HTML と CSR 後の DOM が必ず一致するため、Sidebar がモバイル時に Sheet に
 * 切り替わる構造でも hydration mismatch が起きない。
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
