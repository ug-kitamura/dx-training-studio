import { formatLessonStatus, type LessonStatus } from "@/lib/site-data";
import type { Locale } from "@/lib/locale-path";

/**
 * ラベルの種別。配色は種別で決まる（状態=赤系 / 所要時間=緑系 / 受講形態=青系）。
 * 目次（コーストップの一覧）とレッスンページのラベル行で同じ部品を使う——
 * 同じ意味の値が場所によって違う言葉・違う色になるのを防ぐため。
 */
export type LabelKind = "status" | "minutes" | "style" | "note";

export function Label({
  kind,
  children,
}: {
  kind: LabelKind;
  children: React.ReactNode;
}) {
  return <span className={`dxm-label dxm-label-${kind}`}>{children}</span>;
}

/** 執筆状況のラベル。`done` には出さない */
export function StatusLabel({
  status,
  locale = "ja",
}: {
  status: LessonStatus;
  locale?: Locale;
}) {
  const label = formatLessonStatus(status, locale);
  if (!label) return null;
  return <Label kind="status">{label}</Label>;
}

/*
 * ⚠ 翻訳の状態バッジ（`Not translated yet` / `Translation may be outdated`）は
 * 廃止した（publishing-site-build spec）。未翻訳ページは本文が `Coming soon` に
 * なるので重複であり、翻訳の古さは受講者が対処できない——鮮度の合図は
 * Studio（編集者）側の赤字1行だけが持つ。ここに戻さないこと。
 */
