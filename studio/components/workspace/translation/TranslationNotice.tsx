"use client";

import {
  STALE_NOTICE_TEXT,
  UNTRANSLATED_NOTICE_TEXT,
} from "@/components/workspace/translation/translationLabels";
import type { TranslationNoticeState } from "@/lib/translation/client";
import { cn } from "@/lib/utils";

type Props = {
  /** 未取得（ロード中）は両方 false を渡す（`NO_TRANSLATION_NOTICE`） */
  state: TranslationNoticeState;
  /** 置き場ごとの体裁（レッスン本文ヘッダーでは `shrink-0` で並べる） */
  className?: string;
};

/**
 * 英語ビューの赤字1行（studio-translation spec）。
 *
 * 置き場は面の種類で決まる——メタ編集面とレッスンメタモーダルは**本文上部**、
 * レッスン本文は**ペイン2 ヘッダーのタイトル右隣**（本文の高さを状態で変えない）。
 *
 * ⚠ **常に 1 行だけ。** 空欄が古い翻訳より優先する——訳が入っていないブロックが
 * あるうちは、鮮度より先に埋めるべきだから。優先順位をここに閉じ込めているのは、
 * 5 つの呼び出し側が同じ分岐を書き写さないようにするため。
 *
 * ⚠ 文言以外を足さないこと。操作も補足も付けない——直す手段（本文右上の
 * 「原文から翻訳」）は既に見えている。ただし空欄が `author_en` だけのときは
 * 翻訳ボタンでは消えない（人名は手入力）。それでも出すのは、意図した空白か
 * 入れ忘れかを執筆者自身も区別できないため。
 *
 * 日本語ビューでは呼び出し側が描かない。
 */
export function TranslationNotice({ state, className }: Props) {
  const text = state.untranslated
    ? UNTRANSLATED_NOTICE_TEXT
    : state.stale
      ? STALE_NOTICE_TEXT
      : null;
  if (!text) return null;
  return <p className={cn("text-xs text-destructive", className)}>{text}</p>;
}
