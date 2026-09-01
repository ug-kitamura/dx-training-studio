import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import supergraphicImage from "./supergraphic.png";

// Inter は欧文・数字部分にだけ適用したい（日本語はシステム日本語フォントに任せる）。
// variable で `--font-inter` を発行し、`globals.css` の `--font-sans` で参照する。
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DX Training Studio",
  description:
    "社内DXツールトレーニングのコンテンツ計画・作成・編集・デプロイを支援する統合スタジオ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* 装飾目的の supergraphic バナー。縦帯構成なので cover で中央を切り出しても
            色帯の横並びは保たれる。高さは `--supergraphic-h`（globals.css）が正本——
            ビューポート高から差し引く側と同じ値を使うため。 */}
        <Image
          src={supergraphicImage}
          alt=""
          aria-hidden
          priority
          className="h-(--supergraphic-h) w-full shrink-0 object-cover"
        />
        {/* shadcn/ui の Sidebar コンポーネント（SidebarMenuButton の collapsed
            時 tooltip 等）が要求するためアプリ全体をラップする。 */}
        <TooltipProvider delay={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
