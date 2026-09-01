import {
  PANE_WIDTH_DEFAULTS,
  clampPaneWidth,
  type WorkspacePaneWidths,
} from "@/components/workspace/pane-layout";
import {
  DEFAULT_AI_MODEL,
  normalizeAiModel,
  type AiModelSlug,
} from "@/lib/ai-models";
import {
  EDITOR_FONT_SIZE_CHANGED_EVENT as STORAGE_EDITOR_FONT_SIZE_CHANGED_EVENT,
  STORAGE_KEYS,
  WORKSPACE_SETTINGS_CHANGED_EVENT as STORAGE_WORKSPACE_SETTINGS_CHANGED_EVENT,
} from "@/lib/storage-keys";

export type { AiModelSlug };

/**
 * `pink` は独立したモードで、`dark` とは排他。OS の明暗設定とは合成しない
 * （ピンクのダークモードは無い）——`html:not(.dark)` 基準の hljs・CodeMirror が
 * そのままライト配色で効くことが、この排他性の見返り。
 */
export type ThemeMode = "light" | "dark" | "system" | "pink";

export type ImageStorageMode = "local" | "storage";

export type ContextStorageMode = "local" | "database";

export const EDITOR_FONT_SIZE_DEFAULT = 14;
export const EDITOR_FONT_SIZE_MIN = 8;
export const EDITOR_FONT_SIZE_MAX = 32;

export const EDITOR_FONT_SIZE_CHANGED_EVENT =
  STORAGE_EDITOR_FONT_SIZE_CHANGED_EVENT;
export const WORKSPACE_SETTINGS_CHANGED_EVENT =
  STORAGE_WORKSPACE_SETTINGS_CHANGED_EVENT;

export type WorkspaceSettings = {
  aiApiKey: string | null;
  pixabayApiKey: string | null;
  /** web_search 用の検索プロバイダ API キー（未設定なら人手フォールバック） */
  searchApiKey: string | null;
  aiModel: AiModelSlug;
  theme: ThemeMode;
  paneDefaults: WorkspacePaneWidths;
  editorFontSizePx: number;
  imageStorage: ImageStorageMode;
  contextStorage: ContextStorageMode;
};

export function clampEditorFontSizePx(value: number): number {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return EDITOR_FONT_SIZE_DEFAULT;
  return Math.min(EDITOR_FONT_SIZE_MAX, Math.max(EDITOR_FONT_SIZE_MIN, n));
}

const STORAGE_KEY = STORAGE_KEYS.settings;

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  aiApiKey: null,
  pixabayApiKey: null,
  searchApiKey: null,
  aiModel: DEFAULT_AI_MODEL,
  theme: "system",
  paneDefaults: { ...PANE_WIDTH_DEFAULTS },
  editorFontSizePx: EDITOR_FONT_SIZE_DEFAULT,
  imageStorage: "storage",
  contextStorage: "database",
};

function normalizePaneDefaults(
  raw: Partial<WorkspacePaneWidths> | undefined,
): WorkspacePaneWidths {
  // 旧3ペイン形式（pane1 / pane2）は tree キーを持たず、コード既定へフォールバックする
  return {
    tree: clampPaneWidth("tree", raw?.tree ?? PANE_WIDTH_DEFAULTS.tree),
    pane4: clampPaneWidth("pane4", raw?.pane4 ?? PANE_WIDTH_DEFAULTS.pane4),
  };
}

export function loadWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_WORKSPACE_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WORKSPACE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettings>;
    return {
      aiApiKey:
        typeof parsed.aiApiKey === "string" ? parsed.aiApiKey : null,
      pixabayApiKey:
        typeof parsed.pixabayApiKey === "string" ? parsed.pixabayApiKey : null,
      searchApiKey:
        typeof parsed.searchApiKey === "string" ? parsed.searchApiKey : null,
      aiModel: normalizeAiModel(parsed.aiModel),
      theme:
        parsed.theme === "dark" ||
        parsed.theme === "system" ||
        parsed.theme === "light" ||
        parsed.theme === "pink"
          ? parsed.theme
          : DEFAULT_WORKSPACE_SETTINGS.theme,
      paneDefaults: normalizePaneDefaults(parsed.paneDefaults),
      editorFontSizePx: clampEditorFontSizePx(
        typeof parsed.editorFontSizePx === "number"
          ? parsed.editorFontSizePx
          : EDITOR_FONT_SIZE_DEFAULT,
      ),
      imageStorage:
        parsed.imageStorage === "storage" || parsed.imageStorage === "local"
          ? parsed.imageStorage
          : DEFAULT_WORKSPACE_SETTINGS.imageStorage,
      contextStorage:
        parsed.contextStorage === "database" || parsed.contextStorage === "local"
          ? parsed.contextStorage
          : DEFAULT_WORKSPACE_SETTINGS.contextStorage,
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_SETTINGS };
  }
}

/** 設定変更イベントの detail。変更されたトップレベルキーの一覧を運ぶ */
export type WorkspaceSettingsChangedDetail = {
  changedKeys: Array<keyof WorkspaceSettings>;
};

/** ストレージ解決に影響するキー。画像系の再取得はこの変更に限定する */
export const STORAGE_AFFECTING_SETTING_KEYS: ReadonlyArray<
  keyof WorkspaceSettings
> = ["imageStorage", "contextStorage"];

/**
 * イベントからストレージ関連の変更かを判定する。
 * detail を持たない発火（手動 dispatch 等）は安全側に倒して true。
 */
export function settingsEventAffectsStorage(event: Event): boolean {
  const detail = (event as CustomEvent<WorkspaceSettingsChangedDetail>).detail;
  if (!detail || !Array.isArray(detail.changedKeys)) return true;
  return detail.changedKeys.some((key) =>
    STORAGE_AFFECTING_SETTING_KEYS.includes(key),
  );
}

function diffSettingsKeys(
  prev: WorkspaceSettings,
  next: WorkspaceSettings,
): Array<keyof WorkspaceSettings> {
  const keys = Object.keys(next) as Array<keyof WorkspaceSettings>;
  return keys.filter((key) => {
    if (key === "paneDefaults") {
      return (
        prev.paneDefaults.tree !== next.paneDefaults.tree ||
        prev.paneDefaults.pane4 !== next.paneDefaults.pane4
      );
    }
    return prev[key] !== next[key];
  });
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadWorkspaceSettings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    const detail: WorkspaceSettingsChangedDetail = {
      changedKeys: diffSettingsKeys(prev, settings),
    };
    window.dispatchEvent(
      new CustomEvent(WORKSPACE_SETTINGS_CHANGED_EVENT, { detail }),
    );
  } catch {
    // ignore quota
  }
}

/** 設定モーダル等からエディタへ即時反映（localStorage も更新） */
export function applyEditorFontSizePx(px: number): number {
  const clamped = clampEditorFontSizePx(px);
  if (typeof window === "undefined") return clamped;
  saveWorkspaceSettings({
    ...loadWorkspaceSettings(),
    editorFontSizePx: clamped,
  });
  window.dispatchEvent(
    new CustomEvent(EDITOR_FONT_SIZE_CHANGED_EVENT, {
      detail: { px: clamped },
    }),
  );
  return clamped;
}

export function resolveThemeClass(theme: ThemeMode): "light" | "dark" | "pink" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  // ピンクは OS の明暗設定を見ない。暗い環境で選んでも明るい画面になる
  if (theme === "pink") return "pink";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  const resolved = resolveThemeClass(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.classList.toggle("pink", resolved === "pink");
}
