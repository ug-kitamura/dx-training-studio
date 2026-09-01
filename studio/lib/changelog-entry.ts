/**
 * 変更履歴（contents/changelog.md）のクライアント安全な純関数。
 * fs に触らない——編集 UI（挿入位置の決定）とサーバー双方から使う。
 */

/** 正本が無い状態から書き始めるときの初期テンプレート（site 側の初期ファイルと同文の宣言） */
export const CHANGELOG_INITIAL_TEMPLATE = `# 変更履歴

教材の主な更新のみを載せています。細かな修正は含みません。
`;

/** 編集画面に常設する約束事（規約の SSoT。人が書くときも AI 下書きも同じ規約に乗る） */
export const CHANGELOG_PROMISE_TEXT =
  "新しいものを上に。1回の追記は特筆すべき変更を最大5点まで。教材の話だけを、受講者に向けた言葉で。";

/** 先頭エントリの日付（最初に現れる YYYY-MM-DD）。読めなければ null */
export function firstEntryDate(content: string): string | null {
  const match = content.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

/**
 * 新規エントリを「冒頭の宣言文の直後・既存エントリの前」へ挿入する。
 *
 * AI にはファイル全体を書かせない——エントリのテキストだけを受け取り、
 * 挿入位置はこの関数（クライアント側）が決める。「追記のみ・既存行に
 * 触れない」をプロンプトではなく構造で担保するための要。
 *
 * - 最初の `## ` 見出しの前に挿入（新しいものが上）
 * - `## ` が無ければ末尾に追記
 * - 中身が空ならテンプレートから始める
 */
export function insertChangelogEntry(
  currentContent: string,
  entry: string,
): string {
  const trimmedEntry = entry.trim();
  if (!trimmedEntry) return currentContent;

  const base = currentContent.trim()
    ? currentContent
    : CHANGELOG_INITIAL_TEMPLATE;

  const lines = base.split("\n");
  const firstSection = lines.findIndex((line) => line.startsWith("## "));
  if (firstSection === -1) {
    return `${base.replace(/\n+$/, "")}\n\n${trimmedEntry}\n`;
  }

  const before = lines.slice(0, firstSection).join("\n").replace(/\n+$/, "");
  const after = lines.slice(firstSection).join("\n");
  return `${before}\n\n${trimmedEntry}\n\n${after}`;
}
