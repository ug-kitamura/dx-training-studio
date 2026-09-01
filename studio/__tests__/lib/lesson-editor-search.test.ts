import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  SearchCursor,
  SearchQuery,
  findNext,
  openSearchPanel,
  replaceAll,
  setSearchQuery,
} from "@codemirror/search";
import { buildLessonEditorStateExtensions } from "@/lib/lesson-content-editor-setup";

/**
 * 画面外（仮想スクロールで DOM 未生成）のテキストが検索できることを確かめる。
 * CodeMirror の検索は DOM ではなく EditorState.doc を走査するため、
 * jsdom 上でも画面内外の区別なく妥当性を確認できる。
 */
const OFFSCREEN_LINE_INDEX = 4321; // 0 始まり = 4322 行目
const TOTAL_LINES = 5000;
const OFFSCREEN_KEYWORD = "ここだけにある識別子ZZTOP";

function buildLongDoc(): string {
  const lines = Array.from(
    { length: TOTAL_LINES },
    (_, i) => `本文の行 ${i + 1}`,
  );
  lines[OFFSCREEN_LINE_INDEX] = `本文の行 ${OFFSCREEN_LINE_INDEX + 1} ${OFFSCREEN_KEYWORD}`;
  return lines.join("\n");
}

function createState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: buildLessonEditorStateExtensions(),
  });
}

const views: EditorView[] = [];

function createView(doc: string): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const view = new EditorView({ state: createState(doc), parent });
  views.push(view);
  return view;
}

afterEach(() => {
  while (views.length > 0) {
    views.pop()?.destroy();
  }
  document.body.innerHTML = "";
});

describe("編集モードのドキュメント全体検索", () => {
  it("画面に収まらない位置のキーワードを EditorState.doc から見つける", () => {
    const state = createState(buildLongDoc());
    const cursor = new SearchCursor(state.doc, OFFSCREEN_KEYWORD);
    cursor.next();

    expect(cursor.done).toBe(false);
    expect(state.doc.lineAt(cursor.value.from).number).toBe(
      OFFSCREEN_LINE_INDEX + 1,
    );
  });

  it("openSearchPanel → setSearchQuery → findNext で画面外のキーワードへジャンプする", () => {
    const view = createView(buildLongDoc());

    expect(openSearchPanel(view)).toBe(true);
    view.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: OFFSCREEN_KEYWORD })),
    });
    expect(findNext(view)).toBe(true);

    const selection = view.state.selection.main;
    expect(view.state.sliceDoc(selection.from, selection.to)).toBe(
      OFFSCREEN_KEYWORD,
    );
    expect(view.state.doc.lineAt(selection.from).number).toBe(
      OFFSCREEN_LINE_INDEX + 1,
    );
  });

  it("画面内（先頭付近）のキーワードも引き続きヒットする", () => {
    const view = createView(buildLongDoc());
    const keyword = "本文の行 2";

    view.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: keyword })),
    });
    expect(findNext(view)).toBe(true);

    const selection = view.state.selection.main;
    expect(view.state.sliceDoc(selection.from, selection.to)).toBe(keyword);
    expect(view.state.doc.lineAt(selection.from).number).toBe(2);
  });
});

describe("編集モードの置換", () => {
  const doc = [
    "---",
    "title: セーブポイントを作る",
    "status: draft",
    "---",
    "",
    "セーブポイントを作ると、いつでも戻れる。",
    "もう一度セーブポイントに触れる。",
  ].join("\n");

  it("Replace All はフロントマターの値も置換する", () => {
    const view = createView(doc);

    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({
          search: "セーブポイント",
          replace: "チェックポイント",
        }),
      ),
    });
    expect(replaceAll(view)).toBe(true);

    const next = view.state.doc.toString();
    expect(next).not.toContain("セーブポイント");
    expect(next).toContain("title: チェックポイントを作る");
    expect(next.match(/チェックポイント/g)).toHaveLength(3);
  });
});
