"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_STACK,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import { PaneActionBar } from "@/components/workspace/PaneActionBar";
import { SaveButton } from "@/components/workspace/SaveButton";
import { TranslationNotice } from "@/components/workspace/translation/TranslationNotice";
import { TRANSLATE_LABEL } from "@/components/workspace/translation/translationLabels";
import {
  fetchMetaEn,
  saveMetaEn,
  translateMeta,
  NO_TRANSLATION_NOTICE,
  type TranslationNoticeState,
  type UnitLevel,
  type UnitNames,
} from "@/lib/translation/client";

/**
 * 階層ごとの英語ビュー項目（表示順・ラベル・原文キー）。
 * ⚠ 並びは日本語ビューに揃える（名前 → 説明 → キャッチ → 対象）。
 * author_en は別扱い（手編集のみ・翻訳の対象外）。
 */
const EN_FIELD_DEFS: Record<
  UnitLevel,
  Array<{ enKey: string; label: string; jaKey: string; multiline?: boolean }>
> = {
  root: [
    { enKey: "name_en", label: "Name", jaKey: "name" },
    { enKey: "description_en", label: "Description", jaKey: "description", multiline: true },
  ],
  series: [
    { enKey: "name_en", label: "Series name", jaKey: "name" },
    { enKey: "description_en", label: "Description", jaKey: "description", multiline: true },
    { enKey: "catch_en", label: "Catch", jaKey: "catch" },
  ],
  course: [
    { enKey: "name_en", label: "Course name", jaKey: "name" },
    { enKey: "description_en", label: "Description", jaKey: "description", multiline: true },
    { enKey: "catch_en", label: "Catch", jaKey: "catch" },
    { enKey: "target_en", label: "Target", jaKey: "target" },
  ],
  lesson: [
    { enKey: "name_en", label: "Lesson name", jaKey: "name" },
    { enKey: "description_en", label: "Description", jaKey: "description", multiline: true },
  ],
};

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

/** 原文の併記。⚠ 全フィールドで同じ形式に揃える（Author も含む） */
function SourceText({ value }: { value: string | undefined }) {
  return (
    <p className="text-xs text-muted-foreground">
      原文: {value?.trim() ? value : "（未設定）"}
    </p>
  );
}

/** 親（レッスンメタモーダル）が保存・翻訳を外から起動するための口 */
export type EnMetaControls = {
  save: () => Promise<void>;
  translate: () => void;
  translating: boolean;
  loading: boolean;
};

type Props = {
  level: UnitLevel;
  names: UnitNames;
  /** 本文上部の赤字1行。`hideActionBar` のときは親が描くので使われない */
  translationNotice?: TranslationNoticeState;
  /** レッスンのみ: author_en の手編集欄を出す。保存は onSaveAuthorEn が担う */
  authorEnEditable?: boolean;
  /** レッスンのみ: Author の原文（日本語の `author`）。API ではなく親が渡す */
  authorSourceText?: string;
  onSaveAuthorEn?: (authorEn: string) => void;
  /** 保存・翻訳適用の後に呼ぶ（Workspace が鮮度を再取得する） */
  onTranslationChanged?: () => void;
  /** ホーム統合用: フィールドとボタン行の間に差し込む追加セクション（changelog） */
  extraSection?: React.ReactNode;
  /**
   * ホーム統合用: メタ翻訳の後に続けて実行する追加翻訳（changelog 追訳）。
   * 戻り値は結果メッセージ。失敗はメタ側の結果を巻き込まず、個別のエラーとして出す
   */
  afterTranslate?: () => Promise<string | null>;
  /**
   * ホーム統合用: 保存に合流させる追加保存（changelog.en.md）。
   * ⚠ 呼ぶかどうかは実装側が dirty で決める——触っていない対象へ書かない。
   * メタ側の失敗で巻き込まないよう、両方投げてから結果を集める
   */
  afterSave?: () => Promise<void> | null;
  /**
   * モーダル用: 保存・翻訳のボタンを自前で描かず、操作だけ親へ渡す。
   * ⚠ 保存の入口が2つにならないよう、渡したら必ず親がボタンを出すこと
   */
  onControlsReady?: (controls: EnMetaControls) => void;
  /** モーダル用: ボタン列と赤字を描かない（親が配置を持つ） */
  hideActionBar?: boolean;
};

/**
 * 英語ビューの共通フォーム（studio-translation spec）。
 *
 * - 翻訳対象フィールドだけを、日本語原文の併記つきで編集する
 * - 「原文から翻訳」はフィールドを埋めるだけ（正本に書かない）
 * - 保存は専用経路（PUT /api/content/meta-en）——`_en` と `en_source_hash` 以外に触れない
 * - `en_source_hash` は翻訳ボタン経由の値だけを保存に添える（手入力の訳は鮮度不明のまま）
 * - 操作は本文右上の `PaneActionBar`（左=翻訳 / 右=保存）。モーダルでは親が持つ
 */
export function EnMetaSection({
  level,
  names,
  translationNotice,
  authorEnEditable = false,
  authorSourceText,
  onSaveAuthorEn,
  onTranslationChanged,
  extraSection,
  afterTranslate,
  afterSave,
  onControlsReady,
  hideActionBar = false,
}: Props) {
  const defs = EN_FIELD_DEFS[level];
  const [loading, setLoading] = useState(true);
  const [ja, setJa] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [authorEn, setAuthorEn] = useState("");
  /** 翻訳ボタン経由で得たハッシュ。手入力だけの保存では添えない */
  const [pendingHash, setPendingHash] = useState<string | undefined>(undefined);
  const [translating, setTranslating] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMetaEn(level, names)
      .then((data) => {
        if (cancelled) return;
        setJa(data.ja as Record<string, string>);
        setValues(data.en);
        if (data.author_en !== undefined) setAuthorEn(data.author_en);
      })
      .catch((err: unknown) => {
        if (!cancelled) setErrorText(`読み込みエラー: ${String(err)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // 対象ユニットが変わったときだけ読み直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, names.series, names.course, names.lesson]);

  const handleTranslate = () => {
    setTranslating(true);
    setErrorText(null);
    setStatusText(null);
    void (async () => {
      let metaMessage: string;
      try {
        const result = await translateMeta(level, names);
        setValues((prev) => ({ ...prev, ...result.fields }));
        setPendingHash(result.en_source_hash);
        metaMessage = "メタを翻訳しました。内容を確認して保存してください";
      } catch (err) {
        setErrorText(`翻訳エラー: ${String(err)}`);
        setTranslating(false);
        return;
      }
      // 追加翻訳（changelog 追訳）はメタの結果を巻き込まない——エラーは個別に出す
      if (afterTranslate) {
        try {
          const extraMessage = await afterTranslate();
          setStatusText(
            extraMessage ? `${metaMessage}／${extraMessage}` : metaMessage,
          );
        } catch (err) {
          setStatusText(metaMessage);
          setErrorText(`変更履歴の追訳エラー: ${String(err)}`);
        }
      } else {
        setStatusText(metaMessage);
      }
      setTranslating(false);
    })();
  };

  /**
   * 保存。⚠ `author_en` は別経路（save-lesson-meta）なので、
   * `_en` の保存が成功してからでないと呼ばない——片方だけ書かれた状態を作らない。
   *
   * ホームでは `afterSave`（changelog.en.md）が合流する。こちらは別ファイルなので
   * 順序依存が無く、メタの失敗で止めない——両方投げてから結果を集める。
   */
  const handleSave = async (): Promise<void> => {
    setErrorText(null);
    setStatusText(null);
    const fields: Record<string, string> = {};
    for (const def of defs) fields[def.enKey] = values[def.enKey] ?? "";
    const metaJob = saveMetaEn({ level, names, fields, enSourceHash: pendingHash })
      .then(() => {
        setPendingHash(undefined);
        if (authorEnEditable) onSaveAuthorEn?.(authorEn);
      })
      .catch((err: unknown) => {
        setErrorText(`保存エラー: ${String(err)}`);
        throw err;
      });
    // afterSave が null を返したら「書くものが無い」＝呼ばない（dirty 判定は実装側）
    const extraJob = afterSave?.() ?? null;
    const results = await Promise.allSettled(
      extraJob ? [metaJob, extraJob] : [metaJob],
    );
    onTranslationChanged?.();
    if (results.some((r) => r.status === "rejected")) {
      throw new Error("save failed");
    }
  };

  useEffect(() => {
    onControlsReady?.({
      save: handleSave,
      translate: handleTranslate,
      translating,
      loading,
    });
    // 親へ渡す口は状態が変わるたびに更新する（ボタンの disabled を追従させる）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translating, loading, values, authorEn, pendingHash]);

  const translateButton = (
    <Button
      size="sm"
      variant="outline"
      onClick={handleTranslate}
      disabled={loading || translating}
    >
      {translating ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="size-4" aria-hidden />
      )}
      {TRANSLATE_LABEL}
    </Button>
  );

  return (
    <div className={META_DIALOG_STACK}>
      {hideActionBar ? null : (
        <PaneActionBar
          aiSlot={translateButton}
          saveSlot={<SaveButton onSave={handleSave} disabled={loading} />}
        />
      )}
      {hideActionBar ? null : (
        <TranslationNotice state={translationNotice ?? NO_TRANSLATION_NOTICE} />
      )}
      {defs.map((def) => (
        <MetaDialogField key={def.enKey}>
          <Label htmlFor={`en-meta-${def.enKey}`}>{def.label}</Label>
          {/* 日本語原文の併記（読取専用）。後編集の拠り所 */}
          <SourceText value={ja[def.jaKey]} />
          {def.multiline ? (
            <textarea
              id={`en-meta-${def.enKey}`}
              value={values[def.enKey] ?? ""}
              disabled={loading}
              rows={3}
              className={TEXTAREA_CLASS}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [def.enKey]: e.target.value }))
              }
            />
          ) : (
            <Input
              id={`en-meta-${def.enKey}`}
              value={values[def.enKey] ?? ""}
              disabled={loading}
              className={META_DIALOG_CONTROL}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [def.enKey]: e.target.value }))
              }
            />
          )}
        </MetaDialogField>
      ))}
      {authorEnEditable ? (
        <MetaDialogField>
          <Label htmlFor="en-meta-author-en">Author</Label>
          {/* ⚠ 翻訳ボタンは author を触らない（人名のローマ字は本人の流儀）。
              併記の形式は他フィールドと揃える */}
          <SourceText value={authorSourceText} />
          {/* 挙動の明示。これが無いと「翻訳を押したのに Author が埋まらない」を
              故障と誤読される（studio-translation spec） */}
          <p className="text-xs text-muted-foreground">
            著者名は自動翻訳出来ません
          </p>
          <Input
            id="en-meta-author-en"
            value={authorEn}
            disabled={loading}
            className={META_DIALOG_CONTROL}
            onChange={(e) => setAuthorEn(e.target.value)}
          />
        </MetaDialogField>
      ) : null}
      {extraSection}
      {statusText ? (
        <p className="text-xs text-muted-foreground">{statusText}</p>
      ) : null}
      {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}
    </div>
  );
}
