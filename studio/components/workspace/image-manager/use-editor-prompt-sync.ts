"use client";

import { useState } from "react";

/**
 * エディタの HTML コメント（画像指示）がプロンプト欄へ流れ込む同期。
 * AI タブと Web タブで共用。
 *
 * Effect+setState のミラーではなく「前回値を state に持ち、render 中に比較して
 * set する」React 公式パターンで書く——Effect 経由は 1 render 遅れるうえ
 * react-hooks/set-state-in-effect に掛かる。
 */
export function useEditorPromptSync(
  editorCommentPrompt: string | null,
  setPrompt: (value: string) => void,
): void {
  const [prevCommentPrompt, setPrevCommentPrompt] =
    useState(editorCommentPrompt);
  if (editorCommentPrompt !== prevCommentPrompt) {
    setPrevCommentPrompt(editorCommentPrompt);
    if (editorCommentPrompt !== null) {
      setPrompt(editorCommentPrompt);
    }
  }
}
