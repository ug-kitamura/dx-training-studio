/**
 * 翻訳 UI の共有文言（studio-translation spec）。
 *
 * ⚠ 対象（メタ・本文・ホームの統合翻訳）によって言い回しを変えないこと。
 * 場所ごとにラベルが分かれていたのが今回の改修の出発点なので、
 * 新しい面を足すときもここから引くこと。
 */

/** 英語ビューの翻訳を起動するボタンの表記。全面共通 */
export const TRANSLATE_LABEL = "原文から翻訳";

/** 翻訳が原文より古いときに英語ビューへ出す赤字1行 */
export const STALE_NOTICE_TEXT = "翻訳が古い可能性があります";

/**
 * 空欄のブロックがあるときに英語ビューへ出す赤字1行。
 * ⚠ `STALE_NOTICE_TEXT` と同じ場所に、どちらか 1 行だけ出す（優先はこちら）。
 */
export const UNTRANSLATED_NOTICE_TEXT = "翻訳がまだ出来ていません";
