/** 旧 Editor 名の localStorage キー（migration 用） */
export const LEGACY_STORAGE_KEYS = {
  settings: "dx-training-editor-settings",
  paneWidths: "dx-training-editor-pane-widths",
  agentChat: "dx-training-editor-agent-chat",
  selection: "dx-training-editor-selection",
} as const;

export const STORAGE_KEYS = {
  settings: "dx-training-studio-settings",
  paneWidths: "dx-training-studio-pane-widths",
  agentChat: "dx-training-studio-agent-chat",
  selection: "dx-training-studio-selection",
  pane4View: "dx-training-studio-pane4-view",
  /** @deprecated Pane 3 Agent モード移行用（pane4-agent-side-panel） */
  pane3ModeLegacy: "dx-training-studio-pane3-mode",
} as const;

export const EDITOR_FONT_SIZE_CHANGED_EVENT =
  "dx-training-studio-font-size-changed";
export const WORKSPACE_SETTINGS_CHANGED_EVENT =
  "dx-training-studio-settings-changed";

/** migration 対象: [旧キー, 新キー] */
export const LOCAL_STORAGE_MIGRATION_PAIRS: ReadonlyArray<
  readonly [string, string]
> = [
  [LEGACY_STORAGE_KEYS.settings, STORAGE_KEYS.settings],
  [LEGACY_STORAGE_KEYS.paneWidths, STORAGE_KEYS.paneWidths],
  [LEGACY_STORAGE_KEYS.agentChat, STORAGE_KEYS.agentChat],
  [LEGACY_STORAGE_KEYS.selection, STORAGE_KEYS.selection],
];
