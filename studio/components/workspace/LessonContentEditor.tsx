"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useState,
  useEffect,
} from "react";
import {
  EditorState,
  StateEffect,
  Transaction,
  ChangeSet,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { cn } from "@/lib/utils";
import {
  buildLessonEditorExtensions,
  buildLessonEditorStateExtensions,
  lessonEditorThemeCompartment,
} from "@/lib/lesson-content-editor-setup";
import {
  lessonSearchHighlight,
  lessonSearchHighlightCompartment,
} from "@/lib/lesson-search-highlight";
import {
  getLessonEditorStateCache,
  setLessonEditorStateCache,
} from "@/lib/lesson-editor-state-cache";
import { useResolvedDarkMode } from "@/lib/use-resolved-dark-mode";
import {
  clampEditorFontSizePx,
  EDITOR_FONT_SIZE_CHANGED_EVENT,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
} from "@/lib/workspace-settings";

export type LessonContentEditorHandle = {
  insertAtCursor: (markdown: string, options?: { focus?: boolean }) => void;
  getScrollElement: () => HTMLElement | null;
  getCursorOffset: () => number;
};

type Props = {
  lessonId: string;
  value: string;
  onChange: (value: string) => void;
  onScrollElementReady?: (element: HTMLElement | null) => void;
  onCursorChange?: (offset: number) => void;
  /** ペイン1 の中身検索の語。一致箇所の地色を塗る */
  searchHighlightQuery?: string;
  className?: string;
};

export const LessonContentEditor = forwardRef<
  LessonContentEditorHandle,
  Props
>(function LessonContentEditor(
  {
    lessonId,
    value,
    onChange,
    onScrollElementReady,
    onCursorChange,
    searchHighlightQuery,
    className,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lessonIdRef = useRef(lessonId);
  const onChangeRef = useRef(onChange);
  const onCursorChangeRef = useRef(onCursorChange);
  const onScrollElementReadyRef = useRef(onScrollElementReady);
  onChangeRef.current = onChange;
  onCursorChangeRef.current = onCursorChange;
  onScrollElementReadyRef.current = onScrollElementReady;

  const isDark = useResolvedDarkMode();
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  const searchQueryRef = useRef(searchHighlightQuery);
  searchQueryRef.current = searchHighlightQuery;

  const [fontSizePx, setFontSizePx] = useState(() =>
    clampEditorFontSizePx(loadWorkspaceSettings().editorFontSizePx),
  );
  const fontSizeRef = useRef(fontSizePx);
  fontSizeRef.current = fontSizePx;

  const handleFontSizeChange = useCallback((next: number) => {
    const clamped = clampEditorFontSizePx(next);
    setFontSizePx(clamped);
    const settings = loadWorkspaceSettings();
    saveWorkspaceSettings({ ...settings, editorFontSizePx: clamped });
  }, []);

  useEffect(() => {
    const onExternalFontSize = (event: Event) => {
      const px = (event as CustomEvent<{ px: number }>).detail?.px;
      if (typeof px === "number") {
        setFontSizePx(clampEditorFontSizePx(px));
      }
    };
    window.addEventListener(EDITOR_FONT_SIZE_CHANGED_EVENT, onExternalFontSize);
    return () =>
      window.removeEventListener(
        EDITOR_FONT_SIZE_CHANGED_EVENT,
        onExternalFontSize,
      );
  }, []);

  const updateListenerExtension = useRef(
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const isRemote = update.transactions.some((tr) =>
          tr.annotation(Transaction.remote),
        );
        if (!isRemote) {
          onChangeRef.current(update.state.doc.toString());
          setLessonEditorStateCache(lessonIdRef.current, update.state);
        }
      }
      if (update.selectionSet || update.docChanged) {
        onCursorChangeRef.current?.(update.state.selection.main.head);
      }
    }),
  ).current;

  const buildExtensions = useCallback(
    () =>
      buildLessonEditorStateExtensions(
        isDarkRef.current,
        fontSizeRef.current,
        {
          getFontSize: () => fontSizeRef.current,
          onFontSizeChange: handleFontSizeChange,
          searchHighlightQuery: searchQueryRef.current,
        },
        [updateListenerExtension],
      ),
    [handleFontSizeChange, updateListenerExtension],
  );

  /**
   * キャッシュから復元した state を、**現行インスタンスの構成**へ差し替える effect 一式。
   *
   * ⚠ 全体 reconfigure だけでは足りない——CodeMirror は既存の compartment の中身を
   * 引き継ぐ（`Compartment.of(...)` の新しい内容は無視される）ので、テーマと検索
   * ハイライトは明示的に再設定する。同一 dispatch 内では配列順に処理され、
   * compartment の再設定が全体 reconfigure の上に乗る。
   */
  const buildRestoreEffects = useCallback(
    () => [
      StateEffect.reconfigure.of(buildExtensions()),
      lessonEditorThemeCompartment.reconfigure(
        buildLessonEditorExtensions(isDarkRef.current, fontSizeRef.current, {
          getFontSize: () => fontSizeRef.current,
          onFontSizeChange: handleFontSizeChange,
        }),
      ),
      lessonSearchHighlightCompartment.reconfigure(
        lessonSearchHighlight(searchQueryRef.current),
      ),
    ],
    [buildExtensions, handleFontSizeChange],
  );

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    lessonIdRef.current = lessonId;
    const cached = getLessonEditorStateCache(lessonId);
    const state =
      cached ??
      EditorState.create({
        doc: value,
        extensions: buildExtensions(),
      });

    const view = new EditorView({ state, parent });
    viewRef.current = view;
    onScrollElementReadyRef.current?.(view.scrollDOM);

    if (cached) {
      view.dispatch({ effects: buildRestoreEffects() });
    } else {
      setLessonEditorStateCache(lessonId, state);
    }

    return () => {
      const active = viewRef.current;
      if (active) {
        setLessonEditorStateCache(lessonIdRef.current, active.state);
        active.destroy();
        viewRef.current = null;
        onScrollElementReadyRef.current?.(null);
      }
    };
    // マウント時に一度だけ EditorView を生成（以降は setState / reconfigure で更新）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const prevId = lessonIdRef.current;
    if (prevId === lessonId) return;

    setLessonEditorStateCache(prevId, view.state);

    const cached = getLessonEditorStateCache(lessonId);
    if (cached) {
      view.setState(cached);
      // ⚠ 復元した state は**キャッシュした時点の extension 構成を丸ごと持つ**。
      // その構成にはキャッシュを作ったインスタンスに束縛された extension——
      // 当時のテーマ配色・当時の Ctrl+ホイールハンドラ・そして閉包で
      // `onChangeRef` / `lessonIdRef` を掴んだ **updateListener**——が含まれる。
      // 個別の compartment だけを差し替えると listener が生き残り、日英で
      // エディタを付け替えたときに英語ビューの入力が日本語の保存経路へ流れる
      // （＝`contents.md` が英文で上書きされる事故）。ここで構成**全体**を
      // 現行インスタンスで作り直し、束縛の残骸を一括で断つ。
      // doc・selection・undo 履歴は StateField として保持される。
      view.dispatch({ effects: buildRestoreEffects() });
    } else {
      const nextState = EditorState.create({
        doc: value,
        extensions: buildExtensions(),
      });
      view.setState(nextState);
      setLessonEditorStateCache(lessonId, nextState);
    }

    lessonIdRef.current = lessonId;
    onCursorChangeRef.current?.(view.state.selection.main.head);
  }, [lessonId, value, buildExtensions, buildRestoreEffects]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: lessonEditorThemeCompartment.reconfigure(
        buildLessonEditorExtensions(isDark, fontSizePx, {
          getFontSize: () => fontSizeRef.current,
          onFontSizeChange: handleFontSizeChange,
        }),
      ),
    });
  }, [isDark, fontSizePx, handleFontSizeChange]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: lessonSearchHighlightCompartment.reconfigure(
        lessonSearchHighlight(searchHighlightQuery),
      ),
    });
  }, [searchHighlightQuery]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || lessonIdRef.current !== lessonId) return;

    const current = view.state.doc.toString();
    if (current === value) return;

    const selection = view.state.selection;
    const changes = ChangeSet.of(
      [{ from: 0, to: current.length, insert: value }],
      current.length,
    );
    view.dispatch({
      changes,
      selection: selection.map(changes),
      annotations: Transaction.remote.of(true),
    });
    setLessonEditorStateCache(lessonId, view.state);
  }, [value, lessonId]);

  useImperativeHandle(
    ref,
    () => ({
      insertAtCursor(markdown: string, options?: { focus?: boolean }) {
        const view = viewRef.current;
        if (!view || !markdown) return;
        const doc = view.state.doc;
        const sel = view.state.selection.main;
        let from = Math.min(sel.from, sel.to);
        let to = Math.max(sel.from, sel.to);
        from = Math.max(0, Math.min(from, doc.length));
        to = Math.max(from, Math.min(to, doc.length));
        const cursor = from + markdown.length;
        view.dispatch({
          changes: { from, to, insert: markdown },
          selection: { anchor: cursor, head: cursor },
          scrollIntoView: true,
        });
        onChangeRef.current(view.state.doc.toString());
        setLessonEditorStateCache(lessonIdRef.current, view.state);
        if (options?.focus !== false) {
          view.focus();
        }
      },
      getScrollElement() {
        return viewRef.current?.scrollDOM ?? null;
      },
      getCursorOffset() {
        return viewRef.current?.state.selection.main.head ?? 0;
      },
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "lesson-content-editor h-full min-h-0 min-w-0 flex-1 [&_.cm-editor]:h-full",
        isDark && "lesson-content-editor--dark",
        className,
      )}
    />
  );
});
