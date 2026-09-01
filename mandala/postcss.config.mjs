// ⚠ 空だが必要なファイル。消さないこと（publishing-site-deployment spec の要件）。
//
// mandala は Tailwind を使わない（app/globals.css に @import "tailwindcss" /
// @tailwind / @apply は 1 つも無く、Nextra と @xyflow の CSS はビルド済み）。
// それでもこの設定を置くのは、Next の postcss 設定探索が find-up で親方向へ
// 遡るため（next/dist/lib/find-config.js の findConfigPath）。
//
// 兄弟構成（mandala/ の親＝設定を持たない入れ物 dx-training-studio/）に
// なってからは、探索範囲に他の postcss 設定は無く、理論上は無くても落ちない。
// それでも残すのは、親側に設定が生えた瞬間に黙って拾う構造へ戻さないための
// 防御（過去に Studio の @tailwindcss/postcss を拾って CI だけが落ちた実績あり）。
const config = {
  plugins: {},
};

export default config;
