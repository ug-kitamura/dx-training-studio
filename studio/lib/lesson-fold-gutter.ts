import {
  codeFolding,
  foldEffect,
  foldState,
  unfoldEffect,
} from "@codemirror/language";
import { getFoldRangeAtLine } from "@/lib/markdown-fold-ranges";
import { LESSON_LINE_NUMBER } from "@/lib/lesson-active-line-number";
import {
  EditorView,
  GutterMarker,
  ViewPlugin,
  gutter,
  type ViewUpdate,
} from "@codemirror/view";
import {
  RangeSet,
  RangeSetBuilder,
  type EditorState,
} from "@codemirror/state";

const FOLD_OPEN = "▼";
const FOLD_CLOSED = "▶";

function styleFoldIcon(span: HTMLElement) {
  span.style.color = LESSON_LINE_NUMBER;
  span.style.setProperty("-webkit-text-fill-color", LESSON_LINE_NUMBER);
}

/** 折りたたみ範囲の先頭文字位置 → 見出し行（折りたたみ操作行）の先頭 */
function foldHeaderPos(state: EditorState, foldFrom: number): number {
  const line = state.doc.lineAt(foldFrom);
  if (line.number <= 1) return 0;
  return state.doc.line(line.number - 1).from;
}

function findFoldAtHeader(
  state: EditorState,
  headerPos: number,
): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;
  const folded = state.field(foldState, false);
  if (!folded) return null;
  folded.between(0, state.doc.length, (from, to) => {
    if (foldHeaderPos(state, from) === headerPos) found = { from, to };
  });
  return found;
}

class LessonFoldOpenMarker extends GutterMarker {
  eq(other: GutterMarker): boolean {
    return other instanceof LessonFoldOpenMarker;
  }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.textContent = FOLD_OPEN;
    span.className = "lesson-fold-icon lesson-fold-open";
    span.setAttribute("aria-hidden", "true");
    styleFoldIcon(span);
    return span;
  }
}

class LessonFoldClosedMarker extends GutterMarker {
  eq(other: GutterMarker): boolean {
    return other instanceof LessonFoldClosedMarker;
  }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.textContent = FOLD_CLOSED;
    span.className = "lesson-fold-icon lesson-fold-closed";
    span.setAttribute("aria-hidden", "true");
    styleFoldIcon(span);
    return span;
  }
}

const openMarker = new LessonFoldOpenMarker();
const closedMarker = new LessonFoldClosedMarker();

type FoldRange = { from: number; to: number };

function findFoldAtPos(state: EditorState, pos: number): FoldRange | null {
  let found: FoldRange | null = null;
  state.field(foldState, false)?.between(pos, pos, (from, to) => {
    found = { from, to };
  });
  return found;
}

function unfoldAtEvent(view: EditorView, event: Event, fold: FoldRange): boolean {
  event.preventDefault();
  event.stopPropagation();
  view.dispatch({ effects: unfoldEffect.of(fold) });
  return true;
}

function isFoldPlaceholderTarget(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && !!target.closest(".cm-foldPlaceholder");
}

function preventFoldPlaceholderMouseDown(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

/** 「…」プレースホルダー: mousedown は選択抑止のみ、click（リリース）で展開 */
function lessonFoldPlaceholderClickHandler() {
  return EditorView.domEventHandlers({
    mousedown(event) {
      if (event.button !== 0) return false;
      if (!isFoldPlaceholderTarget(event.target)) return false;
      preventFoldPlaceholderMouseDown(event);
      return true;
    },
    click(event, view) {
      if (!isFoldPlaceholderTarget(event.target)) return false;
      const pos = view.posAtDOM(event.target);
      const fold = findFoldAtPos(view.state, pos);
      return fold ? unfoldAtEvent(view, event, fold) : false;
    },
  });
}

function createFoldPlaceholderDOM(
  _view: EditorView,
  onclick: (event: Event) => void,
): HTMLElement {
  const span = document.createElement("span");
  span.textContent = "…";
  span.className = "cm-foldPlaceholder lesson-fold-placeholder";
  span.addEventListener("mousedown", preventFoldPlaceholderMouseDown);
  span.addEventListener("click", (event) => {
    preventFoldPlaceholderMouseDown(event);
    onclick(event);
  });
  return span;
}

function isFoldHeaderLine(state: EditorState, lineFrom: number): boolean {
  const lineIndex = state.doc.lineAt(lineFrom).number - 1;
  const lines = state.doc.toString().split("\n");
  return getFoldRangeAtLine(lines, lineIndex) !== null;
}

function buildFoldGutterMarkers(view: EditorView) {
  const { state } = view;
  const builder = new RangeSetBuilder<GutterMarker>();
  const foldedHeaders = new Set<number>();

  state.field(foldState, false)?.between(0, state.doc.length, (from) => {
    foldedHeaders.add(foldHeaderPos(state, from));
  });

  for (const line of view.viewportLineBlocks) {
    if (foldedHeaders.has(line.from)) {
      builder.add(line.from, line.from, closedMarker);
      continue;
    }
    if (isFoldHeaderLine(state, line.from)) {
      builder.add(line.from, line.from, openMarker);
    }
  }
  return builder.finish();
}

const foldMarkerPlugin = ViewPlugin.fromClass(
  class {
    markers: RangeSet<GutterMarker> = RangeSet.empty;

    constructor(view: EditorView) {
      this.markers = buildFoldGutterMarkers(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.startState.field(foldState, false) !==
          update.state.field(foldState, false)
      ) {
        this.markers = buildFoldGutterMarkers(update.view);
      }
    }
  },
);

/** 見出し行に ▼/▶ を付ける折りたたみガター（標準 foldGutter の代替） */
export function lessonFoldGutter() {
  return [
    foldMarkerPlugin,
    gutter({
      class: "cm-foldGutter lesson-fold-gutter",
      markers: (view) =>
        view.plugin(foldMarkerPlugin)?.markers ?? RangeSet.empty,
      // ▼ の表示条件は CSS（.cm-gutters:hover）が持つ。gutter() の
      // domEventHandlers はこの列の上でしか発火せず、行番号列を覆えない
      domEventHandlers: {
        click: (view, line) => {
          const folded = findFoldAtHeader(view.state, line.from);
          if (folded) {
            view.dispatch({ effects: unfoldEffect.of(folded) });
            return true;
          }
          const lineIndex = view.state.doc.lineAt(line.from).number - 1;
          const lines = view.state.doc.toString().split("\n");
          const foldRange = getFoldRangeAtLine(lines, lineIndex);
          if (!foldRange) return false;
          const from = view.state.doc.line(foldRange.fromLineIndex + 1).from;
          const to = view.state.doc.line(foldRange.toLineIndex + 1).to;
          if (from < to) {
            view.dispatch({ effects: foldEffect.of({ from, to }) });
            return true;
          }
          return false;
        },
      },
    }),
    codeFolding({ placeholderDOM: createFoldPlaceholderDOM }),
    lessonFoldPlaceholderClickHandler(),
  ];
}
