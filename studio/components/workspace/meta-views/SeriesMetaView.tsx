"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetaViewShell } from "@/components/workspace/meta-views/MetaViewShell";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_STACK,
  MetaDialogField,
  metaViewHeading,
  paneKindLabel,
} from "@/components/workspace/metaDialogLayout";
import { SLUG_PATTERN } from "@/lib/schema";
import type { Series } from "@/lib/schema";
import {
  EnMetaSection,
  type EnMetaControls,
} from "@/components/workspace/translation/EnMetaSection";
import { EnMetaActionBar } from "@/components/workspace/translation/EnMetaActionBar";
import { TranslationNotice } from "@/components/workspace/translation/TranslationNotice";
import { seriesDisplayName, type EditLanguage } from "@/lib/display-name";
import { PaneActionBar } from "@/components/workspace/PaneActionBar";
import { SaveButton } from "@/components/workspace/SaveButton";
import type { TranslationNoticeState } from "@/lib/translation/client";

type Props = {
  seriesItem: Series;
  onRenameSeries: (seriesId: string, name: string) => void;
  onSaveMeta: (
    seriesId: string,
    meta: { slug?: string; catch?: string; description?: string },
  ) => void;
  editLanguage: EditLanguage;
  translationNotice: TranslationNoticeState;
  onTranslationChanged?: () => void;
};

/** シリーズ選択時のペイン2: シリーズメタの編集ビュー */
export function SeriesMetaView({
  seriesItem,
  onRenameSeries,
  onSaveMeta,
  editLanguage,
  translationNotice,
  onTranslationChanged,
}: Props) {
  const [name, setName] = useState(seriesItem.name);
  const [slug, setSlug] = useState(seriesItem.slug ?? "");
  const [catchCopy, setCatchCopy] = useState(seriesItem.catch ?? "");
  const [description, setDescription] = useState(seriesItem.description ?? "");
  const [slugError, setSlugError] = useState(false);
  /** 英語ビューのボタン列を見出し行へ持ち上げるための操作口 */
  const [enControls, setEnControls] = useState<EnMetaControls | null>(null);

  const handleSave = () => {
    const trimmedSlug = slug.trim();
    if (trimmedSlug && !SLUG_PATTERN.test(trimmedSlug)) {
      setSlugError(true);
      return;
    }
    setSlugError(false);
    // メタは旧シリーズ名で解決するため、リネームより先に保存する
    onSaveMeta(seriesItem.id, {
      slug: trimmedSlug,
      catch: catchCopy,
      description,
    });
    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== seriesItem.name) {
      onRenameSeries(seriesItem.id, trimmedName);
    }
  };

  if (editLanguage === "en") {
    return (
      <MetaViewShell
        title={seriesDisplayName(seriesItem, editLanguage)}
        kindLabel={paneKindLabel("series", editLanguage)}
        heading={metaViewHeading("series", editLanguage)}
        actionBar={<EnMetaActionBar controls={enControls} />}
      >
        {/* ボタン列は見出し行（親）が持つ。赤字1行もここで出す */}
        <TranslationNotice state={translationNotice} />
        <EnMetaSection
          level="series"
          names={{ series: seriesItem.name }}
          translationNotice={translationNotice}
          onTranslationChanged={onTranslationChanged}
          onControlsReady={setEnControls}
          hideActionBar
        />
      </MetaViewShell>
    );
  }

  return (
    <MetaViewShell
      title={seriesDisplayName(seriesItem, editLanguage)}
      kindLabel={paneKindLabel("series", editLanguage)}
      heading={metaViewHeading("series", editLanguage)}
      actionBar={<PaneActionBar saveSlot={<SaveButton onSave={handleSave} />} />}
    >
      <div className={META_DIALOG_STACK}>
        <MetaDialogField>
          <Label htmlFor="series-meta-name">シリーズ名</Label>
          <Input
            id="series-meta-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={META_DIALOG_CONTROL}
          />
        </MetaDialogField>
        <MetaDialogField>
          <Label htmlFor="series-meta-description">説明</Label>
          <textarea
            id="series-meta-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
            placeholder="シリーズの説明（公開サイトのシリーズトップに表示）"
          />
        </MetaDialogField>
        <MetaDialogField>
          <Label htmlFor="series-meta-catch">キャッチ</Label>
          <Input
            id="series-meta-catch"
            value={catchCopy}
            onChange={(e) => setCatchCopy(e.target.value)}
            placeholder="例: ここから旅がはじまる"
            className={META_DIALOG_CONTROL}
          />
        </MetaDialogField>
        <MetaDialogField>
          <Label htmlFor="series-meta-slug">スラッグ（公開 URL 用）</Label>
          <Input
            id="series-meta-slug"
            value={slug}
            onChange={(e) => {
              setSlugError(false);
              setSlug(e.target.value);
            }}
            placeholder="例: git-basics"
            className={META_DIALOG_CONTROL}
          />
          {slugError ? (
            <p className="text-xs text-destructive">
              slug は小文字英数とハイフンのみで構成してください
            </p>
          ) : null}
        </MetaDialogField>
      </div>
    </MetaViewShell>
  );
}
