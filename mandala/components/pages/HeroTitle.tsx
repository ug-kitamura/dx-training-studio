import { TitleWithCatch } from "@/components/pages/TitleWithCatch";

/**
 * シリーズ・コースのヒーロー見出し。
 * 記法（`DX入門コース ——地図を手に入れる`）の組み立ては `TitleWithCatch` が持つ——
 * ここは `<h1>` で包み、キャッチにヒーロー用のスタイルを当てるだけ。
 */
export function HeroTitle({
  title,
  catchCopy,
}: {
  title: string;
  catchCopy?: string;
}) {
  return (
    <h1 className="dxm-hero-title">
      <TitleWithCatch
        title={title}
        catchCopy={catchCopy}
        catchClassName="dxm-hero-catch"
      />
    </h1>
  );
}
