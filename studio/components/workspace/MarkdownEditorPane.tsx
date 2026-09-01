"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import { GitCompare, Code, Eye, Edit3, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useLessonEnBody } from "@/components/workspace/hooks/use-lesson-en-body";
import { lessonDisplayName, type EditLanguage } from "@/lib/display-name";
import { TranslationNotice } from "@/components/workspace/translation/TranslationNotice";
import { TRANSLATE_LABEL } from "@/components/workspace/translation/translationLabels";
import type { TranslationNoticeState } from "@/lib/translation/client";
import { cn } from "@/lib/utils";
import type { LessonMetaFields } from "@/lib/lesson-meta";
import { stripHtmlComments } from "@/lib/html-comment-at-cursor";
import { LessonMetaDialog } from "@/components/workspace/LessonMetaDialog";
import { LessonPreviewMetaRow } from "@/components/workspace/LessonPreviewMetaRow";
import { LessonDiffView } from "@/components/workspace/LessonDiffView";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import { PaneKindBadge, paneKindLabel } from "@/components/workspace/metaDialogLayout";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import { PaneActionBar } from "@/components/workspace/PaneActionBar";
import {
  PaneSegmentControl,
  type PaneSegmentOption,
} from "@/components/workspace/PaneSegmentControl";
import type { LessonContentEditorHandle } from "@/components/workspace/LessonContentEditor";
import type { Course, Lesson, Series } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/Workspace";
import {
  createLessonPreviewMarkdownComponents,
  buildLessonPreviewRehypePlugins,
  lessonPreviewRemarkPlugins,
} from "@/lib/lesson-preview-markdown";
import "@/styles/hljs/lesson-preview-hljs.css";
import {
  pane2ScrollKey,
  resolvePane2ScrollTop,
  setPane2ScrollTop,
} from "@/lib/pane2-scroll-memory";

const LessonContentEditor = dynamic(
  () =>
    import("@/components/workspace/LessonContentEditor").then(
      (m) => m.LessonContentEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        エディタを読み込み中...
      </div>
    ),
  },
);

type Props = {
  lesson: Lesson | undefined;
  series: Series[];
  course: Course | undefined;
  mode: Pane3Mode;
  onModeChange: (mode: Pane3Mode) => void;
  onUpdateContent: (lessonId: string, content: string) => void;
  onUpdateLessonMeta: (
    lessonId: string,
    meta: Partial<LessonMetaFields>,
  ) => void;
  onRegisterInsertCallback: (cb: (markdown: string) => void) => void;
  onEditorCursorChange?: (offset: number) => void;
  tagSuggestions?: readonly string[];
  availableImagePaths?: ReadonlySet<string> | null;
  imageAssetsRevision?: number;
  /** ペイン1 の中身検索の語。編集ビューとプレビューの一致箇所を塗る */
  searchHighlightQuery?: string;
  /** レッスンの編集言語（本文とメタダイアログが連動する1スイッチ。切替は GlobalHeader だけ） */
  editLanguage: EditLanguage;
  /**
   * レッスン**本文**の赤字1行（ペイン2 ヘッダーに出す）。
   * ⚠ メタの状態を混ぜない——本文の話をしたい場所にメタの空欄が漏れる
   */
  bodyNotice: TranslationNoticeState;
  /** レッスン**メタ**の赤字1行。レッスンメタ編集モーダルへそのまま渡す */
  metaNotice: TranslationNoticeState;
  /** 英語側の保存・翻訳適用の後に呼ぶ（鮮度の再取得） */
  onTranslationChanged?: () => void;
  /**
   * 英語版本文の読み書き。状態の持ち主は `Workspace`——「いま編集している本文」は
   * カーソル同期・Agent の反映でも要るため、ここでは受け取るだけにする
   */
  enBody: ReturnType<typeof useLessonEnBody>;
};

const MODE_TABS: ReadonlyArray<PaneSegmentOption<Pane3Mode>> = [
  { value: "raw", label: "編集", icon: <Code className="h-3 w-3" /> },
  { value: "inline", label: "プレビュー", icon: <Eye className="h-3 w-3" /> },
  {
    value: "diff",
    label: "差分",
    icon: <GitCompare className="h-3 w-3" />,
  },
];

const LESSON_PREVIEW_CLASS = "lesson-preview";

/**
 * 英語本文がまだ読めていないときの代替表示。編集・プレビューの両ビューで使う
 * ——片方だけ空白になると「壊れた」ように見える。
 */
function EnBodyPlaceholder({
  state,
}: {
  state: { status: string; message?: string };
}) {
  if (state.status === "error") {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-destructive">
        {state.message}
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      英語版を読み込み中...
    </div>
  );
}

type DiffState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; diff: string }
  | { status: "error"; message: string };

export function MarkdownEditorPane({
  lesson,
  course,
  mode,
  onModeChange,
  onUpdateContent,
  onUpdateLessonMeta,
  onRegisterInsertCallback,
  onEditorCursorChange,
  tagSuggestions = [],
  availableImagePaths = null,
  imageAssetsRevision = 0,
  searchHighlightQuery,
  editLanguage,
  bodyNotice,
  metaNotice,
  onTranslationChanged,
  enBody,
}: Props) {
  const editorRef = useRef<LessonContentEditorHandle>(null);
  const paneScrollRef = useRef<HTMLElement | null>(null);
  const lastCursorOffsetRef = useRef(0);
  const [diffState, setDiffState] = useState<DiffState>({ status: "idle" });
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);

  const isEnglish = editLanguage === "en";

  /**
   * プレビューに流す本文。英語モードは `contents.en.md`（API 境界で原文ハッシュ行が
   * 剥がれた状態）を使う。前処理は日本語と共通——訳文だけ別の描画規則にしない。
   */
  const previewBody = useMemo(() => {
    if (!lesson) return "";
    if (isEnglish) {
      return enBody.state.status === "ready"
        ? stripHtmlComments(enBody.state.body)
        : "";
    }
    return stripHtmlComments(lesson.content);
  }, [lesson, isEnglish, enBody.state]);

  const previewMarkdownComponents = useMemo(
    () =>
      createLessonPreviewMarkdownComponents({
        availableImagePaths,
        imageAssetsRevision,
      }),
    [availableImagePaths, imageAssetsRevision],
  );

  const previewRehypePlugins = useMemo(
    () => buildLessonPreviewRehypePlugins(searchHighlightQuery),
    [searchHighlightQuery],
  );

  const editContent = lesson?.content ?? "";

  const handleLocalCursorChange = useCallback(
    (offset: number) => {
      lastCursorOffsetRef.current = offset;
      onEditorCursorChange?.(offset);
    },
    [onEditorCursorChange],
  );

  const insertAtCursor = useCallback(
    (markdown: string) => {
      if (!markdown) return;
      editorRef.current?.insertAtCursor(markdown);
    },
    [],
  );

  useEffect(() => {
    onRegisterInsertCallback(insertAtCursor);
  }, [onRegisterInsertCallback, insertAtCursor]);

  useEffect(() => {
    lastCursorOffsetRef.current = 0;
  }, [lesson?.id]);

  // スクロール位置は (レッスン, 編集言語, ビュー) ごとに覚える。⚠ 日本語ビューで
  // 位置が残るのは「本文が同期描画されてスクロール要素が生き残る」偶然に過ぎず、
  // 本文を fetch する英語ビューでは 0 に潰れていた。両言語ともこの経路を通す。
  const scrollKey = lesson
    ? pane2ScrollKey(lesson.id, editLanguage, mode)
    : null;
  // 記録用。scroll イベントが飛ぶのは effect が走ったあとなので、ここは effect で同期する
  const scrollKeyRef = useRef<string | null>(null);
  useEffect(() => {
    scrollKeyRef.current = scrollKey;
  }, [scrollKey]);

  // 要素の差し替え（ビュー切替・エディタの再マウント）ごとに listener を張り替える。
  // 記録は現在のキーへ書くだけなので throttle は要らない
  const detachScrollRef = useRef<(() => void) | null>(null);
  const attachScrollTarget = useCallback((element: HTMLElement | null) => {
    detachScrollRef.current?.();
    detachScrollRef.current = null;
    paneScrollRef.current = element;
    if (!element) return;
    const onScroll = () => {
      const key = scrollKeyRef.current;
      if (key) setPane2ScrollTop(key, element.scrollTop);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    detachScrollRef.current = () =>
      element.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => () => detachScrollRef.current?.(), []);

  /**
   * 本文が描画されたあとに呼ぶ。⚠ rAF や `scrollIntoView` を使わない——
   * ペインが非表示のとき rAF が発火せず、復元だけが静かに効かなくなる。
   */
  const restoreScroll = useCallback((key: string | null) => {
    const element = paneScrollRef.current;
    if (!element || !key) return;
    element.scrollTop = resolvePane2ScrollTop(key);
  }, []);

  // CodeMirror のスクロール要素を受け取る口。⚠ **編集ビューのときだけ拾う**——
  // エディタは他のビューでも `hidden` で残り続けるので、無条件に拾うと
  // プレビュー・差分の対象を上書きしてしまう（実機で踏んだ）。
  // ⚠ ref コールバックは effect より先に走るので、キーは ref からではなく
  // このレンダーの値を渡す（ref はまだ前のキーのまま）
  const handleScrollElementReady = useCallback(
    (element: HTMLElement | null) => {
      if (mode !== "raw") return;
      attachScrollTarget(element);
      if (element) restoreScroll(scrollKey);
    },
    [mode, attachScrollTarget, restoreScroll, scrollKey],
  );

  // 編集ビューのスクロール要素は CodeMirror の中にあり ref で受け取れないので、
  // ここで拾う。⚠ `raw` 以外で null を入れないこと——プレビュー・差分の要素は
  // ref コールバック（`attachScrollTarget`）が commit 中に入れており、
  // その後に走るこの effect で null にすると毎回打ち消してしまう。
  // それらの解除は要素のアンマウント時に ref コールバックが null で呼ばれて起きる
  useEffect(() => {
    if (mode !== "raw") return;
    const element = editorRef.current?.getScrollElement() ?? null;
    attachScrollTarget(element);
    if (element) restoreScroll(scrollKey);
  }, [mode, scrollKey, attachScrollTarget, restoreScroll]);

  // 本文が後から届くビュー（英語プレビュー・差分）と、レッスンを切り替えたときは、
  // スクロール要素そのものは同じなので ref コールバックが再び呼ばれない。
  // 中身が揃った時点で明示的に復元する
  useEffect(() => {
    if (mode !== "inline") return;
    if (isEnglish && enBody.state.status !== "ready") return;
    restoreScroll(scrollKey);
  }, [mode, isEnglish, enBody.state.status, scrollKey, restoreScroll]);

  useEffect(() => {
    if (mode !== "diff" || diffState.status !== "ready") return;
    restoreScroll(scrollKey);
  }, [mode, diffState.status, scrollKey, restoreScroll]);

  // effect が lesson オブジェクト全体を掴むと exhaustive-deps がオブジェクト依存を
  // 要求してしまうため、参照はプリミティブに絞る（content は再取得の契機として
  // 依存にだけ入れる）
  const diffLessonSeries = lesson?.series ?? null;
  const diffLessonCourse = lesson?.course ?? null;
  const diffLessonName = lesson?.lesson ?? null;

  useEffect(() => {
    if (
      mode !== "diff" ||
      !diffLessonSeries ||
      !diffLessonCourse ||
      !diffLessonName
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 差分取得ライフサイクルを持つ effect の「対象外」側。取得中の結果が後から届いても idle に戻す
      setDiffState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setDiffState({ status: "loading" });

    fetch("/api/lesson-diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        series: diffLessonSeries,
        course: diffLessonCourse,
        lesson: diffLessonName,
        // 英語ビューでは訳文（contents.en.md）の差分を出す
        language: editLanguage,
      }),
    })
      .then(async (response) => {
        const data: { diff?: string; error?: string } = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "差分の取得に失敗しました");
        }
        setDiffState({ status: "ready", diff: data.diff ?? "" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setDiffState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "差分の取得に失敗しました",
        });
      });

    return () => controller.abort();
  }, [
    mode,
    // 言語を切り替えたら対象ファイルが変わるので取り直す
    editLanguage,
    // 本文が変わったら差分を取り直す（effect 本体では参照しない）
    lesson?.id,
    lesson?.content,
    diffLessonSeries,
    diffLessonCourse,
    diffLessonName,
  ]);

  // フォーカスは「下があれば降りる」規則なので、lesson が無いのは
  // 選び忘れではなくフォーカス階層より下が空の場合だけ
  if (!lesson) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        {course
          ? "このコースにはまだレッスンがありません"
          : "このシリーズにはまだコースがありません"}
      </div>
    );
  }

  return (
    <PaneWheelRoot scrollRef={paneScrollRef} className="min-w-0 flex-1 bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 py-0">
        {/* 階層種別ラベル。体裁はメタビューのヘッダーと共有部品で揃える */}
        <PaneKindBadge>{paneKindLabel("lesson", editLanguage)}</PaneKindBadge>
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {lessonDisplayName(lesson, editLanguage)}
        </h2>
        {/* 翻訳状態の赤字1行。レッスン本文だけは本文上部ではなくここへ置く
            ——本文領域の高さが状態で変わらないようにするため（studio-translation
            spec）。狭幅ではタイトル側が truncate され、この赤字が残る */}
        {isEnglish ? (
          <TranslationNotice state={bodyNotice} className="shrink-0" />
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {/* ⚠ ヘッダーは [メタ編集][3ビュー] に限る。言語切替は GlobalHeader に
              1つだけ置く（studio-translation spec）。本文翻訳は本文右上（スクロール追従） */}
          <WorkspaceTooltip
            label="レッスンメタを編集"
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mr-1 h-6 w-6 shrink-0"
                aria-label="レッスンメタを編集"
                onClick={() => setMetaDialogOpen(true)}
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            }
          />
          {/* ⚠ 英語モードでも3ビューを出す（studio-translation spec）。
              ビューと言語は独立した軸なので、言語切替で mode をリセットしない */}
          <PaneSegmentControl
            value={mode}
            options={MODE_TABS}
            onChange={onModeChange}
          />
        </div>
      </div>

      {/* 言語で変わるのは「どの本文を出すか」だけ。ビュー（編集/プレビュー/差分）の
          構成は日英で共通にする（studio-translation spec）——分けて書くと、
          どちらかにだけ機能が付く状態が生まれる */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* 翻訳エラーは一時的な表示なので本文上部のまま（鮮度の赤字はヘッダーへ移した） */}
        {isEnglish && enBody.translateError ? (
          <div className="border-b border-border bg-destructive/10 px-4 py-1.5 text-xs text-destructive">
            {enBody.translateError}
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* ⚠ CodeMirror が内部で独自のスクロールコンテナを持つので、本文と一緒に
              流すと画面外へ出る。ここだけは本文の上に重ねる（overlay） */}
          {isEnglish && mode === "raw" ? (
            <PaneActionBar
              variant="overlay"
              aiSlot={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={enBody.translate}
                  disabled={enBody.translating || enBody.state.status !== "ready"}
                >
                  {enBody.translating ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-3.5" aria-hidden />
                  )}
                  {TRANSLATE_LABEL}
                </Button>
              }
            />
          ) : null}

          {/* 編集ビュー。英語は別ファイル（自動保存）なのでエディタの実体を分ける
              ——`lessonId` が違えば CodeMirror の state キャッシュも分かれる */}
          <div
            className={cn(
              "absolute inset-0 flex min-h-0 min-w-0 bg-background",
              mode !== "raw" && "hidden",
            )}
          >
            {isEnglish ? (
              enBody.state.status === "ready" ? (
                <LessonContentEditor
                  ref={editorRef}
                  lessonId={`${lesson.id}:en`}
                  value={enBody.state.body}
                  onChange={enBody.updateBody}
                  onScrollElementReady={handleScrollElementReady}
                  onCursorChange={handleLocalCursorChange}
                  searchHighlightQuery={searchHighlightQuery}
                />
              ) : (
                <EnBodyPlaceholder state={enBody.state} />
              )
            ) : (
              <LessonContentEditor
                ref={editorRef}
                lessonId={lesson.id}
                value={editContent}
                onChange={(content) => onUpdateContent(lesson.id, content)}
                onScrollElementReady={handleScrollElementReady}
                onCursorChange={handleLocalCursorChange}
                searchHighlightQuery={searchHighlightQuery}
              />
            )}
          </div>

          {mode === "inline" ? (
            <div
              ref={attachScrollTarget}
              className="absolute inset-0 workspace-scrollbar overflow-y-auto overscroll-y-contain px-6 py-5"
            >
              {isEnglish && enBody.state.status !== "ready" ? (
                <EnBodyPlaceholder state={enBody.state} />
              ) : (
                <>
                  <LessonPreviewMetaRow
                    lesson={lesson}
                    course={course}
                    language={editLanguage}
                  />
                  <div className={LESSON_PREVIEW_CLASS}>
                    <ReactMarkdown
                      key={`${lesson.id}-${editLanguage}-${imageAssetsRevision}`}
                      remarkPlugins={lessonPreviewRemarkPlugins}
                      rehypePlugins={previewRehypePlugins}
                      components={previewMarkdownComponents}
                    >
                      {previewBody}
                    </ReactMarkdown>
                  </div>
                </>
              )}
            </div>
          ) : null}

        {mode === "diff" ? (
          <div
            ref={attachScrollTarget}
            className="absolute inset-0 workspace-scrollbar overflow-y-auto overscroll-y-contain"
          >
            {diffState.status === "loading" ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                差分を取得中...
              </div>
            ) : diffState.status === "error" ? (
              <div className="flex h-full items-center justify-center px-4 text-sm text-destructive">
                {diffState.message}
              </div>
            ) : diffState.status === "ready" ? (
              <LessonDiffView diff={diffState.diff} />
            ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <LessonMetaDialog
        open={metaDialogOpen}
        onOpenChange={setMetaDialogOpen}
        lesson={lesson}
        onSave={onUpdateLessonMeta}
        tagSuggestions={tagSuggestions}
        language={editLanguage}
        translationNotice={metaNotice}
        onTranslationChanged={onTranslationChanged}
      />
    </PaneWheelRoot>
  );
}
