/** Pane3（エディタ）の表示モード。leaf に置き Workspace ↔ image-manager の循環を避ける */
export type Pane3Mode = "inline" | "raw" | "diff";

export type WorkspacePaneWidths = {
  tree: number;
  pane4: number;
};

export const PANE_WIDTH_DEFAULTS: WorkspacePaneWidths = {
  tree: 350,
  pane4: 500,
};

/** Pane3（エディタ）の最小幅 — 派生幅のため設定 UI には含めない */
export const PANE3_MIN_WIDTH = 500;

/** Pane4 折りたたみ時ストリップ幅（w-12） */
export const PANE4_COLLAPSED_WIDTH = 48;

/** ウィンドウリサイズ等: pane3 不足時の縮小順 */
export const PANE_SHRINK_ORDER_DEFAULT: (keyof WorkspacePaneWidths)[] = [
  "pane4",
  "tree",
];

/** 各ペインを広げる際に他ペインを縮める順（pane3 は常に最後＝ここには含めない） */
export const PANE_SHRINK_ORDER_WHEN_EXPAND: Record<
  keyof WorkspacePaneWidths,
  (keyof WorkspacePaneWidths)[]
> = {
  tree: ["pane4"],
  pane4: ["tree"],
};

/** ImageGrid セル最小幅（px） */
export const IMAGE_GRID_CELL_MIN = 100;

/** メインペイン行のリサイズハンドル 1 本あたりのレイアウト幅（px） */
export const PANE_RESIZE_HANDLE_WIDTH_PX = 8;

/** 設定モーダルでのペイン既定幅の変更刻み（px） */
export const PANE_WIDTH_STEP = 5;

export const PANE_WIDTH_LIMITS = {
  tree: { min: 250, max: 450 },
  // pane4（画面上のペイン3＝エージェント／画像）の下限は 300 では実用に足りず
  // 400 へ引き上げた（2026-08-19）。保存済みの 300〜399 は起動時の clamp で丸まる
  pane4: { min: 400, max: 700 },
} as const;

/** 左端の区切り線: 右ドラッグでペイン幅が狭くなる */
export const PANE_RESIZE_INVERT_DELTA: Record<
  keyof WorkspacePaneWidths,
  boolean
> = {
  tree: false,
  pane4: true,
};

export type FitActivePane = keyof WorkspacePaneWidths | null;

export type FitPaneLayoutInput = {
  requested: WorkspacePaneWidths;
  /** ワークスペース全体幅（SidebarProvider 等） */
  totalWidth: number;
  pane4Open: boolean;
  /** ドラッグで拡大中のペイン。null はウィンドウリサイズ・設定適用 */
  expandPane?: FitActivePane;
};

function shrinkOrderFor(input: FitPaneLayoutInput): (keyof WorkspacePaneWidths)[] {
  if (input.expandPane) {
    return PANE_SHRINK_ORDER_WHEN_EXPAND[input.expandPane];
  }
  return PANE_SHRINK_ORDER_DEFAULT;
}

import { STORAGE_KEYS } from "@/lib/storage-keys";

const STORAGE_KEY = STORAGE_KEYS.paneWidths;
const SETTINGS_STORAGE_KEY = STORAGE_KEYS.settings;

function loadPaneDefaultsFromSettings(): WorkspacePaneWidths {
  if (typeof window === "undefined") return { ...PANE_WIDTH_DEFAULTS };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...PANE_WIDTH_DEFAULTS };
    const parsed = JSON.parse(raw) as {
      paneDefaults?: Partial<WorkspacePaneWidths>;
    };
    // 旧3ペイン形式（pane1 / pane2）の保存値は tree キーを持たないため、
    // ここで自然にコード既定へフォールバックする（読み捨て・エラーにしない）
    const d = parsed.paneDefaults;
    return {
      tree: clampPaneWidth("tree", d?.tree ?? PANE_WIDTH_DEFAULTS.tree),
      pane4: clampPaneWidth("pane4", d?.pane4 ?? PANE_WIDTH_DEFAULTS.pane4),
    };
  } catch {
    return { ...PANE_WIDTH_DEFAULTS };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampRequestedWidths(
  requested: WorkspacePaneWidths,
): WorkspacePaneWidths {
  return {
    tree: clampPaneWidth("tree", requested.tree),
    pane4: clampPaneWidth("pane4", requested.pane4),
  };
}

function mainRowHandleCount(pane4Open: boolean): number {
  return pane4Open ? 1 : 0;
}

function pane4EffectiveWidth(
  widths: WorkspacePaneWidths,
  pane4Open: boolean,
): number {
  return pane4Open ? widths.pane4 : PANE4_COLLAPSED_WIDTH;
}

/** pane3 実幅（px）を算出する */
export function computePane3Width(
  widths: WorkspacePaneWidths,
  options: { totalWidth: number; pane4Open: boolean },
): number {
  const handles =
    mainRowHandleCount(options.pane4Open) * PANE_RESIZE_HANDLE_WIDTH_PX;
  return (
    options.totalWidth -
    widths.tree -
    pane4EffectiveWidth(widths, options.pane4Open) -
    handles
  );
}

/** 利用可能幅に収めつつ pane3 最小幅 400 を守る */
export function fitPaneLayout(input: FitPaneLayoutInput): WorkspacePaneWidths {
  let widths = clampRequestedWidths(input.requested);
  const expandPane = input.expandPane ?? null;
  const shrinkOrder = shrinkOrderFor(input);

  for (;;) {
    const pane3 = computePane3Width(widths, {
      totalWidth: input.totalWidth,
      pane4Open: input.pane4Open,
    });
    if (pane3 >= PANE3_MIN_WIDTH) {
      return widths;
    }

    const deficit = PANE3_MIN_WIDTH - pane3;
    let remaining = deficit;

    for (const pane of shrinkOrder) {
      if (remaining <= 0) break;
      if (pane === expandPane) continue;
      if (pane === "pane4" && !input.pane4Open) continue;

      const { min } = PANE_WIDTH_LIMITS[pane];
      const canShrink = widths[pane] - min;
      if (canShrink <= 0) continue;

      const take = Math.min(canShrink, remaining);
      widths = { ...widths, [pane]: widths[pane] - take };
      remaining -= take;
    }

    if (remaining > 0) {
      if (expandPane) {
        widths = {
          ...widths,
          [expandPane]: clampPaneWidth(
            expandPane,
            widths[expandPane] - remaining,
          ),
        };
      }
      return widths;
    }
  }
}

export function clampPaneWidth(
  pane: keyof WorkspacePaneWidths,
  value: number,
): number {
  const { min, max } = PANE_WIDTH_LIMITS[pane];
  return clamp(value, min, max);
}

/** 設定モーダル用: 範囲内に収めたうえで PANE_WIDTH_STEP 刻みに丸める */
export function snapPaneWidth(
  pane: keyof WorkspacePaneWidths,
  value: number,
): number {
  const clamped = clampPaneWidth(pane, value);
  return clampPaneWidth(
    pane,
    Math.round(clamped / PANE_WIDTH_STEP) * PANE_WIDTH_STEP,
  );
}

export function snapPaneWidths(widths: WorkspacePaneWidths): WorkspacePaneWidths {
  return {
    tree: snapPaneWidth("tree", widths.tree),
    pane4: snapPaneWidth("pane4", widths.pane4),
  };
}

export function loadPaneWidths(): WorkspacePaneWidths {
  if (typeof window === "undefined") return { ...PANE_WIDTH_DEFAULTS };
  const defaults = loadPaneDefaultsFromSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    // 旧3ペイン形式は tree キーが無いので既定値へフォールバックする
    const parsed = JSON.parse(raw) as Partial<WorkspacePaneWidths>;
    return {
      tree: clampPaneWidth("tree", parsed.tree ?? defaults.tree),
      pane4: clampPaneWidth("pane4", parsed.pane4 ?? defaults.pane4),
    };
  } catch {
    return { ...defaults };
  }
}

export function savePaneWidths(widths: WorkspacePaneWidths) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // ignore quota errors
  }
}
