import { markdown, markdownLanguage, markdownKeymap } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { Compartment, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { languages } from "@codemirror/language-data";
import { foldService } from "@codemirror/language";
import { lessonFoldGutter } from "@/lib/lesson-fold-gutter";
import {
  lessonSearchHighlight,
  lessonSearchHighlightCompartment,
} from "@/lib/lesson-search-highlight";
import { EditorView, lineNumbers } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import { vscodeDarkInit, vscodeLightInit } from "@uiw/codemirror-theme-vscode";
import {
  activeLineRowHighlight,
  LESSON_ACTIVE_LINE_BG,
  LESSON_LINE_NUMBER_DARK,
  LESSON_LINE_NUMBER_LIGHT,
} from "@/lib/lesson-active-line-number";
import { getFoldRangeAtLine } from "@/lib/markdown-fold-ranges";
import { clampEditorFontSizePx } from "@/lib/workspace-settings";

/** テーマ・フォントサイズを setState なしで差し替える Compartment（モジュール共有） */
export const lessonEditorThemeCompartment = new Compartment();

/** Pane3 編集ビュー: テキスト選択の背景・文字色（VS Code 既定 #add6ff を上書き） */
const LESSON_EDITOR_SELECTION_BG = "#3367d1";
const LESSON_EDITOR_SELECTION_FG = "#ffffff";

const lessonEditorSelectionTheme = EditorView.theme({
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection, .cm-line::selection":
    {
      backgroundColor: `${LESSON_EDITOR_SELECTION_BG} !important`,
      color: `${LESSON_EDITOR_SELECTION_FG} !important`,
    },
});

/**
 * @codemirror/search の検索パネルは素の DOM（無地の input/button/label）を出すだけで、
 * ワークスペース全体のデザイン（shadcn ベース・角丸・ロールトークン色）から浮いて見えるため、
 * ロールトークンの CSS 変数（var(--card) 等）でパネルの見た目のみを上書きする。
 * 検索の挙動自体（@codemirror/search 標準機能）には手を入れない。
 */
const lessonSearchPanelTheme = EditorView.theme({
  ".cm-panel.cm-search": {
    // display は初期値（block）のまま。CodeMirror 自身が Find 行と Replace 行の間に
    // 挿入する <br>（改行）が効くようにするため、flex 化してはいけない
    // （flex コンテナ内では <br> が改行として機能しない）
    padding: "0.5rem 2rem 0.5rem 0.5rem",
    backgroundColor: "var(--card)",
    color: "var(--card-foreground)",
    borderBottom: "1px solid var(--border)",
    "& [name=close]": {
      top: "0.375rem",
      right: "0.5rem",
      color: "var(--muted-foreground)",
      borderRadius: "var(--radius-sm)",
      width: "1.25rem",
      height: "1.25rem",
      lineHeight: "1",
    },
    "& [name=close]:hover": {
      backgroundColor: "var(--muted)",
      color: "var(--foreground)",
    },
    "& input, & button, & label": {
      margin: "0 0.375rem 0.375rem 0",
      verticalAlign: "middle",
    },
    // 「all」（selectMatches）ボタンは不要なため非表示にする
    "& [name=select]": {
      display: "none",
    },
    // 「by word」（単語単位一致）オプションは不要なため非表示にする
    "& label:has(input[name=word])": {
      display: "none",
    },
  },
  ".cm-panel.cm-search .cm-textfield": {
    border: "1px solid var(--input)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    padding: "0.25rem 0.5rem",
    fontSize: "0.8125rem",
    outline: "none",
  },
  ".cm-panel.cm-search .cm-textfield:focus": {
    borderColor: "var(--ring)",
    boxShadow: "0 0 0 2px color-mix(in oklab, var(--ring) 30%, transparent)",
  },
  ".cm-panel.cm-search .cm-button": {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--muted)",
    color: "var(--foreground)",
    padding: "0.25rem 0.625rem",
    fontSize: "0.8125rem",
    backgroundImage: "none",
    cursor: "pointer",
  },
  ".cm-panel.cm-search .cm-button:hover": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-panel.cm-search label": {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    marginLeft: "0.25rem",
    fontSize: "0.75rem",
    color: "var(--muted-foreground)",
    whiteSpace: "pre",
  },
  ".cm-panel.cm-search input[type=checkbox]": {
    accentColor: "var(--primary)",
    margin: 0,
    verticalAlign: "middle",
  },
});

function editorLineHeightPx(fontSizePx: number): number {
  return Math.round(fontSizePx * 1.375);
}

function editorGutterFontSizePx(fontSizePx: number): number {
  return Math.round((fontSizePx * 11) / 14);
}

function createLessonEditorLayout(
  fontSizePx: number,
  lineNumberColor: string,
  isDark: boolean,
) {
  const lineHeightPx = editorLineHeightPx(fontSizePx);
  const gutterFontPx = editorGutterFontSizePx(fontSizePx);
  const editorBg = isDark ? "#1e1e1e" : "#ffffff";
  return EditorView.theme(
    {
      "&": { height: "100%", backgroundColor: editorBg },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": {
        overflow: "auto",
        overscrollBehavior: "contain",
        backgroundColor: editorBg,
        // 正本は globals.css の `--font-code`（プレビュー・差分と共有）
        fontFamily: "var(--font-code)",
        fontSize: `${fontSizePx}px`,
        lineHeight: `${lineHeightPx}px`,
      },
      ".cm-content": {
        padding: "0.75rem 0",
        caretColor: "var(--foreground)",
        backgroundColor: editorBg,
      },
      ".cm-gutters": {
        backgroundColor: isDark
          ? "#1e1e1e"
          : "color-mix(in oklab, var(--muted) 20%, transparent)",
        borderRight: "none",
        color: `${lineNumberColor} !important`,
        fontSize: `${gutterFontPx}px`,
        lineHeight: `${lineHeightPx}px`,
      },
      ".lesson-fold-gutter .cm-gutterElement": {
        padding: "0 2px",
        color: lineNumberColor,
        cursor: "default",
        width: "100%",
        boxSizing: "border-box",
      },
      ".lesson-fold-gutter .cm-gutterElement:has(.lesson-fold-icon)": {
        cursor: "pointer",
      },
      ".lesson-fold-gutter .lesson-fold-icon, .lesson-fold-gutter span.lesson-fold-open, .lesson-fold-gutter span.lesson-fold-closed":
        {
          display: "inline-block",
          minWidth: "1ch",
          textAlign: "center",
          fontSize: `${gutterFontPx}px`,
          lineHeight: `${lineHeightPx}px`,
        },
      ".cm-foldGutter.lesson-fold-gutter .lesson-fold-icon": {
        color: `${lineNumberColor} !important`,
      },
      ".cm-foldGutter.lesson-fold-gutter span.lesson-fold-open": {
        color: `${lineNumberColor} !important`,
      },
      ".cm-foldGutter.lesson-fold-gutter span.lesson-fold-closed": {
        color: `${lineNumberColor} !important`,
      },
      ".lesson-fold-gutter span.lesson-fold-open": {
        opacity: "0",
        pointerEvents: "none",
      },
      // 行番号列を含むガター全体をホバー領域にする（正本は globals.css の
      // 同名ルール。こちらは !important 無しのフォールバック）
      ".cm-gutters:hover span.lesson-fold-open": {
        opacity: "1",
        pointerEvents: "none",
      },
      ".lesson-fold-gutter span.lesson-fold-closed": {
        opacity: "1",
        pointerEvents: "auto",
      },
      ".cm-gutterElement.lesson-active-line-gutter": {
        backgroundColor: `${LESSON_ACTIVE_LINE_BG} !important`,
      },
      ".cm-line.lesson-active-line": {
        backgroundColor: `${LESSON_ACTIVE_LINE_BG} !important`,
      },
      ".cm-lineNumbers .cm-gutterElement.lesson-active-line-number": {
        fontWeight: "700",
      },
    },
    { dark: isDark },
  );
}

const lessonVscodeLight = vscodeLightInit({
  settings: {
    lineHighlight: "transparent",
    gutterForeground: LESSON_LINE_NUMBER_LIGHT,
    gutterActiveForeground: "",
    selection: LESSON_EDITOR_SELECTION_BG,
  },
});

const lessonVscodeDark = vscodeDarkInit({
  settings: {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    lineHighlight: "transparent",
    gutterForeground: LESSON_LINE_NUMBER_DARK,
    gutterBackground: "#1e1e1e",
    gutterActiveForeground: "#c6c6c6",
    selection: LESSON_EDITOR_SELECTION_BG,
  },
});


const lessonMarkdownFold = foldService.of(
  (state: EditorState, lineStart: number) => {
    const lineIndex = state.doc.lineAt(lineStart).number - 1;
    const lines = state.doc.toString().split("\n");
    const range = getFoldRangeAtLine(lines, lineIndex);
    if (!range) return null;

    const docLines = state.doc.lines;
    if (range.fromLineIndex >= docLines) return null;
    const from = state.doc.line(range.fromLineIndex + 1).from;
    const toLine = Math.min(range.toLineIndex + 1, docLines);
    const to = state.doc.line(toLine).to;
    if (from >= to) return null;
    return { from, to };
  },
);

/** Ctrl+ホイールでフォントサイズ変更（編集モードのみ） */
export function editorFontSizeWheelExtension(
  getSize: () => number,
  onSizeChange: (next: number) => void,
) {
  return EditorView.domEventHandlers({
    wheel(event) {
      if (!event.ctrlKey) return false;
      event.preventDefault();
      const step = event.deltaY < 0 ? 1 : -1;
      onSizeChange(clampEditorFontSizePx(getSize() + step));
      return true;
    },
  });
}

/** Pane3 編集モード用 CodeMirror 拡張 */
export function buildLessonEditorExtensions(
  isDark = false,
  fontSizePx = 14,
  options?: {
    getFontSize?: () => number;
    onFontSizeChange?: (next: number) => void;
  },
) {
  const size = clampEditorFontSizePx(fontSizePx);
  const lineNumberColor = isDark
    ? LESSON_LINE_NUMBER_DARK
    : LESSON_LINE_NUMBER_LIGHT;
  const extensions = [
    isDark ? lessonVscodeDark : lessonVscodeLight,
    lineNumbers(),
    ...lessonFoldGutter(),
    lessonMarkdownFold,
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    }),
    keymap.of(markdownKeymap),
    EditorView.lineWrapping,
    ...activeLineRowHighlight(),
    createLessonEditorLayout(size, lineNumberColor, isDark),
    lessonEditorSelectionTheme,
    lessonSearchPanelTheme,
  ];
  if (options?.onFontSizeChange) {
    extensions.push(
      editorFontSizeWheelExtension(
        options.getFontSize ?? (() => size),
        options.onFontSizeChange,
      ),
    );
  }
  return extensions;
}

/** EditorState 生成用: history / keymap + 差し替え可能テーマ */
export function buildLessonEditorStateExtensions(
  isDark = false,
  fontSizePx = 14,
  options?: {
    getFontSize?: () => number;
    onFontSizeChange?: (next: number) => void;
    /** ペイン1 の中身検索の語。一致箇所の地色を塗る */
    searchHighlightQuery?: string;
  },
  extraExtensions: Extension[] = [],
): Extension[] {
  return [
    lessonEditorThemeCompartment.of(
      buildLessonEditorExtensions(isDark, fontSizePx, options),
    ),
    lessonSearchHighlightCompartment.of(
      lessonSearchHighlight(options?.searchHighlightQuery),
    ),
    history(),
    search(),
    // CodeMirror 6 は画面外の行を DOM に描画しない（仮想スクロール）ため、
    // ブラウザ純正の Ctrl+F は画面内のテキストしか検索できない。searchKeymap を
    // 加えることで Ctrl+F が CodeMirror 自身の検索パネル（ドキュメント全体が対象）
    // にバインドされる。
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    ...extraExtensions,
  ];
}
