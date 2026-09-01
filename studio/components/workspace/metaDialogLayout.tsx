import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { EditLanguage } from "@/lib/display-name";

/** 属性名 ↔ 属性値（同一グループ内・近い） */
const LABEL_VALUE_GAP = "gap-1.5";

/** 属性値の下 ↔ 次の属性名（グループ間・広い） */
const GROUP_GAP_Y = "gap-y-4";

/** 1 属性 = ラベル + 値 */
export const META_DIALOG_FIELD = cn("flex min-w-0 flex-col", LABEL_VALUE_GAP);

/** 複数属性の 2 列レイアウト（コースメタなど） */
export const META_DIALOG_GRID = cn(
  "grid grid-cols-2",
  "gap-x-4",
  GROUP_GAP_Y,
);

/** 1 列レイアウト（レッスンメタなど） */
export const META_DIALOG_STACK = cn("flex flex-col", GROUP_GAP_Y);

/** モーダル本文の上下パディング */
export const META_DIALOG_FORM = "py-2";

/** 入力・セレクトの共通見た目（モーダル内はライトで白背景） */
export const META_DIALOG_CONTROL = "bg-white dark:bg-input/30";

/**
 * メタ編集の見出しの体裁（workspace-meta-views spec）。
 *
 * メタ編集の入口は2種類ある——ホーム・シリーズ・コースはペイン2 のビュー
 * （`MetaViewShell` の `h3`）、レッスンだけはモーダル（`LessonMetaDialog` の
 * `DialogTitle`）。**入口がどちらかで見出しの大きさが変わってはいけない**ので、
 * クラスを両方に書き写さずここで共有する。
 *
 * ⚠ ペイン2 **ヘッダー**のタイトル（選択中の階層名）はこれを使わない——
 * `text-sm` のままにする。ヘッダー＝「いまどこにいるか」／見出し＝「何を編集して
 * いるか」で役割が違い、**大きさの差がその区別を示している**。揃えないこと。
 */
export const META_HEADING_TEXT = "text-base font-semibold";

type MetaDialogFieldProps = {
  children: ReactNode;
  className?: string;
};

export function MetaDialogField({ children, className }: MetaDialogFieldProps) {
  return <div className={cn(META_DIALOG_FIELD, className)}>{children}</div>;
}

/** ペイン2 ヘッダーの階層種別 */
export type PaneKind = "root" | "series" | "course" | "lesson";

/**
 * 階層種別ラベルの語彙（workspace-meta-views spec）。
 *
 * ⚠ 英語は公開サイトの呼称に揃える——サイトは英語ルートを `Home` と呼ぶ
 * （`mandala/scripts/lib/emit.mts` の `homeLabel`）。`All` / `Top` / `Overview` の
 * ような**システムのどこにも無い第4の語を持ち込まないこと**。
 *
 * ⚠ バッジが英語になるのは、隣に並ぶタイトル（コンテンツ名）が英語になるから
 * ——**コンテンツの識別行の一部**であり、UI 文言の英語化ではない。
 */
const PANE_KIND_LABELS: Record<PaneKind, { ja: string; en: string }> = {
  root: { ja: "全体", en: "Home" },
  series: { ja: "シリーズ", en: "Series" },
  course: { ja: "コース", en: "Course" },
  lesson: { ja: "レッスン", en: "Lesson" },
};

export function paneKindLabel(kind: PaneKind, language: EditLanguage): string {
  return PANE_KIND_LABELS[kind][language];
}

/**
 * メタ編集面の見出し（workspace-meta-views spec）。
 * 命名規則はレッスンメタ編集モーダルの `DialogTitle` と同じ
 * （`<階層>メタを編集` ＋ 英語ビューは `（英語）` サフィックス）。
 *
 * ⚠ **UI 文言なので英語モードでも日本語**。表示名ヘルパーを通さない
 * （英語になるのはコンテンツ由来の名前だけ、という射程の線引き）。
 */
const META_HEADING_BASE: Record<Exclude<PaneKind, "lesson">, string> = {
  root: "全体メタを編集",
  series: "シリーズメタを編集",
  course: "コースメタを編集",
};

export function metaViewHeading(
  kind: Exclude<PaneKind, "lesson">,
  language: EditLanguage,
): string {
  const base = META_HEADING_BASE[kind];
  return language === "en" ? `${base}（英語）` : base;
}

/**
 * ペイン2 ヘッダー左端の階層種別ラベル。
 * メタビュー（MetaViewShell）とレッスンのエディタビューで**同じ見た目**にする
 * 要件があるので、クラスを書き写さずこの部品を共有する。
 */
export function PaneKindBadge({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}
