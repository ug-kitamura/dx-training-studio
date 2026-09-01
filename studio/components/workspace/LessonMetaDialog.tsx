"use client";

import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  META_DIALOG_FORM,
  META_HEADING_TEXT,
} from "@/components/workspace/metaDialogLayout";
import {
  LessonMetaPanel,
  draftToMetaPatch,
  lessonToMetaDraft,
  type LessonMetaDraft,
} from "@/components/workspace/LessonMetaPanel";
import type { LessonMetaFields } from "@/lib/lesson-meta";
import type { Lesson } from "@/lib/schema";
import {
  EnMetaSection,
  type EnMetaControls,
} from "@/components/workspace/translation/EnMetaSection";
import { TranslationNotice } from "@/components/workspace/translation/TranslationNotice";
import { TRANSLATE_LABEL } from "@/components/workspace/translation/translationLabels";
import {
  NO_TRANSLATION_NOTICE,
  type TranslationNoticeState,
} from "@/lib/translation/client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: Lesson | undefined;
  onSave: (lessonId: string, meta: Partial<LessonMetaFields>) => void;
  tagSuggestions?: readonly string[];
  /**
   * レッスンの編集言語（ペイン2 ヘッダーの切替に連動）。
   * en では英語フィールドの編集になる（studio-translation spec）
   */
  language?: "ja" | "en";
  /** 英語ビューの鮮度。`stale` のとき赤字1行を出す */
  /** レッスン**メタ**の赤字1行。本文の状態を混ぜない（studio-translation spec） */
  translationNotice?: TranslationNoticeState;
  /** 英語ビューでの保存・翻訳適用の後に呼ぶ（鮮度の再取得） */
  onTranslationChanged?: () => void;
};

export function LessonMetaDialog({
  open,
  onOpenChange,
  lesson,
  onSave,
  tagSuggestions = [],
  language = "ja",
  translationNotice,
  onTranslationChanged,
}: Props) {
  const [draft, setDraft] = useState<LessonMetaDraft | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const flushTagsRef = useRef<(() => string[]) | null>(null);
  /** 英語モーダル: 保存・翻訳をフッター／タイトル行から起動するための口 */
  const [enControls, setEnControls] = useState<EnMetaControls | null>(null);

  // 開いたとき（および対象レッスンが差し替わったとき）に下書きを初期化する。
  // Effect+setState だと 1 render 遅れるため、「前回値を state に持ち render 中に
  // 比較する」React 公式パターンで書く（リセット条件は従来と同一）
  const [prevSync, setPrevSync] = useState<{
    open: boolean;
    lesson: typeof lesson;
  }>({ open, lesson });
  if (prevSync.open !== open || prevSync.lesson !== lesson) {
    setPrevSync({ open, lesson });
    if (open && lesson) {
      setDraft(lessonToMetaDraft(lesson));
      setTagError(null);
      setSlugError(null);
    }
  }

  const handleSave = () => {
    if (!lesson || !draft) return;
    const tags = flushTagsRef.current?.() ?? draft.tags;
    const {
      patch,
      tagError: err,
      slugError: slugErr,
    } = draftToMetaPatch({ ...draft, tags }, lesson);
    if (err || slugErr) {
      setTagError(err);
      setSlugError(slugErr);
      return;
    }
    onSave(lesson.id, patch);
    onOpenChange(false);
  };

  /**
   * 英語モーダルの保存。`_en` の保存が成功したときだけ閉じる——
   * 失敗したまま閉じると入力が消える（EnMetaSection 側でエラーが出る）。
   * `author_en` は EnMetaSection が保存成功後に onSaveAuthorEn 経由で確定する。
   */
  const handleSaveEn = () => {
    if (!enControls) return;
    void enControls.save().then(
      () => onOpenChange(false),
      () => {
        // エラー表示は EnMetaSection が持つ。開いたままにする
      },
    );
  };

  if (!lesson || !draft) return null;

  if (language === "en") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          {/* ⚠ 右上の閉じる（×）は absolute top-3 right-3。翻訳ボタンは
              その左隣に来るよう pr-8 で席を空ける */}
          <DialogHeader className="flex-row items-center justify-between gap-2 pr-8">
            <DialogTitle className={META_HEADING_TEXT}>
              レッスンメタを編集（英語）
            </DialogTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => enControls?.translate()}
              disabled={!enControls || enControls.loading || enControls.translating}
            >
              {enControls?.translating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {TRANSLATE_LABEL}
            </Button>
          </DialogHeader>
          <TranslationNotice state={translationNotice ?? NO_TRANSLATION_NOTICE} />
          <EnMetaSection
            level="lesson"
            names={{
              series: lesson.series,
              course: lesson.course,
              lesson: lesson.lesson,
            }}
            authorEnEditable
            authorSourceText={lesson.author}
            onSaveAuthorEn={(authorEn) =>
              onSave(lesson.id, { author_en: authorEn })
            }
            onTranslationChanged={onTranslationChanged}
            onControlsReady={setEnControls}
            hideActionBar
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleSaveEn}
              disabled={!enControls || enControls.loading}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pr-8">
          {/* 体裁はメタビューの見出しと共有する（META_HEADING_TEXT）。
              ⚠ クラスをここに書き写さないこと——片方だけ動く事故になる */}
          <DialogTitle className={META_HEADING_TEXT}>
            レッスンメタを編集
          </DialogTitle>
        </DialogHeader>
        <LessonMetaPanel
          draft={draft}
          onDraftChange={(next) => {
            setDraft(next);
            if (tagError) setTagError(null);
            if (slugError) setSlugError(null);
          }}
          tagError={tagError}
          slugError={slugError}
          tagSuggestions={tagSuggestions}
          onFlushTagsReady={(flush) => {
            flushTagsRef.current = flush;
          }}
          className={META_DIALOG_FORM}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
