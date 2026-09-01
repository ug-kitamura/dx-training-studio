import { RangeSet } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  GutterMarker,
  ViewPlugin,
  gutterLineClass,
  lineNumberMarkers,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";

/** 行番号・折りガターのテキスト色（ライト） */
export const LESSON_LINE_NUMBER_LIGHT = "#237893";

/** 行番号・折りガターのテキスト色（ダーク / Cursor 風） */
export const LESSON_LINE_NUMBER_DARK = "#858585";

/** @deprecated LESSON_LINE_NUMBER_LIGHT を使用 */
export const LESSON_LINE_NUMBER = LESSON_LINE_NUMBER_LIGHT;

/** カーソル行の背景（行番号・折りガター・本文で共通） */
export const LESSON_ACTIVE_LINE_BG =
  "color-mix(in oklab, var(--muted) 50%, transparent)";

/** 全ガター列（行番号 + 折りたたみ）のカーソル行セル */
class ActiveRowGutterMarker extends GutterMarker {
  elementClass = "lesson-active-line-gutter";

  eq(other: GutterMarker): boolean {
    return other instanceof ActiveRowGutterMarker;
  }
}

const activeRowGutterMarker = new ActiveRowGutterMarker();

function activeRowGutterHighlight() {
  return gutterLineClass.compute(["selection"], (state) => {
    const marks = [];
    for (const range of state.selection.ranges) {
      const line = state.doc.lineAt(range.head);
      marks.push(activeRowGutterMarker.range(line.from));
    }
    return RangeSet.of(marks);
  });
}

const activeRowLineDeco = Decoration.line({
  class: "lesson-active-line",
  attributes: { style: `background-color: ${LESSON_ACTIVE_LINE_BG}` },
});

function activeRowContentHighlight() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          this.decorations = this.build(update.view);
        }
      }

      build(view: EditorView) {
        let lastLineStart = -1;
        const deco = [];
        for (const range of view.state.selection.ranges) {
          const block = view.lineBlockAt(range.head);
          if (block.from > lastLineStart) {
            deco.push(activeRowLineDeco.range(block.from));
            lastLineStart = block.from;
          }
        }
        return Decoration.set(deco);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

/** 行番号のみ太字（色は変えない） */
class ActiveLineNumberMarker extends GutterMarker {
  elementClass = "lesson-active-line-number";

  eq(other: GutterMarker): boolean {
    return other instanceof ActiveLineNumberMarker;
  }
}

const activeLineNumberMarker = new ActiveLineNumberMarker();

function activeLineNumberBold() {
  return lineNumberMarkers.compute(["selection"], (state) => {
    const marks = [];
    for (const range of state.selection.ranges) {
      const line = state.doc.lineAt(range.head);
      marks.push(activeLineNumberMarker.range(line.from));
    }
    return RangeSet.of(marks);
  });
}

/** カーソル行: 行番号・折りガター・本文の背景 + 行番号太字 */
export function activeLineRowHighlight() {
  return [
    activeRowGutterHighlight(),
    activeRowContentHighlight(),
    activeLineNumberBold(),
  ];
}
