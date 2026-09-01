/**
 * ペイン2（レッスン本文）のスクロール位置を (レッスン, 編集言語, ビュー) ごとに覚える。
 *
 * 日本語ビューで位置が残っていたのは設計ではなく、本文が同期描画されてスクロール
 * 要素が生き残る**偶然**だった。英語ビューは本文を fetch する間プレースホルダに
 * 差し替わる（編集ビューではエディタ自体がアンマウントされる）ので、その瞬間に
 * `scrollTop` が 0 へ潰れる。偶然に頼らず明示的に覚える。
 *
 * ページ読み込みをまたいで永続化しない——「続きから」はセッション内の体験で足りる。
 */

const memory = new Map<string, number>();

export type Pane2ScrollKey = string;

export function pane2ScrollKey(
  lessonId: string,
  language: string,
  mode: string,
): Pane2ScrollKey {
  return `${lessonId}:${language}:${mode}`;
}

/**
 * 言語だけ入れ替えたキー。切替先に記憶が無いとき、切替元の位置を初期値に使う
 * ——言語間で行数は違うので数行ずれるが、先頭に戻るよりは読み始めやすい。
 */
export function pane2ScrollFallbackKey(
  key: Pane2ScrollKey,
): Pane2ScrollKey | null {
  const parts = key.split(":");
  if (parts.length < 3) return null;
  const mode = parts[parts.length - 1]!;
  const language = parts[parts.length - 2]!;
  const lessonId = parts.slice(0, parts.length - 2).join(":");
  const other = language === "en" ? "ja" : "en";
  return pane2ScrollKey(lessonId, other, mode);
}

export function getPane2ScrollTop(key: Pane2ScrollKey): number | undefined {
  return memory.get(key);
}

export function setPane2ScrollTop(key: Pane2ScrollKey, value: number): void {
  memory.set(key, value);
}

/**
 * 復元に使う値。自分のキー → もう一方の言語 → 先頭、の順で解決する。
 */
export function resolvePane2ScrollTop(key: Pane2ScrollKey): number {
  const own = memory.get(key);
  if (own !== undefined) return own;
  const fallback = pane2ScrollFallbackKey(key);
  if (fallback) {
    const borrowed = memory.get(fallback);
    if (borrowed !== undefined) return borrowed;
  }
  return 0;
}

/** レッスン削除時に、そのレッスンの全言語・全ビューぶんを捨てる */
export function deleteLessonScrollMemory(lessonId: string): void {
  const prefix = `${lessonId}:`;
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

/** テスト用 */
export function clearPane2ScrollMemory(): void {
  memory.clear();
}
