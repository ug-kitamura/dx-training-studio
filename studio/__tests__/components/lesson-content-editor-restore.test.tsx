import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { LessonContentEditor } from "@/components/workspace/LessonContentEditor";
import { clearLessonEditorStateCache } from "@/lib/lesson-editor-state-cache";
import {
  EDITOR_FONT_SIZE_DEFAULT,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
} from "@/lib/workspace-settings";

/**
 * レッスン切替でキャッシュ済み EditorState を復元したときの回帰テスト。
 *
 * 復元は「キャッシュした時点の extension 構成」を丸ごと戻すため、再構成を挟まないと
 * **キャッシュを作ったインスタンスに束縛された extension** が生き残る:
 *   - 当時のテーマ配色が残る（ライト表示中に本文だけダークのまま＝白っぽく見える）
 *   - 当時のインスタンスを掴んだ Ctrl+ホイールのハンドラが残る（ズームが無反応）
 *   - 当時の updateListener が残る（**英語ビューの入力が日本語の保存経路へ流れる**）
 * どれも「A を開く → B へ移る → A に戻る」でしか踏まないため、実使用では
 * 「たまに壊れる」に見えていた。3つ目は日本語正本を英文で上書きする事故になった。
 */

const isDarkMock = vi.hoisted(() => ({ value: false }));

vi.mock("@/lib/use-resolved-dark-mode", () => ({
  useResolvedDarkMode: () => isDarkMock.value,
}));

function ctrlWheel(el: Element, deltaY: number) {
  el.dispatchEvent(
    new WheelEvent("wheel", {
      deltaY,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/** CodeMirror の本文要素（wheel ハンドラは EditorView の DOM に付く） */
function editorContent(container: HTMLElement): Element {
  const content = container.querySelector(".cm-content");
  if (!content) throw new Error("CodeMirror content not found");
  return content;
}

/**
 * ズームが効いたかは**永続化された設定値**で見る。CodeMirror は寸法を
 * StyleModule で動的注入するため、jsdom の `getComputedStyle` からは読めない。
 */
function persistedFontSize(): number {
  return loadWorkspaceSettings().editorFontSizePx;
}

function setPersistedFontSize(px: number) {
  saveWorkspaceSettings({ ...loadWorkspaceSettings(), editorFontSizePx: px });
}

function editorView(container: HTMLElement): EditorView {
  const view = EditorView.findFromDOM(container);
  if (!view) throw new Error("EditorView not found");
  return view;
}

/** ユーザー入力に相当する変更（remote 注釈なし＝updateListener が発火する） */
function typeAtEnd(container: HTMLElement, text: string) {
  const view = editorView(container);
  const at = view.state.doc.length;
  view.dispatch({
    changes: { from: at, insert: text },
    selection: { anchor: at + text.length },
  });
}

function highlightedTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".lesson-search-highlight")).map(
    (el) => el.textContent ?? "",
  );
}

beforeEach(() => {
  clearLessonEditorStateCache();
  localStorage.clear();
  isDarkMock.value = false;
});

afterEach(cleanup);

describe("LessonContentEditor のキャッシュ復元", () => {
  it("再マウントを挟んで A を復元しても Ctrl+ホイールが現在のサイズを起点にする", () => {
    // 1. サイズ 14 で A を開き、その時点のハンドラごと state をキャッシュさせる
    setPersistedFontSize(EDITOR_FONT_SIZE_DEFAULT);
    const first = render(
      <LessonContentEditor lessonId="a" value="本文A" onChange={() => {}} />,
    );

    // 2. エディタを畳む（プレビュー切替などで EditorView が破棄される）
    first.unmount();

    // 3. 別サイズで開き直す。ここから先の「現在のサイズ」は 20
    const NEW_SIZE = 20;
    setPersistedFontSize(NEW_SIZE);
    const { container, rerender } = render(
      <LessonContentEditor lessonId="b" value="本文B" onChange={() => {}} />,
    );

    // 4. A へ戻る＝手順1のキャッシュを復元する
    rerender(
      <LessonContentEditor lessonId="a" value="本文A" onChange={() => {}} />,
    );

    // 5. 拡大。復元した古いハンドラは手順1の 14 を起点にしてしまうので、
    //    再構成が効いていれば 21、効いていなければ 15 になる
    ctrlWheel(editorContent(container), -100);
    expect(persistedFontSize()).toBe(NEW_SIZE + 1);
  });

  it("復元時にキャッシュ当時のテーマではなく現在のテーマを反映する", () => {
    // ダークで A を開いてキャッシュを作る
    isDarkMock.value = true;
    const { container, rerender } = render(
      <LessonContentEditor lessonId="a" value="本文A" onChange={() => {}} />,
    );
    const darkBg = getComputedStyle(
      container.querySelector(".cm-editor") as HTMLElement,
    ).backgroundColor;

    // ライトへ切り替え、B を経由して A（キャッシュ）へ戻る
    isDarkMock.value = false;
    rerender(
      <LessonContentEditor lessonId="b" value="本文B" onChange={() => {}} />,
    );
    rerender(
      <LessonContentEditor lessonId="a" value="本文A" onChange={() => {}} />,
    );

    const restoredBg = getComputedStyle(
      container.querySelector(".cm-editor") as HTMLElement,
    ).backgroundColor;
    expect(restoredBg).not.toBe(darkBg);
  });

  /**
   * 事故の再現: ja → en → ja → en（2回目）で英語ビューの入力が日本語の
   * 保存経路へ流れ、`contents.md` が英文で上書きされた。
   */
  it("復元した state で入力しても復元元インスタンスの onChange は呼ばれない", () => {
    const jaChange = vi.fn();
    const enChange = vi.fn();
    const jaCursor = vi.fn();
    const enCursor = vi.fn();

    // インスタンス A で ja(x) → en(x:en) → ja(x) と往復し、
    // cache["x:en"] に **A の listener を同梱した** state を残す
    const first = render(
      <LessonContentEditor
        lessonId="x"
        value="日本語本文"
        onChange={jaChange}
        onCursorChange={jaCursor}
      />,
    );
    first.rerender(
      <LessonContentEditor
        lessonId="x:en"
        value="English body"
        onChange={enChange}
        onCursorChange={enCursor}
      />,
    );
    first.rerender(
      <LessonContentEditor
        lessonId="x"
        value="日本語本文"
        onChange={jaChange}
        onCursorChange={jaCursor}
      />,
    );
    first.unmount();

    // インスタンス B（2回目の英語ビュー）が cache["x:en"] を復元する
    const enChange2 = vi.fn();
    const enCursor2 = vi.fn();
    const { container } = render(
      <LessonContentEditor
        lessonId="x:en"
        value="English body"
        onChange={enChange2}
        onCursorChange={enCursor2}
      />,
    );

    jaChange.mockClear();
    enChange.mockClear();
    jaCursor.mockClear();
    enCursor.mockClear();

    typeAtEnd(container, "!");

    expect(enChange2).toHaveBeenCalledWith("English body!");
    expect(jaChange).not.toHaveBeenCalled();
    expect(enChange).not.toHaveBeenCalled();
    expect(enCursor2).toHaveBeenCalled();
    expect(jaCursor).not.toHaveBeenCalled();
  });

  it("復元しても undo 履歴は保たれる", () => {
    const first = render(
      <LessonContentEditor lessonId="x:en" value="base" onChange={() => {}} />,
    );
    typeAtEnd(first.container, " edited");
    expect(editorView(first.container).state.doc.toString()).toBe("base edited");
    first.unmount();

    // 別インスタンスが同じ state を復元する（value は保存済みの本文）
    const { container } = render(
      <LessonContentEditor
        lessonId="x:en"
        value="base edited"
        onChange={() => {}}
      />,
    );
    undo(editorView(container));
    expect(editorView(container).state.doc.toString()).toBe("base");
  });

  it("復元時にキャッシュ当時ではなく現在の検索語で塗る", () => {
    const first = render(
      <LessonContentEditor
        lessonId="x"
        value="alpha beta"
        onChange={() => {}}
        searchHighlightQuery="alpha"
      />,
    );
    expect(highlightedTexts(first.container)).toEqual(["alpha"]);
    first.unmount();

    const { container } = render(
      <LessonContentEditor
        lessonId="x"
        value="alpha beta"
        onChange={() => {}}
        searchHighlightQuery="beta"
      />,
    );
    expect(highlightedTexts(container)).toEqual(["beta"]);
  });
});
