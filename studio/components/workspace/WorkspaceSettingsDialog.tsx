"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_GRID,
  META_DIALOG_STACK,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import {
  PANE_WIDTH_DEFAULTS,
  PANE_WIDTH_LIMITS,
  PANE_WIDTH_STEP,
  snapPaneWidth,
  snapPaneWidths,
  type WorkspacePaneWidths,
} from "@/components/workspace/pane-layout";
import {
  EDITOR_FONT_SIZE_DEFAULT,
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_MIN,
  applyEditorFontSizePx,
  applyThemeToDocument,
  clampEditorFontSizePx,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
  type AiModelSlug,
  type ThemeMode,
  type ImageStorageMode,
  type ContextStorageMode,
  type WorkspaceSettings,
} from "@/lib/workspace-settings";
import {
  AI_MODEL_OPTIONS,
  UNSUPPORTED_MODEL_ERROR,
  isUnsupportedAiModel,
} from "@/lib/ai-models";
import { cn } from "@/lib/utils";
import { checkImageStorageConnection } from "@/lib/image-api-client";
import { STORAGE_CONNECTION_ERROR_MESSAGE } from "@/lib/image-storage/types";
import {
  checkContextDatabaseConnection,
  CONTEXT_DATABASE_CONNECTION_ERROR_MESSAGE,
} from "@/lib/context-api-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPaneWidths: WorkspacePaneWidths;
  onApplyPaneWidths: (widths: WorkspacePaneWidths) => void;
};

function ApiKeyField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <MetaDialogField>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={visible ? "マスク表示" : "表示"}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={`${label}をリセット`}
          onClick={() => onChange("")}
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </MetaDialogField>
  );
}

type SettingsFormProps = Omit<Props, "open"> & {
  onSaved: () => void;
};

function SettingsForm({
  onOpenChange,
  currentPaneWidths,
  onApplyPaneWidths,
  onSaved,
}: SettingsFormProps) {
  const initial = loadWorkspaceSettings();
  const [draft, setDraft] = useState<WorkspaceSettings>(initial);
  const [apiKeyInput, setApiKeyInput] = useState(initial.aiApiKey ?? "");
  const [pixabayKeyInput, setPixabayKeyInput] = useState(initial.pixabayApiKey ?? "");
  const [paneDraft, setPaneDraft] = useState<WorkspacePaneWidths>(() =>
    snapPaneWidths(currentPaneWidths),
  );
  const [fontDraft, setFontDraft] = useState(() =>
    clampEditorFontSizePx(initial.editorFontSizePx),
  );
  const [modelError, setModelError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [contextStorageError, setContextStorageError] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (isUnsupportedAiModel(draft.aiModel)) {
      setModelError(UNSUPPORTED_MODEL_ERROR);
      return;
    }
    setModelError(null);

    if (draft.imageStorage === "storage") {
      setSaving(true);
      try {
        const connected = await checkImageStorageConnection();
        if (!connected) {
          setStorageError(STORAGE_CONNECTION_ERROR_MESSAGE);
          return;
        }
      } finally {
        setSaving(false);
      }
    }
    setStorageError(null);

    if (draft.contextStorage === "database") {
      setSaving(true);
      try {
        const connected = await checkContextDatabaseConnection();
        if (!connected) {
          setContextStorageError(CONTEXT_DATABASE_CONNECTION_ERROR_MESSAGE);
          return;
        }
      } finally {
        setSaving(false);
      }
    }
    setContextStorageError(null);

    const next: WorkspaceSettings = {
      ...draft,
      aiApiKey: apiKeyInput.trim() || null,
      pixabayApiKey: pixabayKeyInput.trim() || null,
      editorFontSizePx: clampEditorFontSizePx(fontDraft),
      paneDefaults: snapPaneWidths(paneDraft),
    };
    saveWorkspaceSettings(next);
    applyThemeToDocument(next.theme);
    onSaved();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const paneLabels = {
    tree: "ツリー",
    pane4: "Pane 4",
  } as const;

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>設定</DialogTitle>
      </DialogHeader>
      <div className={META_DIALOG_STACK}>
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">テーマ</h3>
          <MetaDialogField>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["light", "ライト"],
                  ["dark", "ダーク"],
                  ["pink", "ピンク"],
                  ["system", "システム"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={draft.theme === value ? "default" : "outline"}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, theme: value as ThemeMode }))
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
          </MetaDialogField>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">フォントサイズ</h3>
          <MetaDialogField>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={EDITOR_FONT_SIZE_MIN}
                max={EDITOR_FONT_SIZE_MAX}
                value={fontDraft}
                className="min-w-0 flex-1"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  const next = clampEditorFontSizePx(
                    Number.isFinite(n) ? n : fontDraft,
                  );
                  setFontDraft(next);
                  applyEditorFontSizePx(next);
                }}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="shrink-0"
                aria-label="フォントサイズを既定値に戻す"
                onClick={() => {
                  const next = applyEditorFontSizePx(EDITOR_FONT_SIZE_DEFAULT);
                  setFontDraft(next);
                }}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </div>
          </MetaDialogField>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">横幅</h3>
          <div className="flex items-end gap-1.5">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              {(["tree", "pane4"] as const).map((pane) => {
                const limits = PANE_WIDTH_LIMITS[pane];
                return (
                  <MetaDialogField key={pane}>
                    <Label className="text-xs text-muted-foreground">
                      {paneLabels[pane]}
                    </Label>
                    <Input
                      type="number"
                      min={limits.min}
                      max={limits.max}
                      step={PANE_WIDTH_STEP}
                      value={paneDraft[pane]}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        const next = snapPaneWidths({
                          ...paneDraft,
                          [pane]: snapPaneWidth(
                            pane,
                            Number.isFinite(n) ? n : limits.min,
                          ),
                        });
                        setPaneDraft(next);
                        onApplyPaneWidths(next);
                      }}
                    />
                  </MetaDialogField>
                );
              })}
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="mb-0.5 shrink-0"
              aria-label="横幅を既定値に戻す"
              onClick={() => {
                const next = snapPaneWidths({ ...PANE_WIDTH_DEFAULTS });
                setPaneDraft(next);
                onApplyPaneWidths(next);
              }}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">AI モデル</h3>
          <MetaDialogField>
            <Select
              items={AI_MODEL_OPTIONS.map(({ slug, label }) => ({
                value: slug,
                label,
              }))}
              value={draft.aiModel}
              onValueChange={(v) => {
                if (!v) return;
                setDraft((prev) => ({ ...prev, aiModel: v as AiModelSlug }));
                setModelError(null);
              }}
            >
              <SelectTrigger className={cn(META_DIALOG_CONTROL, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODEL_OPTIONS.map(({ slug, label }) => (
                  <SelectItem key={slug} value={slug}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {modelError ? (
              <p className="text-xs text-destructive">{modelError}</p>
            ) : null}
          </MetaDialogField>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">ストレージ</h3>
          <div className={META_DIALOG_GRID}>
            <MetaDialogField>
              <Label className="text-xs text-muted-foreground">画像の管理</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["local", "ローカル"],
                    ["storage", "ストレージ"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={draft.imageStorage === value ? "default" : "outline"}
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        imageStorage: value as ImageStorageMode,
                      }));
                      if (value === "local") setStorageError(null);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {storageError ? (
                <p className="text-xs text-destructive">{storageError}</p>
              ) : null}
            </MetaDialogField>
            <MetaDialogField>
              <Label className="text-xs text-muted-foreground">
                社内コンテキストの管理
              </Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["local", "ローカル"],
                    ["database", "データベース"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={draft.contextStorage === value ? "default" : "outline"}
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        contextStorage: value as ContextStorageMode,
                      }));
                      if (value === "local") setContextStorageError(null);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {contextStorageError ? (
                <p className="text-xs text-destructive">{contextStorageError}</p>
              ) : null}
            </MetaDialogField>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">API</h3>
          <ApiKeyField
            id="settings-ai-api-key"
            label="AI API キー"
            value={apiKeyInput}
            onChange={setApiKeyInput}
            placeholder="AI API key"
            hint="未入力時は環境変数 AI_API_KEY を取得"
          />
          <ApiKeyField
            id="settings-pixabay-api-key"
            label="Pixabay API キー"
            value={pixabayKeyInput}
            onChange={setPixabayKeyInput}
            placeholder="Pixabay API key"
            hint="未入力時は環境変数 PIXABAY_API_KEY を取得"
          />
        </section>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={handleCancel}>
          キャンセル
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "確認中..." : "保存"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
  currentPaneWidths,
  onApplyPaneWidths,
}: Props) {
  const paneWidthsAtOpenRef = useRef<WorkspacePaneWidths>(currentPaneWidths);
  const fontSizeAtOpenRef = useRef(EDITOR_FONT_SIZE_DEFAULT);
  const savedRef = useRef(false);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      paneWidthsAtOpenRef.current = { ...currentPaneWidths };
      fontSizeAtOpenRef.current = clampEditorFontSizePx(
        loadWorkspaceSettings().editorFontSizePx,
      );
      savedRef.current = false;
    }
    prevOpenRef.current = open;
  }, [open, currentPaneWidths]);

  const handleOpenChange = (next: boolean) => {
    if (!next && !savedRef.current) {
      onApplyPaneWidths(paneWidthsAtOpenRef.current);
      applyEditorFontSizePx(fontSizeAtOpenRef.current);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {open ? (
        <SettingsForm
          onOpenChange={handleOpenChange}
          currentPaneWidths={currentPaneWidths}
          onApplyPaneWidths={onApplyPaneWidths}
          onSaved={() => {
            savedRef.current = true;
          }}
        />
      ) : null}
    </Dialog>
  );
}
