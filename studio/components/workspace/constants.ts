/** Dashed full-width add action (course / lesson / series lists). */
export const ADD_LIST_BUTTON_CLASS =
  "w-full justify-between gap-1 border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary";

/** コース/レッスン行の左右余白（追加ボタン size=sm の px-2.5 と揃える） */
export const LIST_ROW_X_INSET_CLASS = "px-2.5";

/** ペイン1 SidebarContent / ペイン2 リスト領域の左右余白（左は一段狭く、右は一段広い） */
export const PANE_LIST_CONTENT_X_INSET_CLASS = "pl-1 pr-3";

/** リスト子ブロックの左インデント（シリーズ進捗・コース/レッスン一覧など）。PANE_LIST_CONTENT_X_INSET の内側に置く */
export const LIST_CHILD_LEFT_INSET_CLASS = "ml-3 pl-2";

/** この距離未満のポインタ操作はクリック（選択）として扱う */
export const SORTABLE_POINTER_ACTIVATION = { distance: 8 } as const;

/** コース/レッスン行（未選択）: テキスト・アイコンは foreground、ホバーで背景のみ */
export const LIST_ROW_UNSELECTED_CLASS =
  "text-foreground hover:bg-muted [&_svg]:text-current";

/** コース/レッスン行（選択中）: シリーズ見出しと同系統の foreground + 背景ハイライト */
export const LIST_ROW_SELECTED_CLASS =
  "bg-muted font-semibold text-foreground dark:bg-accent dark:text-foreground [&_svg]:text-current";
