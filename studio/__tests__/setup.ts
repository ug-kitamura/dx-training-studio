import "@testing-library/jest-dom/vitest";

// jsdom は ResizeObserver を実装していない。要素サイズに追従する UI
// （AgentChatInput の textarea 自動伸長など）を描画するテスト向けのスタブ。
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom は scrollIntoView を実装していない。キーボード操作でフォーカス行を
// 追従させる FileTreePane などを描画するテスト向けの no-op スタブ。
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}
