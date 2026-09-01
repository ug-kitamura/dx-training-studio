"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  GraduationCap,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  CircleCheck,
  FileText,
  House,
  Loader,
  CircleDashed,
  Search,
  Pencil,
  Copy,
  ClipboardPaste,
  FolderOpen,
  FolderPlus,
  FilePlus,
  Trash2,
  X,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS as DndCss } from "@dnd-kit/utilities";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pane1Toggle } from "@/components/workspace/Pane1Toggle";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import { NameDialog } from "@/components/workspace/NameDialog";
import {
  LIST_ROW_X_INSET_CLASS,
  PANE_LIST_CONTENT_X_INSET_CLASS,
  SORTABLE_POINTER_ACTIVATION,
} from "@/components/workspace/constants";
import {
  buildVisibleContentRows,
  filterSeriesByContentMatches,
  filterSeriesByName,
  HOME_ROW_ID,
  lessonRowId,
  courseRowId,
  resolveCollapseAllTargets,
  resolveFocusFallbackRowId,
  resolveHomeEndNavigation,
  resolveLeftNavigation,
  selectionRowId,
  seriesRowId,
  type ContentSearchMatch,
  type ContentTreeRow,
} from "@/lib/content-tree-flatten";
import { cn } from "@/lib/utils";
import {
  serializeTreeCollapseCookie,
  writeTreeCollapseCookie,
  type StoredTreeCollapse,
} from "@/lib/tree-collapse-cookie";
import type { LessonMetaFields } from "@/lib/lesson-meta";
import type { Series, Course, Lesson } from "@/lib/schema";
import {
  courseDisplayName,
  lessonDisplayName,
  seriesDisplayName,
  type EditLanguage,
} from "@/lib/display-name";
import { paneKindLabel } from "@/components/workspace/metaDialogLayout";

/**
 * ツリー最上部のホーム行のラベル（unified-content-tree spec）。
 *
 * 英語は `paneKindLabel("root", "en")` を引く——ペイン2 ヘッダーの階層種別バッジと
 * **同じ語**を出すため。⚠ `Home` の文字列をここに書かないこと（片方だけ直る事故になる）。
 *
 * ⚠ 日本語は「ホーム」を維持し、階層種別ラベルの日本語（「全体」）へ寄せない。
 * ツリーの日本語表示は変えないことが要件で、日英が非対称なのは意図的。
 * ⚠ 全体メタの `name` / `name_en` も出さない——ホーム行はナビゲーションの原点であり、
 * シリーズ・コース・レッスン行のようなコンテンツ名の表示行ではない。
 */
function homeRowLabel(language: EditLanguage): string {
  return language === "en" ? paneKindLabel("root", "en") : "ホーム";
}

/** ステータス種別はラベルとアイコンの形で区別する（色は付けない・下のボタン側で指定） */
const STATUS_ICON: Record<
  Lesson["status"],
  { icon: React.ReactNode; label: string }
> = {
  done: { icon: <CircleCheck className="size-3.5" />, label: "完成" },
  in_progress: { icon: <Loader className="size-3.5" />, label: "作成中" },
  open: { icon: <CircleDashed className="size-3.5" />, label: "未着手" },
};

const STATUS_CYCLE: Record<Lesson["status"], Lesson["status"]> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
};

const CONTENT_SEARCH_DEBOUNCE_MS = 300;

/** クリップボード（クライアント内 state）。名前で保持し API へそのまま渡す */
type ClipboardItem =
  | { type: "series"; series: string }
  | { type: "course"; series: string; course: string }
  | { type: "lesson"; series: string; course: string; lesson: string };

type DeleteTarget =
  | { kind: "series"; seriesItem: Series }
  | { kind: "course"; seriesItem: Series; course: Course }
  | { kind: "lesson"; course: Course; lesson: Lesson };

type NameDialogState = {
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (name: string) => void;
};

type Props = {
  workspaceName: string;
  series: Series[];
  /**
   * 畳んでいるシリーズ・コース（サーバーが cookie から読んだ初期値）。省略時は全展開。
   * ⚠ サーバーとクライアントで同じ値が来るので、そのまま初期 state にしてよい
   * （hydration が一致する）。クライアント側で読み直してはならない
   */
  initialCollapse?: StoredTreeCollapse;
  /**
   * `initialCollapse` が**保存された記憶から来たか**。`false` は「記憶が無いので
   * 全折りたたみで描いた」を意味する。
   * ⚠ 復元時に選択の祖先を開く保険は、これが `true` のときだけ働かせること——
   * 記憶が無いのに開くと、cookie だけ失効して localStorage の選択が生きている
   * 状態で「1本だけ枝が開いた全折りたたみ」になる
   */
  restoredFromMemory?: boolean;
  selectedSeriesId: string;
  selectedCourseId: string;
  selectedLessonId: string;
  onSelectHome: () => void;
  onSelectSeries: (seriesId: string) => void;
  onSelectCourse: (courseId: string) => void;
  onSelectLesson: (lessonId: string) => void;
  /**
   * 中身検索（`?` 始まり）の検索語。ペイン2 が一致箇所を塗るのに使う。
   * 名前フィルタのときは空文字——ファイル名の一致は本文の一致ではない。
   */
  onContentQueryChange?: (query: string) => void;
  onReorderSeries: (fromIndex: number, toIndex: number) => void;
  onReorderCourses: (seriesId: string, fromIndex: number, toIndex: number) => void;
  onReorderLessons: (courseId: string, fromIndex: number, toIndex: number) => void;
  onAddSeries: (name: string) => string;
  onAddCourse: (seriesId: string, name: string) => void;
  onAddLesson: (courseId: string, name: string) => void;
  onDeleteSeries: (seriesId: string) => void;
  onDeleteCourse: (seriesId: string, courseId: string) => void;
  onDeleteLesson: (courseId: string, lessonId: string) => void;
  onUpdateSeriesName: (seriesId: string, name: string) => void;
  onUpdateCourseMeta: (
    courseId: string,
    meta: Pick<
      Course,
      | "name"
      | "target"
      | "style"
      | "cross_series_prev"
      | "cross_series_next"
      | "is_start"
      | "is_goal"
    >,
  ) => void;
  onUpdateLessonMeta: (lessonId: string, meta: Partial<LessonMetaFields>) => void;
  onUpdateLessonStatus: (lessonId: string, status: Lesson["status"]) => void;
  onSaveError?: (message: string) => void;
  /** 行に出す名前の言語。⚠ 表示だけ——選択・並べ替え・パス解決の名前は日本語のまま */
  editLanguage: EditLanguage;
};

function courseRenamePatch(
  course: Course,
  name: string,
): Pick<
  Course,
  | "name"
  | "target"
  | "style"
  | "cross_series_prev"
  | "cross_series_next"
  | "is_start"
  | "is_goal"
> {
  return {
    name,
    target: course.target,
    style: course.style,
    cross_series_prev: course.cross_series_prev ?? [],
    cross_series_next: course.cross_series_next ?? [],
    is_start: course.is_start ?? false,
    is_goal: course.is_goal ?? false,
  };
}

/** レッスン行の file-text アイコン（EBEX の markdown ファイルと同じ色クラス） */
function LessonRowIcon() {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center text-chart-1/60 dark:text-chart-1"
      aria-hidden="true"
    >
      <FileText className="size-3.5" />
    </span>
  );
}

export function ContentTreePane({
  workspaceName,
  series,
  initialCollapse,
  restoredFromMemory = true,
  selectedSeriesId,
  selectedCourseId,
  selectedLessonId,
  onSelectHome,
  onSelectSeries,
  onSelectCourse,
  onSelectLesson,
  onContentQueryChange,
  onReorderSeries,
  onReorderCourses,
  onReorderLessons,
  onAddSeries,
  onAddCourse,
  onAddLesson,
  onDeleteSeries,
  onDeleteCourse,
  onDeleteLesson,
  onUpdateSeriesName,
  onUpdateCourseMeta,
  onUpdateLessonMeta,
  onUpdateLessonStatus,
  onSaveError,
  editLanguage,
}: Props) {
  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";
  const scrollRef = useRef<HTMLDivElement>(null);

  // 開閉は「畳んだものだけ」を覚える。追加・同期で現れた新ノードは自動的に展開状態になる。
  // 初期値はサーバーが cookie から読んで props で渡したもの（`app/page.tsx`）。
  //
  // ⚠ クライアント側で復元し直してはならない。ここは 3 回踏んでいる:
  //   - `useState` 初期化関数で localStorage を読む → SSR でも走るので hydration が食い違う
  //   - `useEffect` で読む → 描画のあとなので全展開が一瞬見える
  //   - `useLayoutEffect` で読む → **それでも見える**。サーバーが描いた HTML は hydration
  //     まで表示され続け、どの hook も hydration の前には走らない
  // だからサーバーが畳んだ HTML を返すしかない。props が同じなら SSR とクライアントで
  // 同じ初期 state になり、hydration も一致する（`lib/tree-collapse-cookie.ts`）
  const [collapsedSeriesIds, setCollapsedSeriesIds] = useState<Set<string>>(
    () => new Set(initialCollapse?.series ?? []),
  );
  const [collapsedCourseIds, setCollapsedCourseIds] = useState<Set<string>>(
    () => new Set(initialCollapse?.courses ?? []),
  );

  // 保存は state の変化を見る 1 本にまとめる。トグル・collapse all の各呼び出し側に
  // 書くと足し忘れる。
  //
  // ⚠ 依存に**選択**も入れること。cookie に書くのは「畳んだ集合 − 選択の祖先」で、
  // サーバーは選択（localStorage）を知らないので、書く側が先に除いておかないと
  // リロードで選択中の行が畳まれた枝に隠れる。選択が変わるたびに書き直す。
  // マウント直後は親の選択復元が届く前（フォールバック）で一度走るが、届いた直後に
  // 書き直されるので実害はない
  useEffect(() => {
    writeTreeCollapseCookie(
      serializeTreeCollapseCookie(collapsedSeriesIds, collapsedCourseIds, {
        seriesId: selectedSeriesId,
        courseId: selectedCourseId,
      }),
    );
  }, [collapsedSeriesIds, collapsedCourseIds, selectedSeriesId, selectedCourseId]);

  // キーボードカーソル。選択とは独立の UI state（EBEX FileTreePane と同じ機構）
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [contextMenuRowId, setContextMenuRowId] = useState<string | null>(null);

  // 検索
  const [filter, setFilter] = useState("");
  const [contentMatches, setContentMatches] = useState<ContentSearchMatch[]>([]);
  const [contentSearching, setContentSearching] = useState(false);
  const [contentTruncated, setContentTruncated] = useState(false);

  const isContentSearchMode = filter.startsWith("?");
  const contentQuery = isContentSearchMode ? filter.slice(1).trim() : "";
  const nameFilter = isContentSearchMode ? "" : filter;

  // コンテキストメニュー操作直後のポインター操作（貫通クリック等）を無視するガード
  // （EBEX FileTreePane と同じ機構）
  const menuGuardUntilRef = useRef(0);
  const armMenuGuard = useCallback(() => {
    menuGuardUntilRef.current = Date.now() + 300;
  }, []);
  const isMenuGuarded = useCallback(
    () => Date.now() < menuGuardUntilRef.current,
    [],
  );

  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);

  // ダイアログ state
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const anyDialogOpen = nameDialog !== null || deleteTarget !== null;
  const anyDialogOpenRef = useRef(anyDialogOpen);
  useEffect(() => {
    anyDialogOpenRef.current = anyDialogOpen;
  }, [anyDialogOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: SORTABLE_POINTER_ACTIVATION,
    }),
  );

  const toggleSeries = useCallback((id: string) => {
    setCollapsedSeriesIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCourse = useCallback((id: string) => {
    setCollapsedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSeriesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = series.findIndex((s) => s.id === active.id);
    const toIndex = series.findIndex((s) => s.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) onReorderSeries(fromIndex, toIndex);
  };

  const revealInOs = useCallback(
    (target: { series?: string; course?: string; lesson?: string }) => {
      fetch("/api/content/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      }).catch(() => {
        // 開けなくても致命ではない
      });
    },
    [],
  );

  const duplicateTo = useCallback(
    (payload: Record<string, string>) => {
      fetch("/api/content/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(data?.error ?? `HTTP ${res.status}`);
          }
          // 反映はコンテンツ同期（mtime 監視）が拾う
        })
        .catch((err: unknown) => {
          onSaveError?.(`複製エラー: ${String(err)}`);
        });
    },
    [onSaveError],
  );

  const findSeries = useCallback(
    (seriesId: string): Series | null =>
      series.find((s) => s.id === seriesId) ?? null,
    [series],
  );

  const findCourse = useCallback(
    (courseId: string): { seriesItem: Series; course: Course } | null => {
      for (const s of series) {
        const c = s.courses.find((c) => c.id === courseId);
        if (c) return { seriesItem: s, course: c };
      }
      return null;
    },
    [series],
  );

  const findLesson = useCallback(
    (
      lessonId: string,
    ): { seriesItem: Series; course: Course; lesson: Lesson } | null => {
      for (const s of series) {
        for (const c of s.courses) {
          const l = c.lessons.find((l) => l.id === lessonId);
          if (l) return { seriesItem: s, course: c, lesson: l };
        }
      }
      return null;
    },
    [series],
  );

  // -------------------------------------------------------------------------
  // 検索: 名前フィルタはクライアント、`?` はコンテンツ検索 API
  // -------------------------------------------------------------------------

  // ペイン2 のハイライト用。解決済みのクエリだけを上げる——生の入力文字列や
  // 一致結果はツリーの絞り込みという別の関心事で、SSoT へ上げる必要がない
  useEffect(() => {
    onContentQueryChange?.(isContentSearchMode ? contentQuery : "");
  }, [contentQuery, isContentSearchMode, onContentQueryChange]);

  useEffect(() => {
    if (!isContentSearchMode || !contentQuery) {
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          // 検索対象は編集言語に連動する（unified-content-tree spec）
          const params = new URLSearchParams({
            q: contentQuery,
            lang: editLanguage,
          });
          const res = await fetch(`/api/content/search?${params.toString()}`);
          if (!res.ok) {
            setContentMatches([]);
            setContentTruncated(false);
            return;
          }
          const data = (await res.json()) as {
            matches?: ContentSearchMatch[];
            truncated?: boolean;
          };
          setContentMatches(data.matches ?? []);
          setContentTruncated(Boolean(data.truncated));
        } catch {
          setContentMatches([]);
          setContentTruncated(false);
        } finally {
          setContentSearching(false);
        }
      })();
    }, CONTENT_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // ⚠ editLanguage も依存。言語を切り替えたら対象が変わるので引き直す
    // （入力が残ったまま結果だけ前の言語、という状態を作らない）
  }, [contentQuery, isContentSearchMode, editLanguage]);

  const clearSearchFilter = useCallback(() => {
    setFilter("");
    setContentMatches([]);
    setContentSearching(false);
    setContentTruncated(false);
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    if (!value.startsWith("?") || !value.slice(1).trim()) {
      setContentMatches([]);
      setContentSearching(false);
      setContentTruncated(false);
    } else {
      setContentSearching(true);
    }
    setFilter(value);
  }, []);

  const filteredSeries = useMemo(() => {
    if (isContentSearchMode) {
      if (!contentQuery) return series;
      return filterSeriesByContentMatches(series, contentMatches);
    }
    return filterSeriesByName(series, nameFilter, editLanguage);
  }, [
    series,
    isContentSearchMode,
    contentQuery,
    contentMatches,
    nameFilter,
    editLanguage,
  ]);

  const isFiltering = filter.trim().length > 0;
  const emptyCollapsed = useMemo(() => new Set<string>(), []);

  // -------------------------------------------------------------------------
  // 平坦化とキーボードカーソル
  // -------------------------------------------------------------------------

  const visibleRows = useMemo(
    () =>
      buildVisibleContentRows(
        filteredSeries,
        // フィルタ中は全展開で一致を見せる
        isFiltering ? emptyCollapsed : collapsedSeriesIds,
        isFiltering ? emptyCollapsed : collapsedCourseIds,
      ),
    [
      filteredSeries,
      isFiltering,
      emptyCollapsed,
      collapsedSeriesIds,
      collapsedCourseIds,
    ],
  );

  const selectedRowId = selectionRowId({
    seriesId: selectedSeriesId,
    courseId: selectedCourseId,
    lessonId: selectedLessonId,
  });

  // 直近のカーソル移動が「外部要因（曼陀羅ナビ等）による追随」なら、その行 ID。
  // ⚠ ref ではなく state で持つ——レンダー中に ref を触るのは React の規則違反。
  // ⚠ ワンショットの boolean にもしないこと——StrictMode で effect が2回走り、
  // 1回目がフラグを消費して2回目が DOM フォーカスを奪ってしまう
  const [externalSyncRowId, setExternalSyncRowId] = useState<string | null>(
    null,
  );

  const focusRow = useCallback((rowId: string | null) => {
    // ツリー内の操作によるカーソル移動。外部同期の印は消す
    setExternalSyncRowId(null);
    setFocusedRowId(rowId);
  }, []);

  /**
   * collapse all: 選択への道（祖先）だけ開いたまま全ノードを畳む。
   *
   * ⚠ **カーソル（グレーの背景）は選択中の行へ寄せる。** メニューを開いた時点で
   * カーソルは右クリックした場所へ移っており、空きスペースから実行したときは
   * 行ですらない（`"area"`）。そのままだと畳んだ後の付け替えが既定の
   * 「先頭の行」＝ホームへ落ち、**選択と無関係なホームがハイライトされる**。
   * 畳んだ直後に見たいのは選択の在り処なので、そこを指させる。
   */
  const collapseAll = useCallback(() => {
    const selection = {
      seriesId: selectedSeriesId,
      courseId: selectedCourseId,
      lessonId: selectedLessonId,
    };
    const targets = resolveCollapseAllTargets(series, selection);
    setCollapsedSeriesIds(new Set(targets.series));
    setCollapsedCourseIds(new Set(targets.courses));
    // 祖先は開いたままなので、選択行は畳んだ後も必ず見えている
    focusRow(selectionRowId(selection));
  }, [
    series,
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    focusRow,
  ]);

  /**
   * カーソル行に実 DOM フォーカスを与える（EBEX FileTreePane と同じ機構）。
   * Shift+F10・メニューキーはブラウザがフォーカス要素に `contextmenu` を
   * 発火させるため、行が実フォーカスを持っていないと行のメニューが出ない。
   */
  const focusRowElement = useCallback((rowId: string | null): boolean => {
    if (!rowId || !scrollRef.current) return false;
    const element = scrollRef.current.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(rowId)}"]`,
    );
    if (!element) return false;
    element.focus({ preventScroll: true });
    return true;
  }, []);

  useEffect(() => {
    if (!focusedRowId || !scrollRef.current) return;
    const escaped = CSS.escape(focusedRowId);
    const element = scrollRef.current.querySelector<HTMLElement>(
      `[data-row-id="${escaped}"]`,
    );
    if (!element) return;
    element.scrollIntoView({ block: "nearest" });
    // 外部要因（曼陀羅ナビ等）の追随では DOM フォーカスを動かさない——
    // 曼陀羅モーダルの再マウント中はフォーカスが一時的に body に落ちるので、
    // 下の「body なら拾う」の規則だとツリーが横取りしてしまう
    if (externalSyncRowId === focusedRowId) return;
    // DOM フォーカスを移すのは、フォーカスが既にツリー内にあるか宙に浮いた
    // （body）ときだけ。モーダルやエディタからフォーカスを奪わないため
    const active = document.activeElement;
    if (active === document.body || scrollRef.current.contains(active)) {
      element.focus({ preventScroll: true });
    }
  }, [focusedRowId, externalSyncRowId]);

  // 選択がツリー外の操作（ミニ曼陀羅・全体曼陀羅のノードクリック等）で
  // 変わったときも、カーソル（背景ハイライト）を選択行へ追随させる。
  // レンダー中の state 調整——ツリー内の操作は focusRow 済みなので no-op
  const [prevSelectedRowId, setPrevSelectedRowId] = useState(selectedRowId);
  // 親（`useWorkspaceSelection`）の選択復元が届く**最初の1回**だけ、その祖先を開く保険。
  // cookie は書いた時点の選択の祖先を除いてあるので通常は不要だが、選択先が消えて
  // フォールバックした等で食い違うと、選択行が畳まれた枝に隠れる。
  // ⚠ 一度きりにすること——常時にすると選択中の行を畳めなくなり、2段構えのクリックが壊れる
  const [initialSelectionApplied, setInitialSelectionApplied] = useState(false);
  if (prevSelectedRowId !== selectedRowId) {
    setPrevSelectedRowId(selectedRowId);
    if (focusedRowId !== selectedRowId) {
      setExternalSyncRowId(selectedRowId);
      setFocusedRowId(selectedRowId);
    }
    if (!initialSelectionApplied) {
      setInitialSelectionApplied(true);
      // ⚠ **開閉の記憶が無いときは祖先を開かない。** サーバーは記憶が無いと判断して
      // 全折りたたみ＋ホーム選択で描いたのに、クライアントの localStorage に残っていた
      // 選択がここへ届くと、その1本だけ枝が開いて「全部閉じて始まる」が崩れる
      // （cookie だけ失効し localStorage が生きている状態で実際に起きる）
      if (restoredFromMemory) {
        if (selectedSeriesId && collapsedSeriesIds.has(selectedSeriesId)) {
          setCollapsedSeriesIds((prev) => {
            const next = new Set(prev);
            next.delete(selectedSeriesId);
            return next;
          });
        }
        if (selectedCourseId && collapsedCourseIds.has(selectedCourseId)) {
          setCollapsedCourseIds((prev) => {
            const next = new Set(prev);
            next.delete(selectedCourseId);
            return next;
          });
        }
      }
    }
  }

  // カーソル行が折りたたみ・絞り込み・削除で消えたら生きている行へ付け替える。
  // 付け替えないと DOM フォーカスの持ち主が消えてキーボード操作が死ぬ。
  // レンダー中の state 調整（React 公式パターン）——Effect にすると
  // 1フレーム古いカーソルで描画される
  const [rowsSnapshot, setRowsSnapshot] = useState(visibleRows);
  if (rowsSnapshot !== visibleRows) {
    const fallbackRowId = resolveFocusFallbackRowId(
      rowsSnapshot,
      visibleRows,
      focusedRowId,
    );
    setRowsSnapshot(visibleRows);
    if (fallbackRowId) setFocusedRowId(fallbackRowId);
  }

  /** 行の共通クラス。背景＝カーソル行・メニュー対象行・ホバーのみ、太字＝選択行のみ */
  const rowClass = useCallback(
    (rowId: string) => {
      const showBg = focusedRowId === rowId || contextMenuRowId === rowId;
      return cn(
        "flex w-full cursor-pointer items-center gap-0.5 rounded-md py-1 text-xs text-foreground outline-none transition-colors [&_svg]:text-current",
        LIST_ROW_X_INSET_CLASS,
        rowId === selectedRowId && "font-semibold",
        showBg ? "bg-workspace-tree-row" : "hover:bg-workspace-tree-row",
      );
    },
    [focusedRowId, contextMenuRowId, selectedRowId],
  );

  const handleContextMenuChange = useCallback(
    (rowId: string | null) => {
      setContextMenuRowId(rowId);
      armMenuGuard();
      if (rowId) focusRow(rowId);
    },
    [armMenuGuard, focusRow],
  );

  const isSeriesExpanded = useCallback(
    (id: string) => !collapsedSeriesIds.has(id),
    [collapsedSeriesIds],
  );
  const isCourseExpanded = useCallback(
    (id: string) => !collapsedCourseIds.has(id),
    [collapsedCourseIds],
  );

  const openRenameDialogForRow = useCallback(
    (row: ContentTreeRow) => {
      if (row.kind === "series") {
        const s = findSeries(row.seriesId);
        if (!s) return;
        setNameDialog({
          title: "シリーズ名を変更",
          label: "シリーズ名",
          initialValue: s.name,
          onSubmit: (name) => onUpdateSeriesName(s.id, name),
        });
        return;
      }
      if (row.kind === "course") {
        const found = findCourse(row.courseId);
        if (!found) return;
        setNameDialog({
          title: "コース名を変更",
          label: "コース名",
          initialValue: found.course.name,
          onSubmit: (name) =>
            onUpdateCourseMeta(
              found.course.id,
              courseRenamePatch(found.course, name),
            ),
        });
        return;
      }
      if (row.kind === "lesson") {
        const found = findLesson(row.lessonId);
        if (!found) return;
        setNameDialog({
          title: "レッスン名を変更",
          label: "レッスン名",
          initialValue: found.lesson.lesson,
          onSubmit: (name) =>
            onUpdateLessonMeta(found.lesson.id, { lesson: name }),
        });
      }
    },
    [
      findSeries,
      findCourse,
      findLesson,
      onUpdateSeriesName,
      onUpdateCourseMeta,
      onUpdateLessonMeta,
    ],
  );

  const openDeleteDialogForRow = useCallback(
    (row: ContentTreeRow) => {
      if (row.kind === "series") {
        const s = findSeries(row.seriesId);
        if (s) setDeleteTarget({ kind: "series", seriesItem: s });
        return;
      }
      if (row.kind === "course") {
        const found = findCourse(row.courseId);
        if (found) {
          setDeleteTarget({
            kind: "course",
            seriesItem: found.seriesItem,
            course: found.course,
          });
        }
        return;
      }
      if (row.kind === "lesson") {
        const found = findLesson(row.lessonId);
        if (found) {
          setDeleteTarget({
            kind: "lesson",
            course: found.course,
            lesson: found.lesson,
          });
        }
      }
    },
    [findSeries, findCourse, findLesson],
  );

  const copyRow = useCallback(
    (row: ContentTreeRow) => {
      if (row.kind === "series") {
        const s = findSeries(row.seriesId);
        if (s) setClipboard({ type: "series", series: s.name });
        return;
      }
      if (row.kind === "course") {
        const found = findCourse(row.courseId);
        if (found) {
          setClipboard({
            type: "course",
            series: found.seriesItem.name,
            course: found.course.name,
          });
        }
        return;
      }
      if (row.kind === "lesson") {
        const found = findLesson(row.lessonId);
        if (found) {
          setClipboard({
            type: "lesson",
            series: found.seriesItem.name,
            course: found.course.name,
            lesson: found.lesson.lesson,
          });
        }
      }
    },
    [findSeries, findCourse, findLesson],
  );

  /** paste の受け入れ規則は右クリックメニューと同じ（series 行=course / course 行=lesson / home=series） */
  const pasteToRow = useCallback(
    (row: ContentTreeRow) => {
      if (!clipboard) return;
      if (row.kind === "home" && clipboard.type === "series") {
        duplicateTo({ type: "series", series: clipboard.series });
        return;
      }
      if (row.kind === "series" && clipboard.type === "course") {
        const s = findSeries(row.seriesId);
        if (!s) return;
        duplicateTo({
          type: "course",
          series: clipboard.series,
          course: clipboard.course,
          targetSeries: s.name,
        });
        return;
      }
      if (row.kind === "course" && clipboard.type === "lesson") {
        const found = findCourse(row.courseId);
        if (!found) return;
        duplicateTo({
          type: "lesson",
          series: clipboard.series,
          course: clipboard.course,
          lesson: clipboard.lesson,
          targetSeries: found.seriesItem.name,
          targetCourse: found.course.name,
        });
      }
    },
    [clipboard, duplicateTo, findSeries, findCourse],
  );

  /** 行クリック相当の動作（Enter キーからも呼ぶ） */
  const activateRow = useCallback(
    (row: ContentTreeRow) => {
      focusRow(row.id);
      if (row.kind === "home") {
        onSelectHome();
        return;
      }
      // 行本体のクリックは2段構え（EBEX の常時トグルとの意図的な差分）:
      // 未選択の行 → 選択し、閉じているときだけ展開（選択目的のクリックで畳まない）
      // 選択済みの行 → 開閉をトグル（もう一度押せば畳める）
      if (row.kind === "series") {
        if (selectedRowId === row.id) {
          toggleSeries(row.seriesId);
        } else {
          onSelectSeries(row.seriesId);
          if (collapsedSeriesIds.has(row.seriesId)) toggleSeries(row.seriesId);
        }
        return;
      }
      if (row.kind === "course") {
        if (selectedRowId === row.id) {
          toggleCourse(row.courseId);
        } else {
          onSelectCourse(row.courseId);
          if (collapsedCourseIds.has(row.courseId)) toggleCourse(row.courseId);
        }
        return;
      }
      onSelectLesson(row.lessonId);
    },
    [
      focusRow,
      onSelectHome,
      onSelectSeries,
      onSelectCourse,
      onSelectLesson,
      toggleSeries,
      toggleCourse,
      collapsedSeriesIds,
      collapsedCourseIds,
      selectedRowId,
    ],
  );

  const handleTreeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (anyDialogOpenRef.current) return;
      if (visibleRows.length === 0) return;

      const resolvedIndex = focusedRowId
        ? visibleRows.findIndex((r) => r.id === focusedRowId)
        : -1;
      const fallbackIndex = visibleRows.findIndex(
        (r) => r.id === selectedRowId,
      );
      const index = resolvedIndex >= 0 ? resolvedIndex : fallbackIndex;
      const row = index >= 0 ? visibleRows[index] : null;

      if (event.ctrlKey && event.key.toLowerCase() === "c") {
        if (!row || row.kind === "home") return;
        event.preventDefault();
        copyRow(row);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "v") {
        if (!row || !clipboard) return;
        event.preventDefault();
        pasteToRow(row);
        return;
      }

      if (event.key === "F2") {
        if (!row || row.kind === "home") return;
        event.preventDefault();
        openRenameDialogForRow(row);
        return;
      }

      if (event.key === "Delete") {
        if (!row || row.kind === "home") return;
        event.preventDefault();
        openDeleteDialogForRow(row);
        return;
      }

      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const navigation = resolveHomeEndNavigation(
          visibleRows,
          index < 0 ? 0 : index,
          event.key,
          event.ctrlKey,
        );
        if (navigation.focusRowId) focusRow(navigation.focusRowId);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = Math.min(index < 0 ? 0 : index + 1, visibleRows.length - 1);
        focusRow(visibleRows[next]?.id ?? null);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const next = Math.max(index < 0 ? 0 : index - 1, 0);
        focusRow(visibleRows[next]?.id ?? null);
        return;
      }

      if (!row) return;

      if (event.key === "Enter") {
        event.preventDefault();
        activateRow(row);
        return;
      }

      if (event.key === "ArrowRight") {
        // 展開済み・レッスン・ホームでも既定動作は必ず止める。素通しさせると
        // ブラウザのフォーカス移動が走り、行内ボタンにリングが出る
        event.preventDefault();
        if (row.kind === "series" && !isSeriesExpanded(row.seriesId)) {
          toggleSeries(row.seriesId);
          focusRow(row.id);
        } else if (row.kind === "course" && !isCourseExpanded(row.courseId)) {
          toggleCourse(row.courseId);
          focusRow(row.id);
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "Backspace") {
        event.preventDefault();
        const navigation = resolveLeftNavigation(row, {
          isSeriesExpanded,
          isCourseExpanded,
        });
        if (!navigation) return;
        if (navigation.collapse) {
          if (navigation.collapse.kind === "series") {
            toggleSeries(navigation.collapse.id);
          } else {
            toggleCourse(navigation.collapse.id);
          }
        }
        if (navigation.focusRowId) focusRow(navigation.focusRowId);
      }
    },
    [
      visibleRows,
      focusedRowId,
      selectedRowId,
      clipboard,
      copyRow,
      pasteToRow,
      openRenameDialogForRow,
      openDeleteDialogForRow,
      focusRow,
      activateRow,
      isSeriesExpanded,
      isCourseExpanded,
      toggleSeries,
      toggleCourse,
    ],
  );

  const openAddSeriesDialog = () => {
    setNameDialog({
      title: "シリーズを追加",
      label: "シリーズ名",
      placeholder: "例: GitHub Actions 完全マスターシリーズ",
      submitLabel: "追加",
      onSubmit: (name) => {
        onAddSeries(name);
      },
    });
  };

  const totalDeleteLabel = (t: DeleteTarget) =>
    t.kind === "series"
      ? t.seriesItem.name
      : t.kind === "course"
        ? t.course.name
        : t.lesson.lesson;

  const deleteBlocked = (t: DeleteTarget) =>
    t.kind === "series"
      ? t.seriesItem.courses.length > 0
      : t.kind === "course"
        ? t.course.lessons.length > 0
        : false;

  const performDelete = (t: DeleteTarget) => {
    if (t.kind === "series") onDeleteSeries(t.seriesItem.id);
    else if (t.kind === "course") onDeleteCourse(t.seriesItem.id, t.course.id);
    else onDeleteLesson(t.course.id, t.lesson.id);
  };

  // 空きスペース・ホーム行で共通のメニュー項目
  const areaContextMenuItems = (
    <>
      <ContextMenuItem
        variant="muted"
        onClick={() => {
          armMenuGuard();
          openAddSeriesDialog();
        }}
      >
        <FolderPlus className="size-4" />
        add series
      </ContextMenuItem>
      <ContextMenuItem
        variant="muted"
        onClick={() => {
          armMenuGuard();
          collapseAll();
        }}
      >
        <ChevronsDownUp className="size-4" />
        collapse all
      </ContextMenuItem>
      <ContextMenuItem
        variant="muted"
        disabled={clipboard?.type !== "series"}
        onClick={() => {
          armMenuGuard();
          if (clipboard?.type !== "series") return;
          duplicateTo({ type: "series", series: clipboard.series });
        }}
      >
        <ClipboardPaste className="size-4" />
        paste
      </ContextMenuItem>
      <ContextMenuItem
        variant="muted"
        onClick={() => {
          armMenuGuard();
          revealInOs({});
        }}
      >
        <FolderOpen className="size-4" />
        open explorer
      </ContextMenuItem>
    </>
  );

  const isHomeSelected = selectedRowId === HOME_ROW_ID;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <PaneWheelRoot scrollRef={scrollRef} className="min-h-0 flex-1">
        {/* ヘッダーはページ背景（グレー）——EBEX ペイン1 と同じ見え方 */}
        <SidebarHeader className="flex h-12 shrink-0 flex-row items-center gap-0 border-b border-border bg-background px-3 py-0">
          {/* 折りたたみ時はロゴだけ。展開ボタンは本文の最上部が持つ。
              ロゴと名前はホームへの入口——ツリー最上部のホーム行と同じ
              （カーソルも動かす）ので、行が画面外まで送られていても戻れる */}
          <button
            type="button"
            /* ホバーは不透明度をわずかに下げるだけ——公開サイトの左上ロゴ
               （Nextra テーマが当てている `hover:opacity-75`）と同じ言葉遣いにして、
               両アプリの左上を同じ触り心地にする。
               ⚠ 色・背景は変えない。変えると右上のボタン群と同じ語彙になり、
               「見出し」と「操作」の区別が消える（2026-08-19 の「何も変えない」
               からの変更・2026-08-20）。
               ⚠ `cursor-pointer` は素の `<button>` だから要る。Tailwind v4 の
               preflight が `button` を `cursor: default` にするため、共有 Button を
               経由しない操作要素は自分で指定する */
            className="flex w-full cursor-pointer items-center gap-2 overflow-hidden text-left text-foreground outline-none transition-opacity hover:opacity-75 focus-visible:outline-none"
            aria-label="ホームを表示"
            onClick={() => {
              focusRow(HOME_ROW_ID);
              onSelectHome();
            }}
          >
            <GraduationCap className="h-5 w-5 flex-shrink-0 text-primary" />
            {!isCollapsed && (
              <span className="truncate text-sm font-bold sidebar-label">
                {workspaceName}
              </span>
            )}
          </button>
        </SidebarHeader>

        {!isCollapsed && (
          <div className="relative flex shrink-0 items-center gap-2 px-3 py-2">
            {/* 検索行の余白の右クリック。入力欄をトリガの subtree に入れないことで
                ブラウザ標準のテキストメニュー（貼り付け等）を残す——Base UI の
                トリガは capture 段で native メニューを打ち消すため、子からの
                stopPropagation では止められない（EBEX FileTreePane と同じ手法） */}
            <ContextMenu
              onOpenChange={(open) =>
                handleContextMenuChange(open ? "area" : null)
              }
            >
              <ContextMenuTrigger
                render={<div className="absolute inset-0" aria-hidden="true" />}
              />
              <ContextMenuContent>{areaContextMenuItems}</ContextMenuContent>
            </ContextMenu>
            <Search className="pointer-events-none relative z-10 size-4 shrink-0 text-muted-foreground" />
            <div className="relative z-10 min-w-0 flex-1">
              <Input
                value={filter}
                onChange={(e) => handleFilterChange(e.target.value)}
                placeholder="Filter... (? to search contents)"
                className="h-8 pr-8"
              />
              {filter ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute inset-y-0 right-0.5 my-auto"
                  aria-label="検索をクリア"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    clearSearchFilter();
                  }}
                  onClick={clearSearchFilter}
                >
                  <X className="size-3.5" />
                </Button>
              ) : null}
            </div>
            <Pane1Toggle className="relative z-10" />
          </div>
        )}

        {!isCollapsed && contentSearching ? (
          <p className="px-3 pb-2 text-xs text-muted-foreground">検索中…</p>
        ) : null}
        {!isCollapsed && !contentSearching && contentTruncated ? (
          <p className="px-3 pb-2 text-xs text-muted-foreground">
            200 件を超える一致がありました。検索を絞り込んでください
          </p>
        ) : null}

        <SidebarContent
          ref={scrollRef}
          tabIndex={0}
          onKeyDown={handleTreeKeyDown}
          onMouseDown={() => {
            if (anyDialogOpenRef.current) return;
            // DOM フォーカスの持ち主はカーソル行。行が無いときだけコンテナが受ける
            if (!focusRowElement(focusedRowId)) scrollRef.current?.focus();
          }}
          className={cn(
            "overflow-y-auto overscroll-y-contain py-2 outline-none",
            isCollapsed ? "px-0" : PANE_LIST_CONTENT_X_INSET_CLASS,
          )}
        >
          {isCollapsed ? (
            /* 折りたたみ時の展開ボタン。ヘッダーはロゴだけなので本文の最上部が持つ */
            <div className="flex justify-center">
              <Pane1Toggle />
            </div>
          ) : (
            <div className="flex min-h-full flex-col">
              {/* ホーム行（インデント・ガイド線の外） */}
              <ContextMenu
                onOpenChange={(open) =>
                  handleContextMenuChange(open ? HOME_ROW_ID : null)
                }
              >
                <ContextMenuTrigger
                  render={
                    <div
                      data-row-id={HOME_ROW_ID}
                      tabIndex={-1}
                      className={rowClass(HOME_ROW_ID)}
                      onClick={() => {
                        if (isMenuGuarded()) return;
                        focusRow(HOME_ROW_ID);
                        onSelectHome();
                      }}
                    >
                      <span
                        className="flex size-5 shrink-0 items-center justify-center"
                        aria-hidden="true"
                      >
                        <House className="size-3.5" />
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-left sidebar-label",
                          isHomeSelected && "font-semibold",
                        )}
                      >
                        {homeRowLabel(editLanguage)}
                      </span>
                    </div>
                  }
                />
                <ContextMenuContent>{areaContextMenuItems}</ContextMenuContent>
              </ContextMenu>

              {filteredSeries.length > 0 && (
                <DndContext
                  id="tree-series-dnd"
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSeriesDragEnd}
                >
                  <SortableContext
                    items={filteredSeries.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-0.5">
                      {filteredSeries.map((s) => (
                        <SeriesNode
                          key={s.id}
                          seriesItem={s}
                          isExpanded={
                            isFiltering || !collapsedSeriesIds.has(s.id)
                          }
                          onToggle={() => toggleSeries(s.id)}
                          isFiltering={isFiltering}
                          collapsedCourseIds={collapsedCourseIds}
                          onToggleCourse={toggleCourse}
                          selectedSeriesId={selectedSeriesId}
                          rowClass={rowClass}
                          onActivateRow={activateRow}
                          onContextMenuChange={handleContextMenuChange}
                          editLanguage={editLanguage}
                          onReorderCourses={onReorderCourses}
                          onReorderLessons={onReorderLessons}
                          onUpdateLessonStatus={onUpdateLessonStatus}
                          sensors={sensors}
                          clipboard={clipboard}
                          setClipboard={setClipboard}
                          duplicateTo={duplicateTo}
                          revealInOs={revealInOs}
                          armMenuGuard={armMenuGuard}
                          isMenuGuarded={isMenuGuarded}
                          setNameDialog={setNameDialog}
                          setDeleteTarget={setDeleteTarget}
                          onAddCourse={onAddCourse}
                          onAddLesson={onAddLesson}
                          onUpdateSeriesName={onUpdateSeriesName}
                          onUpdateCourseMeta={onUpdateCourseMeta}
                          onUpdateLessonMeta={onUpdateLessonMeta}
                          findCourse={findCourse}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {/* 空きスペース: ツリーの残り全域。右クリックで全体メニュー */}
              <ContextMenu
                onOpenChange={(open) =>
                  handleContextMenuChange(open ? "area" : null)
                }
              >
                <ContextMenuTrigger
                  render={
                    <div className="min-h-10 flex-1">
                      {series.length === 0 && (
                        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                          シリーズがありません。
                          <br />
                          右クリックからシリーズを追加できます。
                        </p>
                      )}
                      {series.length > 0 &&
                        filteredSeries.length === 0 &&
                        isFiltering && (
                          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                            {contentSearching
                              ? "検索中…"
                              : "一致するコンテンツがありません"}
                          </p>
                        )}
                    </div>
                  }
                />
                <ContextMenuContent>{areaContextMenuItems}</ContextMenuContent>
              </ContextMenu>
            </div>
          )}
        </SidebarContent>
      </PaneWheelRoot>

      {/* ダイアログ群 */}
      {nameDialog && (
        <NameDialog
          open
          onOpenChange={(open) => {
            if (!open) setNameDialog(null);
          }}
          title={nameDialog.title}
          label={nameDialog.label}
          placeholder={nameDialog.placeholder}
          initialValue={nameDialog.initialValue}
          submitLabel={nameDialog.submitLabel}
          onSubmit={nameDialog.onSubmit}
        />
      )}

      {/* 削除確認 / 削除不可 */}
      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        {deleteTarget && (
          <DialogContent>
            {deleteBlocked(deleteTarget) ? (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {deleteTarget.kind === "series"
                      ? "シリーズを削除できません"
                      : "コースを削除できません"}
                  </DialogTitle>
                  <DialogDescription>
                    {deleteTarget.kind === "series"
                      ? `「${deleteTarget.seriesItem.name}」にはコースが ${deleteTarget.seriesItem.courses.length} 件あります。先にコースを削除してください。`
                      : deleteTarget.kind === "course"
                        ? `「${deleteTarget.course.name}」にはレッスンが ${deleteTarget.course.lessons.length} 件あります。先にレッスンを削除してください。`
                        : ""}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={() => setDeleteTarget(null)}>閉じる</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {deleteTarget.kind === "series"
                      ? "シリーズを削除しますか？"
                      : deleteTarget.kind === "course"
                        ? "コースを削除しますか？"
                        : "レッスンを削除しますか？"}
                  </DialogTitle>
                  <DialogDescription>
                    「{totalDeleteLabel(deleteTarget)}
                    」を削除します。この操作は元に戻せません。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                    キャンセル
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      performDelete(deleteTarget);
                      setDeleteTarget(null);
                    }}
                  >
                    削除
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        )}
      </Dialog>
    </Sidebar>
  );
}

// ---------------------------------------------------------------------------
// ツリーノード
// ---------------------------------------------------------------------------

type NodeSharedProps = {
  clipboard: ClipboardItem | null;
  setClipboard: (item: ClipboardItem | null) => void;
  duplicateTo: (payload: Record<string, string>) => void;
  revealInOs: (target: {
    series?: string;
    course?: string;
    lesson?: string;
  }) => void;
  armMenuGuard: () => void;
  isMenuGuarded: () => boolean;
  setNameDialog: (dialog: NameDialogState | null) => void;
  setDeleteTarget: (target: DeleteTarget | null) => void;
  rowClass: (rowId: string) => string;
  onActivateRow: (row: ContentTreeRow) => void;
  onContextMenuChange: (rowId: string | null) => void;
  /**
   * 行に出す名前の言語（studio-translation spec）。
   * ⚠ **表示だけ**に使う。並べ替え・選択・API のパス解決に使う名前は
   * 日本語のフォルダ名のままで、そちらを言語で切り替えてはならない。
   */
  editLanguage: EditLanguage;
};

/**
 * 子コンテナのガイド線付きインデント（EBEX と同じ `border-l` 方式）。
 * ⚠ 数値は EBEX（`ml-[9px] pl-[7px]`）と揃えない——EBEX の行インセットは
 * `px-1`（4px）だがこちらは `px-2.5`（10px）で、同じ `ml` だと線が親行の
 * アイコン中心から 6px ぶん左へ寄って見える。合わせるのは数値ではなく
 * 「線とアイコン中心の距離」で、EBEX と同じ **−5px**（実測で確認）。
 *
 * `pl` は 0（tree-indent-tighten）。3 つの区間——青いレール→シリーズ線 13px／
 * シリーズ線→コース線 14px／コース線→レッスンのアイコン 13px——を揃えるため。
 * `ml` は線の位置なので動かさない（シリーズ線は据え置き、コース線はコース行と一緒に
 * 7px 左へ寄る）。線と中身の隙間は行の左余白（10px）とアイコン枠の余白（2〜3px）が
 * 担保するので、`pl` 0 でも密着しない。13 / 13 / 13 は `ml` とレールも動かす必要があり、
 * 1px の差に見合わないので採らなかった。
 * 1階層あたりのインデント総量は 14 + 1 + 0 = 15px（EBEX は 17px）。
 */
const CHILDREN_GUIDE_CLASS =
  "ml-[14px] flex flex-col gap-0.5 border-l border-border pl-0";

function SeriesNode({
  seriesItem,
  isExpanded,
  onToggle,
  isFiltering,
  collapsedCourseIds,
  onToggleCourse,
  selectedSeriesId,
  onReorderCourses,
  onReorderLessons,
  onUpdateLessonStatus,
  sensors,
  onAddCourse,
  onAddLesson,
  onUpdateSeriesName,
  onUpdateCourseMeta,
  onUpdateLessonMeta,
  findCourse,
  ...shared
}: NodeSharedProps & {
  seriesItem: Series;
  isExpanded: boolean;
  onToggle: () => void;
  isFiltering: boolean;
  collapsedCourseIds: Set<string>;
  onToggleCourse: (id: string) => void;
  selectedSeriesId: string;
  onReorderCourses: (seriesId: string, from: number, to: number) => void;
  onReorderLessons: (courseId: string, from: number, to: number) => void;
  onUpdateLessonStatus: (lessonId: string, status: Lesson["status"]) => void;
  sensors: ReturnType<typeof useSensors>;
  onAddCourse: (seriesId: string, name: string) => void;
  onAddLesson: (courseId: string, name: string) => void;
  onUpdateSeriesName: (seriesId: string, name: string) => void;
  onUpdateCourseMeta: Props["onUpdateCourseMeta"];
  onUpdateLessonMeta: Props["onUpdateLessonMeta"];
  findCourse: (
    courseId: string,
  ) => { seriesItem: Series; course: Course } | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: seriesItem.id });

  const style = {
    transform: DndCss.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const allLessons = seriesItem.courses.flatMap((c) => c.lessons);
  const doneLessons = allLessons.filter((l) => l.status === "done").length;

  const rowId = seriesRowId(seriesItem.id);
  // 現在の選択（ホーム以外）を含むシリーズブロックに青い縦レールを出す。
  // ドラッグ中はレールを出さない（DnD の視覚が主役）
  const hasSelection = selectedSeriesId === seriesItem.id;

  const row: ContentTreeRow = {
    id: rowId,
    kind: "series",
    seriesId: seriesItem.id,
    depth: 0,
  };

  const handleCourseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = seriesItem.courses.findIndex((c) => c.id === active.id);
    const toIndex = seriesItem.courses.findIndex((c) => c.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorderCourses(seriesItem.id, fromIndex, toIndex);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex flex-col",
        hasSelection &&
          !isDragging &&
          "before:absolute before:inset-y-0 before:-left-0.5 before:w-[3px] before:rounded-full before:bg-primary before:content-['']",
      )}
    >
      <ContextMenu
        onOpenChange={(open) => shared.onContextMenuChange(open ? rowId : null)}
      >
        <ContextMenuTrigger
          render={
            <div
              data-row-id={rowId}
              tabIndex={-1}
              className={cn("group/tree-series", shared.rowClass(rowId))}
              onClick={() => {
                if (shared.isMenuGuarded()) return;
                shared.onActivateRow(row);
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (shared.isMenuGuarded()) return;
                  onToggle();
                }}
                className="flex-shrink-0 rounded p-0.5 text-muted-foreground outline-none hover:bg-muted/80 focus-visible:outline-none"
                aria-label={isExpanded ? "シリーズを折りたたむ" : "シリーズを展開"}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              <span
                {...attributes}
                {...listeners}
                className="min-w-0 flex-1 truncate text-left group-hover/tree-series:cursor-grab active:cursor-grabbing sidebar-label"
              >
                {seriesDisplayName(seriesItem, shared.editLanguage)}
              </span>
              {/* シリーズ配下の完了レッスン数 / 総レッスン数（右寄せ・青系） */}
              <span className="ml-auto flex-shrink-0 pr-1 text-[10px] font-medium text-primary sidebar-label">
                {doneLessons}/{allLessons.length}
              </span>
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setNameDialog({
                title: "コースを追加",
                label: "コース名",
                placeholder: "例: Git 環境構築コース",
                submitLabel: "追加",
                onSubmit: (name) => onAddCourse(seriesItem.id, name),
              });
            }}
          >
            <FolderPlus className="size-4" />
            add course
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setNameDialog({
                title: "シリーズ名を変更",
                label: "シリーズ名",
                initialValue: seriesItem.name,
                onSubmit: (name) => onUpdateSeriesName(seriesItem.id, name),
              });
            }}
          >
            <Pencil className="size-4" />
            rename
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setClipboard({ type: "series", series: seriesItem.name });
            }}
          >
            <Copy className="size-4" />
            copy
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            disabled={shared.clipboard?.type !== "course"}
            onClick={() => {
              shared.armMenuGuard();
              const clip = shared.clipboard;
              if (clip?.type !== "course") return;
              shared.duplicateTo({
                type: "course",
                series: clip.series,
                course: clip.course,
                targetSeries: seriesItem.name,
              });
            }}
          >
            <ClipboardPaste className="size-4" />
            paste
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.revealInOs({ series: seriesItem.name });
            }}
          >
            <FolderOpen className="size-4" />
            open explorer
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => {
              shared.armMenuGuard();
              shared.setDeleteTarget({ kind: "series", seriesItem });
            }}
          >
            <Trash2 className="size-4" />
            delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && seriesItem.courses.length > 0 && (
        <div className={CHILDREN_GUIDE_CLASS}>
          <DndContext
            id={`tree-course-dnd-${seriesItem.id}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCourseDragEnd}
          >
            <SortableContext
              items={seriesItem.courses.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {seriesItem.courses.map((c) => (
                <CourseNode
                  key={c.id}
                  seriesItem={seriesItem}
                  course={c}
                  isExpanded={isFiltering || !collapsedCourseIds.has(c.id)}
                  onToggle={() => onToggleCourse(c.id)}
                  onReorderLessons={onReorderLessons}
                  onUpdateLessonStatus={onUpdateLessonStatus}
                  sensors={sensors}
                  onAddLesson={onAddLesson}
                  onUpdateCourseMeta={onUpdateCourseMeta}
                  onUpdateLessonMeta={onUpdateLessonMeta}
                  findCourse={findCourse}
                  {...shared}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function CourseNode({
  seriesItem,
  course,
  isExpanded,
  onToggle,
  onReorderLessons,
  onUpdateLessonStatus,
  sensors,
  onAddLesson,
  onUpdateCourseMeta,
  onUpdateLessonMeta,
  findCourse,
  ...shared
}: NodeSharedProps & {
  seriesItem: Series;
  course: Course;
  isExpanded: boolean;
  onToggle: () => void;
  onReorderLessons: (courseId: string, from: number, to: number) => void;
  onUpdateLessonStatus: (lessonId: string, status: Lesson["status"]) => void;
  sensors: ReturnType<typeof useSensors>;
  onAddLesson: (courseId: string, name: string) => void;
  onUpdateCourseMeta: Props["onUpdateCourseMeta"];
  onUpdateLessonMeta: Props["onUpdateLessonMeta"];
  findCourse: (
    courseId: string,
  ) => { seriesItem: Series; course: Course } | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: course.id });

  const style = {
    transform: DndCss.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const rowId = courseRowId(course.id);
  const row: ContentTreeRow = {
    id: rowId,
    kind: "course",
    seriesId: seriesItem.id,
    courseId: course.id,
    depth: 1,
  };

  const handleLessonDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = course.lessons.findIndex((l) => l.id === active.id);
    const toIndex = course.lessons.findIndex((l) => l.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorderLessons(course.id, fromIndex, toIndex);
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ContextMenu
        onOpenChange={(open) => shared.onContextMenuChange(open ? rowId : null)}
      >
        <ContextMenuTrigger
          render={
            <div
              data-row-id={rowId}
              tabIndex={-1}
              className={cn("group/tree-course", shared.rowClass(rowId))}
              onClick={() => {
                if (shared.isMenuGuarded()) return;
                shared.onActivateRow(row);
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (shared.isMenuGuarded()) return;
                  onToggle();
                }}
                className="flex-shrink-0 rounded p-0.5 text-muted-foreground outline-none hover:bg-muted/80 focus-visible:outline-none"
                aria-label={isExpanded ? "コースを折りたたむ" : "コースを展開"}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              <span
                {...attributes}
                {...listeners}
                className="min-w-0 flex-1 truncate text-left group-hover/tree-course:cursor-grab active:cursor-grabbing sidebar-label"
              >
                {courseDisplayName(course, shared.editLanguage)}
              </span>
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setNameDialog({
                title: "レッスンを追加",
                label: "レッスン名",
                placeholder: "例: Gitのインストール手順",
                submitLabel: "追加",
                onSubmit: (name) => onAddLesson(course.id, name),
              });
            }}
          >
            <FilePlus className="size-4" />
            add lesson
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setNameDialog({
                title: "コース名を変更",
                label: "コース名",
                initialValue: course.name,
                onSubmit: (name) => {
                  const found = findCourse(course.id);
                  if (!found) return;
                  onUpdateCourseMeta(
                    course.id,
                    courseRenamePatch(found.course, name),
                  );
                },
              });
            }}
          >
            <Pencil className="size-4" />
            rename
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setClipboard({
                type: "course",
                series: seriesItem.name,
                course: course.name,
              });
            }}
          >
            <Copy className="size-4" />
            copy
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            disabled={shared.clipboard?.type !== "lesson"}
            onClick={() => {
              shared.armMenuGuard();
              const clip = shared.clipboard;
              if (clip?.type !== "lesson") return;
              shared.duplicateTo({
                type: "lesson",
                series: clip.series,
                course: clip.course,
                lesson: clip.lesson,
                targetSeries: seriesItem.name,
                targetCourse: course.name,
              });
            }}
          >
            <ClipboardPaste className="size-4" />
            paste
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.revealInOs({
                series: seriesItem.name,
                course: course.name,
              });
            }}
          >
            <FolderOpen className="size-4" />
            open explorer
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => {
              shared.armMenuGuard();
              shared.setDeleteTarget({ kind: "course", seriesItem, course });
            }}
          >
            <Trash2 className="size-4" />
            delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && course.lessons.length > 0 && (
        <div className={CHILDREN_GUIDE_CLASS}>
          <DndContext
            id={`tree-lesson-dnd-${course.id}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleLessonDragEnd}
          >
            <SortableContext
              items={course.lessons.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              {course.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  seriesItem={seriesItem}
                  course={course}
                  lesson={lesson}
                  onUpdateLessonStatus={onUpdateLessonStatus}
                  onUpdateLessonMeta={onUpdateLessonMeta}
                  {...shared}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function LessonRow({
  seriesItem,
  course,
  lesson,
  onUpdateLessonStatus,
  onUpdateLessonMeta,
  ...shared
}: NodeSharedProps & {
  seriesItem: Series;
  course: Course;
  lesson: Lesson;
  onUpdateLessonStatus: (lessonId: string, status: Lesson["status"]) => void;
  onUpdateLessonMeta: Props["onUpdateLessonMeta"];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson.id });

  const style = {
    transform: DndCss.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const rowId = lessonRowId(lesson.id);
  const row: ContentTreeRow = {
    id: rowId,
    kind: "lesson",
    seriesId: seriesItem.id,
    courseId: course.id,
    lessonId: lesson.id,
    depth: 2,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ContextMenu
        onOpenChange={(open) => shared.onContextMenuChange(open ? rowId : null)}
      >
        <ContextMenuTrigger
          render={
            <div
              data-row-id={rowId}
              tabIndex={-1}
              className={cn("group/tree-lesson", shared.rowClass(rowId))}
              onClick={() => {
                if (shared.isMenuGuarded()) return;
                shared.onActivateRow(row);
              }}
            >
              <LessonRowIcon />
              <span
                {...attributes}
                {...listeners}
                className="min-w-0 flex-1 truncate text-left group-hover/tree-lesson:cursor-grab active:cursor-grabbing sidebar-label"
              >
                {lessonDisplayName(lesson, shared.editLanguage)}
              </span>
              {/* ステータスボタン（右寄せ・クリックで循環。行選択は発生させない） */}
              <WorkspaceTooltip
                label={STATUS_ICON[lesson.status].label}
                render={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (shared.isMenuGuarded()) return;
                      onUpdateLessonStatus(lesson.id, STATUS_CYCLE[lesson.status]);
                    }}
                    className="ml-auto flex-shrink-0 pr-1 text-muted-foreground outline-none transition-opacity hover:opacity-70 focus-visible:outline-none sidebar-label"
                    aria-label={`${STATUS_ICON[lesson.status].label}、クリックで変更`}
                  >
                    {STATUS_ICON[lesson.status].icon}
                  </button>
                }
              />
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setNameDialog({
                title: "レッスン名を変更",
                label: "レッスン名",
                initialValue: lesson.lesson,
                onSubmit: (name) => onUpdateLessonMeta(lesson.id, { lesson: name }),
              });
            }}
          >
            <Pencil className="size-4" />
            rename
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setClipboard({
                type: "lesson",
                series: seriesItem.name,
                course: course.name,
                lesson: lesson.lesson,
              });
            }}
          >
            <Copy className="size-4" />
            copy
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.revealInOs({
                series: seriesItem.name,
                course: course.name,
                lesson: lesson.lesson,
              });
            }}
          >
            <FolderOpen className="size-4" />
            open explorer
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => {
              shared.armMenuGuard();
              shared.setDeleteTarget({ kind: "lesson", course, lesson });
            }}
          >
            <Trash2 className="size-4" />
            delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
