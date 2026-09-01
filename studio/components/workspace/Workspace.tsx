"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { WorkScope } from "@/lib/work-scope";
import type { WorkspaceMeta } from "@/lib/workspace-meta";
import { GlobalHeader } from "@/components/workspace/GlobalHeader";
import { ContentTreePane } from "@/components/workspace/ContentTreePane";
import type { StoredTreeCollapse } from "@/lib/tree-collapse-cookie";
import { MarkdownEditorPane } from "@/components/workspace/MarkdownEditorPane";
import { WorkspaceMetaView } from "@/components/workspace/meta-views/WorkspaceMetaView";
import { SeriesMetaView } from "@/components/workspace/meta-views/SeriesMetaView";
import { CourseMetaView } from "@/components/workspace/meta-views/CourseMetaView";
import { Pane4Shell } from "@/components/workspace/Pane4Shell";
import { Pane4Toggle } from "@/components/workspace/Pane4Toggle";
import { PaneResizeHandle } from "@/components/workspace/PaneResizeHandle";
import {
  PANE4_COLLAPSED_WIDTH,
  type Pane3Mode,
} from "@/components/workspace/pane-layout";
import { ThemeInitializer } from "@/components/workspace/ThemeInitializer";
import { CompanyContextDialog } from "@/components/workspace/CompanyContextDialog";
import { WorkspaceSettingsDialog } from "@/components/workspace/WorkspaceSettingsDialog";
import { PANE3_MIN_WIDTH } from "@/components/workspace/pane-layout";
import { useWorkspacePaneWidths } from "@/components/workspace/use-workspace-pane-widths";
import { useLessonMutations } from "@/components/workspace/hooks/use-lesson-mutations";
import { useSeriesMutations } from "@/components/workspace/hooks/use-series-mutations";
import { useWorkspaceImageAssets } from "@/components/workspace/hooks/use-workspace-image-assets";
import { useWorkspaceSelection } from "@/components/workspace/hooks/use-workspace-selection";
import type { WorkspaceSelection } from "@/lib/workspace-selection";
import { useContentSync } from "@/components/workspace/hooks/use-content-sync";
import { useTranslationStatus } from "@/components/workspace/hooks/use-translation-status";
import { useLessonEnBody } from "@/components/workspace/hooks/use-lesson-en-body";
import {
  courseDisplayName,
  lessonDisplayName,
  seriesDisplayName,
  type EditLanguage,
} from "@/lib/display-name";
import {
  metaNoticeState,
  type TranslationNoticeState,
} from "@/lib/translation/client";
import type { Series } from "@/lib/schema";
import { normalizeSeriesCourseMeta } from "@/lib/course-flow";
import type { LessonMetaFields } from "@/lib/lesson-meta";
import { collectAllLessonTags } from "@/lib/lesson-tags";
import { htmlCommentInnerTextAtOffset } from "@/lib/html-comment-at-cursor";
import { matchLessonContentPath } from "@/lib/agent/invoke-context";
import type { AgentChatController } from "@/lib/agent-chat-controller";
import {
  loadPane4View,
  loadPane4ViewMigration,
  savePane4View,
  type Pane4View,
} from "@/lib/pane4-view-storage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type { Pane3Mode } from "@/components/workspace/pane-layout";

function Pane1ResizeHandle({
  className,
  style,
  ...props
}: React.ComponentProps<typeof PaneResizeHandle>) {
  const { state } = useSidebar();
  if (state !== "expanded") return null;
  return (
    <PaneResizeHandle
      className={className}
      style={style}
      lineClassName="w-px origin-center scale-x-[0.35] bg-border/40 hover:bg-primary/25 active:bg-primary/40"
      {...props}
    />
  );
}

type WorkspaceProps = {
  initialSeries: Series[];
  contentsEmpty?: boolean;
  workspace: WorkspaceMeta;
  /** 全体メタの github_url（サーバーで読んだ初期値。全体メタ保存で更新する） */
  initialGithubUrl?: string;
  /**
   * ツリーで畳んでいるシリーズ・コース（サーバーが cookie から読んだ初期値）。
   * ⚠ サーバーの HTML を最初から畳んだ状態にするための props——クライアント側で
   * 復元し直してはならない（`lib/tree-collapse-cookie.ts`）
   */
  initialTreeCollapse?: StoredTreeCollapse;
  /** `initialTreeCollapse` が保存された記憶から来たか（`ContentTreePane` の同名 prop へ通す） */
  treeRestoredFromMemory?: boolean;
  /**
   * 初期選択（サーバーが cookie から読んで実在を検証した値）。省略時は先頭レッスン。
   * ⚠ これが無いとサーバーは先頭レッスンで描き、hydration 後に localStorage の復元が
   * 届いた瞬間にツリーの選択レールと本文が移る（`lib/workspace-selection.ts`）
   */
  initialSelection?: WorkspaceSelection;
};

export function Workspace({
  initialSeries,
  contentsEmpty = false,
  workspace,
  initialGithubUrl = "",
  initialTreeCollapse,
  treeRestoredFromMemory,
  initialSelection,
}: WorkspaceProps) {
  const [githubUrl, setGithubUrl] = useState(initialGithubUrl);
  const [series, setSeries] = useState<Series[]>(() =>
    normalizeSeriesCourseMeta(initialSeries),
  );
  const [pane4ManuallyClosed, setPane4ManuallyClosed] = useState(false);
  const [pane3Mode, setPane3Mode] = useState<Pane3Mode>("raw");
  /** ペイン1 の中身検索の語。ペイン2 が一致箇所を塗るのに使う */
  const [contentSearchQuery, setContentSearchQuery] = useState("");
  const [pane4View, setPane4View] = useState<Pane4View>("agent");
  const [settingsOpen, setSettingsOpen] = useState(false);
  // ミニ曼陀羅モーダルの開閉。CourseMetaView は key リマウントされるので、
  // ここで持たないと「モーダルからコース遷移 → モーダルが消える」になる
  const [courseMandalaModalOpen, setCourseMandalaModalOpen] = useState(false);
  const [companyContextOpen, setCompanyContextOpen] = useState(false);
  /**
   * 編集言語（studio-translation spec）。ワークスペースの単一 state で、
   * レッスンの本文エディタとメタダイアログはこれに連動する。
   *
   * ⚠ これは面ごとの設定ではなく**アプリのモード**。選択階層が変わっても
   * リセットしない——モードは GlobalHeader の切替ボタンの表記
   * （「日本語ビューに戻る」）で常時見えているので、持ち越しは意図として読める。
   */
  const [editLanguage, setEditLanguage] = useState<EditLanguage>("ja");
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const saveErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pane4UiInitialized = useRef(false);

  const handleSaveError = useCallback((msg: string) => {
    setSaveErrorMsg(msg);
    if (saveErrorTimer.current) clearTimeout(saveErrorTimer.current);
    saveErrorTimer.current = setTimeout(() => setSaveErrorMsg(null), 5000);
  }, []);
  const [editorCommentPrompt, setEditorCommentPrompt] = useState<string | null>(
    null,
  );
  const [editorCursorOffset, setEditorCursorOffset] = useState<number | null>(
    null,
  );
  const [insertCallback, setInsertCallback] = useState<
    ((markdown: string) => void) | null
  >(null);
  const [currentLessonPath, setCurrentLessonPath] = useState<string | null>(null);
  const agentChatControllerRef = useRef<AgentChatController | null>(null);
  const [streamingSwitchOpen, setStreamingSwitchOpen] = useState(false);
  const pendingSwitchRef = useRef<(() => void) | null>(null);
  const workspaceRootRef = useRef<HTMLDivElement>(null);
  const [workspaceTotalWidth, setWorkspaceTotalWidth] = useState<number | null>(
    null,
  );

  const pane4Open = !pane4ManuallyClosed;

  const { paneWidths, isResizing, resizeHandleProps, applyPaneWidths } =
    useWorkspacePaneWidths(workspaceTotalWidth, pane4Open);

  useEffect(() => {
    if (pane4UiInitialized.current) return;
    pane4UiInitialized.current = true;
    const migration = loadPane4ViewMigration();
    if (migration) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage からの初回復元。ref ガードでマウント時 1 回に限定している
      setPane4View(migration.pane4View);
      if (migration.openPane4) {
        setPane4ManuallyClosed(false);
      }
      savePane4View(migration.pane4View);
      return;
    }
    setPane4View(loadPane4View());
  }, []);

  useEffect(() => {
    const el = workspaceRootRef.current;
    if (!el) return;

    const updateWidth = () => {
      setWorkspaceTotalWidth(el.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 初期選択はサーバーが cookie から読んだ値を優先する（無ければ先頭レッスン）。
  // ⚠ 先頭レッスンの規則は `app/page.tsx` の `firstLessonSelection` と同じにすること
  const firstSeriesId = initialSelection?.seriesId ?? initialSeries[0]?.id ?? "";
  const firstCourseId =
    initialSelection?.courseId ?? initialSeries[0]?.courses[0]?.id ?? "";
  const firstLessonId =
    initialSelection?.lessonId ??
    initialSeries[0]?.courses[0]?.lessons[0]?.id ??
    "";

  const {
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    selectedCourse,
    selectedLesson,
    selectedSeriesName,
    focusLevel,
    selectHome,
    selectSeries,
    selectCourse,
    selectLesson,
    setSelection,
  } = useWorkspaceSelection({
    series,
    initialSeriesId: firstSeriesId,
    initialCourseId: firstCourseId,
    initialLessonId: firstLessonId,
  });

  const selectedSeriesItem = useMemo(
    () => series.find((s) => s.id === selectedSeriesId),
    [series, selectedSeriesId],
  );

  // 作業スコープ。会話の保存先と、相対パスの基準を兼ねる。
  // フォーカス階層（最深の非空）と 1 対 1 で対応する。
  const workScope = useMemo<WorkScope>(
    () => ({
      ...(selectedSeriesName ? { series: selectedSeriesName } : {}),
      ...(selectedSeriesName && selectedCourse
        ? { course: selectedCourse.name }
        : {}),
      ...(selectedSeriesName && selectedCourse && selectedLesson
        ? { lesson: selectedLesson.lesson }
        : {}),
    }),
    [selectedSeriesName, selectedCourse, selectedLesson],
  );

  const requestSelectionChange = useCallback((action: () => void) => {
    // ⚠ ここで編集言語を ja に戻さないこと。言語はアプリのモードで、選択を
    // またいで保たれる（studio-translation spec）
    const wrapped = () => {
      action();
    };
    if (agentChatControllerRef.current?.isStreaming()) {
      pendingSwitchRef.current = wrapped;
      setStreamingSwitchOpen(true);
      return;
    }
    wrapped();
  }, []);

  const guardedSelectLesson = useCallback(
    (lessonId: string) => {
      requestSelectionChange(() => selectLesson(lessonId));
    },
    [requestSelectionChange, selectLesson],
  );

  const guardedSelectCourse = useCallback(
    (courseId: string) => {
      requestSelectionChange(() => selectCourse(courseId));
    },
    [requestSelectionChange, selectCourse],
  );

  const guardedSelectSeries = useCallback(
    (seriesId: string) => {
      requestSelectionChange(() => selectSeries(seriesId));
    },
    [requestSelectionChange, selectSeries],
  );

  const guardedSelectHome = useCallback(() => {
    requestSelectionChange(() => selectHome());
  }, [requestSelectionChange, selectHome]);

  const handleConfirmStreamingSwitch = useCallback(async () => {
    const action = pendingSwitchRef.current;
    pendingSwitchRef.current = null;
    setStreamingSwitchOpen(false);
    await agentChatControllerRef.current?.interruptForSwitch();
    action?.();
  }, []);

  const {
    addSeries,
    deleteSeries,
    addCourse,
    deleteCourse,
    reorderSeries,
    reorderCourses,
    updateCourseMeta,
    updateSeriesMeta,
    updateSeriesName,
  } = useSeriesMutations({
    series,
    setSeries,
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    setSelection,
    onSaveError: handleSaveError,
  });

  const handleSeriesLoaded = useCallback(
    (newSeries: Series[]) => {
      setSeries(newSeries);
    },
    [setSeries],
  );

  const cancelLessonDebounceRef = useRef<(lessonId: string) => void>(() => {});

  const handleLessonDiskSynced = useCallback((lessonId: string) => {
    cancelLessonDebounceRef.current(lessonId);
  }, []);

  const { setPendingSave } = useContentSync({
    series,
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    onSeriesLoaded: handleSeriesLoaded,
    onSelectionChange: setSelection,
    onLessonDiskSynced: handleLessonDiskSynced,
  });

  const {
    addLesson,
    deleteLesson,
    reorderLessons,
    updateLessonContent,
    updateLessonEnContent,
    updateLessonMeta,
    updateLessonStatus,
    cancelLessonDebounce,
  } = useLessonMutations({
    series,
    setSeries,
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    setSelection,
    setPendingSave,
    onSaveError: handleSaveError,
  });

  useEffect(() => {
    cancelLessonDebounceRef.current = cancelLessonDebounce;
  }, [cancelLessonDebounce]);

  const shouldLoadImageAssets = pane4Open || pane3Mode === "inline";
  const { availableImagePaths, imageAssetsRevision, notifyImageAssetsChanged } =
    useWorkspaceImageAssets(shouldLoadImageAssets);

  const tagSuggestions = useMemo(
    () => collectAllLessonTags(series),
    [series],
  );

  const registerInsertCallback = useCallback(
    (cb: (markdown: string) => void) => {
      setInsertCallback(() => cb);
    },
    [],
  );

  const insertImageMarkdown = useCallback(
    (markdown: string): boolean => {
      // 可否の根拠は選択状態とモード。insertCallback はエディタのアンマウント後も
      // 残るため、これだけを根拠にすると「成功を返すが本文に入らない」状態になる
      if (!selectedLesson) return false;
      if (pane3Mode !== "raw") return false;
      if (!insertCallback) return false;
      insertCallback(markdown);
      return true;
    },
    [selectedLesson, pane3Mode, insertCallback],
  );

  // effect が本文（content）の変化で再発火しないよう、参照はプリミティブに絞る
  const selectedLessonSeries = selectedLesson?.series ?? null;
  const selectedLessonCourse = selectedLesson?.course ?? null;
  const selectedLessonName = selectedLesson?.lesson ?? null;

  // レッスン非選択への遷移で currentLessonPath を即リセットする
  //（Effect+setState は 1 render 遅れるため render 中に比較して書く）
  const [prevSelectedLessonName, setPrevSelectedLessonName] =
    useState(selectedLessonName);
  if (selectedLessonName !== prevSelectedLessonName) {
    setPrevSelectedLessonName(selectedLessonName);
    if (!selectedLessonName) setCurrentLessonPath(null);
  }

  useEffect(() => {
    if (
      !pane4Open ||
      pane4View !== "agent" ||
      !selectedLessonName ||
      !selectedLessonSeries ||
      !selectedLessonCourse
    ) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/agent/files?q=${encodeURIComponent(selectedLessonName)}`,
        );
        const data = (await res.json()) as {
          files?: Array<{ path: string; name: string }>;
        };
        if (cancelled) return;
        const resolved = matchLessonContentPath(data.files ?? [], {
          series: selectedLessonSeries,
          course: selectedLessonCourse,
          lesson: selectedLessonName,
        });
        setCurrentLessonPath(resolved);
      } catch {
        if (!cancelled) setCurrentLessonPath(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    pane4Open,
    pane4View,
    selectedLessonSeries,
    selectedLessonCourse,
    selectedLessonName,
  ]);

  // 翻訳の鮮度（チップ用）。契機: 選択変更・保存/翻訳/最新化（refresh）・
  // 日本語本文の編集（contentSignal 経由の遅延再取得）
  const { data: translationData, refresh: refreshTranslationStatus } =
    useTranslationStatus({
      seriesName: selectedSeriesName || undefined,
      courseName: selectedCourse?.name,
      lessonName: selectedLesson?.lesson,
      contentSignal: selectedLesson?.content,
    });

  // ⚠ 階層をまたいで合成しない（studio-translation spec）。面ごとに独立した
  // 材料を渡す——合成すると、本文の話をしたいペイン2 ヘッダーにメタの状態が漏れ、
  // changelog の未翻訳が全体メタの「古い」を握り潰す
  const lessonBodyNotice: TranslationNoticeState = {
    untranslated: translationData?.statuses.lesson?.bodyMissing ?? false,
    stale: translationData?.statuses.lesson?.body === "stale",
  };
  const lessonMetaNotice = metaNoticeState(translationData?.statuses.lesson);
  const courseMetaNotice = metaNoticeState(translationData?.statuses.course);
  const seriesMetaNotice = metaNoticeState(translationData?.statuses.series);
  // ホームだけは changelog を合流させる——別ファイルだが同じ面で編集するため
  const rootMetaNotice = metaNoticeState(translationData?.statuses.root);
  const homeNotice: TranslationNoticeState = {
    untranslated:
      rootMetaNotice.untranslated || (translationData?.changelogMissing ?? false),
    stale: rootMetaNotice.stale || translationData?.changelog === "stale",
  };

  /**
   * 英語版本文（`contents.en.md`）の読み書き。**ペイン2 ではなくここで持つ**——
   * 「いま編集している本文」はペイン2 の表示だけでなく、カーソル同期・Agent の
   * エディタ反映・（後続 change で）ペイン4 の画像文脈でも要る。ペイン2 に閉じ込めると
   * 呼び出し側が日本語本文で代用してしまい、英語ビューで本文とオフセットの言語が
   * 食い違う（studio-translation spec）。
   */
  const selectedLessonId_ = selectedLesson?.id;
  /**
   * 英語版の本文が変わったらツリー state にも移す。画像の参照走査は日英を
   * 分け隔てなく数えるので、これが無いと英語ビューでの編集が Used タブに
   * 追随しない（日本語は `updateLessonContent` が state 更新も兼ねている）
   */
  const handleEnBodyChange = useCallback(
    (content: string) => {
      if (!selectedLessonId_) return;
      updateLessonEnContent(selectedLessonId_, content);
    },
    [selectedLessonId_, updateLessonEnContent],
  );

  const enBody = useLessonEnBody({
    enabled: editLanguage === "en",
    series: selectedLesson?.series,
    course: selectedLesson?.course,
    lesson: selectedLesson?.lesson,
    onSaveError: handleSaveError,
    onSaved: refreshTranslationStatus,
    onBodyChange: handleEnBodyChange,
  });

  /**
   * いま編集している本文。英語ビューは訳文、日本語ビューは正本。
   * 英語版が未読込（読込中・エラー）のときは空文字（＝コメント解決は null）。
   */
  const activeBody =
    editLanguage === "en"
      ? enBody.state.status === "ready"
        ? enBody.state.body
        : ""
      : (selectedLesson?.content ?? "");

  /**
   * ペイン4 の AI へ渡すレッスン文脈。本文は編集言語のもの（英語ビューでは訳文）。
   * ⚠ 英語版が未読込のときは undefined——日本語本文を英語ビューの文脈にしない
   * （image-pane-language spec）。レッスン未選択と同じ扱いになる。
   */
  const imageContextLesson = useMemo(() => {
    if (!selectedLesson) return undefined;
    if (editLanguage === "ja") return selectedLesson;
    if (enBody.state.status !== "ready") return undefined;
    return { ...selectedLesson, content: enBody.state.body };
  }, [selectedLesson, editLanguage, enBody.state]);

  const handleOverwriteEditor = useCallback(
    (markdown: string, metaPatch?: Partial<LessonMetaFields>) => {
      if (!selectedLesson) return;
      // 反映先は編集言語に従う——英語ビューでの反映が日本語正本を書き換えない
      if (editLanguage === "en") {
        enBody.updateBody(markdown);
      } else {
        updateLessonContent(selectedLesson.id, markdown);
      }
      // メタ（tags / estimated_minutes）は日英共有なので言語によらず適用する
      if (metaPatch && Object.keys(metaPatch).length > 0) {
        updateLessonMeta(selectedLesson.id, metaPatch);
      }
      setPane3Mode("raw");
    },
    [
      selectedLesson,
      editLanguage,
      enBody,
      updateLessonContent,
      updateLessonMeta,
    ],
  );

  const handleEditorCursorChange = useCallback(
    (offset: number) => {
      if (pane3Mode !== "raw" || !selectedLesson) {
        setEditorCommentPrompt(null);
        setEditorCursorOffset(null);
        return;
      }
      setEditorCursorOffset(offset);
      setEditorCommentPrompt(htmlCommentInnerTextAtOffset(activeBody, offset));
    },
    [pane3Mode, selectedLesson, activeBody],
  );

  // 編集モードを離れた／レッスン非選択になったらエディタ由来のプロンプト文脈を
  // 破棄する（Effect+setState は 1 render 遅れるため render 中に比較して書く）
  const editorSyncLessonId = selectedLesson?.id ?? null;
  const [prevEditorSync, setPrevEditorSync] = useState<{
    mode: Pane3Mode;
    lessonId: string | null;
  }>({ mode: pane3Mode, lessonId: editorSyncLessonId });
  if (
    prevEditorSync.mode !== pane3Mode ||
    prevEditorSync.lessonId !== editorSyncLessonId
  ) {
    setPrevEditorSync({ mode: pane3Mode, lessonId: editorSyncLessonId });
    if (pane3Mode !== "raw" || !editorSyncLessonId) {
      setEditorCommentPrompt(null);
      setEditorCursorOffset(null);
    }
  }

  const handlePane4ViewChange = useCallback((view: Pane4View) => {
    setPane4View(view);
    savePane4View(view);
  }, []);

  const handleTogglePane4 = useCallback(() => {
    setPane4ManuallyClosed((closed) => !closed);
  }, []);

  return (
    <div
      ref={workspaceRootRef}
      // ビューポート高から supergraphic 帯のぶんを引く。引かないとページ全体が
      // 帯の高さだけスクロールしてしまう
      className="h-[calc(100svh-var(--supergraphic-h))] w-full overflow-hidden"
    >
    <SidebarProvider
      defaultOpen
      data-resizing={isResizing ? "" : undefined}
      className={cn(
        "h-full w-full overflow-hidden bg-background text-foreground",
        isResizing &&
          "[&_[data-slot=sidebar-gap]]:transition-none [&_[data-slot=sidebar-container]]:transition-none",
      )}
      style={
        {
          "--sidebar-width": `${paneWidths.tree}px`,
        } as React.CSSProperties
      }
    >
      <ThemeInitializer />
      <div className="relative shrink-0">
        <ContentTreePane
          workspaceName={workspace.name}
          series={series}
          initialCollapse={initialTreeCollapse}
          restoredFromMemory={treeRestoredFromMemory}
          editLanguage={editLanguage}
          selectedSeriesId={selectedSeriesId}
          selectedCourseId={selectedCourseId}
          selectedLessonId={selectedLessonId}
          onSelectHome={guardedSelectHome}
          onSelectSeries={guardedSelectSeries}
          onSelectCourse={guardedSelectCourse}
          onSelectLesson={guardedSelectLesson}
          onContentQueryChange={setContentSearchQuery}
          onReorderSeries={reorderSeries}
          onReorderCourses={reorderCourses}
          onReorderLessons={reorderLessons}
          onAddSeries={addSeries}
          onAddCourse={addCourse}
          onAddLesson={addLesson}
          onDeleteSeries={deleteSeries}
          onDeleteCourse={deleteCourse}
          onDeleteLesson={deleteLesson}
          onUpdateSeriesName={updateSeriesName}
          onUpdateCourseMeta={updateCourseMeta}
          onUpdateLessonMeta={updateLessonMeta}
          onUpdateLessonStatus={updateLessonStatus}
          onSaveError={handleSaveError}
        />
        <Pane1ResizeHandle
          {...resizeHandleProps("tree")}
          className="absolute inset-y-0 z-30 mx-0 px-2"
          style={{ left: "calc(var(--sidebar-width) - 8px)" }}
        />
      </div>
      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* ⚠ パンくずへ渡すのは表示名（英語モードでは name_en・未訳は日本語名）。
            API のパス解決に使う名前は日本語のフォルダ名のままで別物 */}
        <GlobalHeader
          seriesName={
            selectedSeriesItem
              ? seriesDisplayName(selectedSeriesItem, editLanguage)
              : selectedSeriesName
          }
          courseName={
            selectedCourse ? courseDisplayName(selectedCourse, editLanguage) : ""
          }
          lessonName={
            selectedLesson ? lessonDisplayName(selectedLesson, editLanguage) : ""
          }
          series={series}
          selectedSeriesId={selectedSeriesId}
          selectedCourseId={selectedCourseId}
          githubUrl={githubUrl}
          editLanguage={editLanguage}
          onEditLanguageChange={setEditLanguage}
          onSelectSeries={guardedSelectSeries}
          onSelectCourse={guardedSelectCourse}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCompanyContext={() => setCompanyContextOpen(true)}
        />
        <WorkspaceSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          currentPaneWidths={paneWidths}
          onApplyPaneWidths={applyPaneWidths}
        />
        <CompanyContextDialog
          open={companyContextOpen}
          onOpenChange={setCompanyContextOpen}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {contentsEmpty && (
          <div className="flex items-center justify-center border-b bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            contents/
            フォルダが空です。ツリーの「＋」からシリーズを作成して始めてください。
          </div>
        )}
        {saveErrorMsg && (
          <div className="flex items-center justify-center border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {saveErrorMsg}
          </div>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            className="flex h-full min-w-0 flex-1 flex-col overflow-hidden"
            style={{ minWidth: PANE3_MIN_WIDTH }}
          >
            {/* ペイン2 は選択階層に応じて切り替える（レッスン＝エディタ / それ以外＝メタビュー） */}
            {focusLevel === "lesson" ? (
              <MarkdownEditorPane
                lesson={selectedLesson}
                series={series}
                course={selectedCourse}
                mode={pane3Mode}
                onModeChange={setPane3Mode}
                onUpdateContent={updateLessonContent}
                onUpdateLessonMeta={updateLessonMeta}
                onRegisterInsertCallback={registerInsertCallback}
                onEditorCursorChange={handleEditorCursorChange}
                tagSuggestions={tagSuggestions}
                availableImagePaths={availableImagePaths}
                imageAssetsRevision={imageAssetsRevision}
                searchHighlightQuery={contentSearchQuery}
                editLanguage={editLanguage}
                bodyNotice={lessonBodyNotice}
                metaNotice={lessonMetaNotice}
                onTranslationChanged={refreshTranslationStatus}
                enBody={enBody}
              />
            ) : focusLevel === "course" && selectedCourse ? (
              <CourseMetaView
                key={selectedCourse.id}
                series={series}
                course={selectedCourse}
                onSave={updateCourseMeta}
                onSelectCourse={guardedSelectCourse}
                mandalaModalOpen={courseMandalaModalOpen}
                onMandalaModalOpenChange={setCourseMandalaModalOpen}
                editLanguage={editLanguage}
                translationNotice={courseMetaNotice}
                onTranslationChanged={refreshTranslationStatus}
                seriesName={selectedSeriesName}
              />
            ) : focusLevel === "series" && selectedSeriesItem ? (
              <SeriesMetaView
                key={selectedSeriesItem.id}
                seriesItem={selectedSeriesItem}
                onRenameSeries={updateSeriesName}
                onSaveMeta={updateSeriesMeta}
                editLanguage={editLanguage}
                translationNotice={seriesMetaNotice}
                onTranslationChanged={refreshTranslationStatus}
              />
            ) : (
              <WorkspaceMetaView
                workspaceName={workspace.name}
                onSaveError={handleSaveError}
                onGithubUrlSaved={setGithubUrl}
                editLanguage={editLanguage}
                translationNotice={homeNotice}
                onTranslationChanged={refreshTranslationStatus}
              />
            )}
          </div>
          {pane4Open ? (
            <>
              <PaneResizeHandle {...resizeHandleProps("pane4")} />
              <div
                className="flex h-full shrink-0 flex-col overflow-hidden"
                style={{ width: paneWidths.pane4 }}
              >
                <Pane4Shell
                  pane4View={pane4View}
                  onPane4ViewChange={handlePane4ViewChange}
                  onTogglePane4={handleTogglePane4}
                  series={series}
                  lesson={selectedLesson}
                  course={selectedCourse}
                  workScope={workScope}
                  pane3Mode={pane3Mode}
                  onInsertImage={insertImageMarkdown}
                  editorCommentPrompt={editorCommentPrompt}
                  editorCursorOffset={editorCursorOffset}
                  editLanguage={editLanguage}
                  contextLesson={imageContextLesson}
                  onOpenSettings={() => setSettingsOpen(true)}
                  currentLessonPath={currentLessonPath}
                  agentChatControllerRef={agentChatControllerRef}
                  onOverwriteEditor={handleOverwriteEditor}
                  onImageAssetsChanged={notifyImageAssetsChanged}
                />
              </div>
            </>
          ) : (
            <div
              className="flex shrink-0 flex-col items-center border-l border-border bg-card py-3"
              style={{ width: PANE4_COLLAPSED_WIDTH }}
            >
              <Pane4Toggle
                open={false}
                onToggle={handleTogglePane4}
              />
            </div>
          )}
        </div>
        <AlertDialog open={streamingSwitchOpen} onOpenChange={setStreamingSwitchOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>AI が応答中です</AlertDialogTitle>
              <AlertDialogDescription>
                レッスンを切り替えると応答は中断されます。途中までの内容は保存され、戻ったあと「続きを生成」から再開できます。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  pendingSwitchRef.current = null;
                }}
              >
                キャンセル
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleConfirmStreamingSwitch()}>
                切り替える
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
    </div>
  );
}
