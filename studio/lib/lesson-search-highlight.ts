import { Compartment, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import {
  findSearchHighlightRanges,
  normalizeSearchHighlightQuery,
} from "@/lib/search-highlight-matches";

/**
 * ペイン1 の中身検索の一致箇所を編集ビューで塗る。
 *
 * ⚠ @codemirror/search の `setSearchQuery` は使わない——検索パネルが絡んで
 * カーソルと選択が動く。既存仕様では検索パネルの起動手段は Ctrl+F のみで、
 * ペイン1 の入力で勝手に開くのはそれに反する。ここは独立した装飾に徹する。
 */

/** クエリを setState なしで差し替える Compartment（テーマ側と同じ作り） */
export const lessonSearchHighlightCompartment = new Compartment();

const highlightMark = Decoration.mark({ class: "lesson-search-highlight" });

function buildDecorations(view: EditorView, query: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  if (!query) return builder.finish();

  // ⚠ ドキュメント全体ではなくビューポート内だけを走査する。長いレッスンで
  // 入力のたびに全文を舐めると目に見えて重くなる
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const range of findSearchHighlightRanges(text, query)) {
      builder.add(from + range.from, from + range.to, highlightMark);
    }
  }
  return builder.finish();
}

/** 与えたクエリで一致箇所を塗る拡張。クエリが空なら何も塗らない */
export function lessonSearchHighlight(rawQuery: string | undefined) {
  const query = normalizeSearchHighlightQuery(rawQuery);

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, query);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, query);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
