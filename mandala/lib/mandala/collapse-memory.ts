/**
 * 全体曼陀羅の開閉状態の記憶（セッション内）。
 *
 * ⚠ **永続保存領域（`localStorage` / cookie）を使わない。** 記憶はタブが生きている
 * 間だけ持てばよく、再読み込みでは既定（全折りたたみ）へ戻ってよい——という仕様
 * なので、モジュールスコープの `Map` で足りる。保存層を持たないことが「リロードで
 * 既定に戻る」の実装そのものになっている。
 *
 * ⚠ **記憶するのは「展開しているシリーズ」の集合。** 折りたたんでいる側を記憶しては
 * ならない——既定が全折りたたみなので、記録の無いシリーズ（新しく増えたものを含む）は
 * 「記録に無い＝折りたたみ」で既定と一致する必要がある。畳んだ側を記憶する作りだと
 * これが裏返る。極性がこうなっているおかげで、実在しないシリーズの掃除も要らない
 * （一致しない記録は自然に無視される）。
 *
 * ⚠ **面ごとに独立したスロットを持つ。** ホームの埋め込みとモーダルは別の記憶で、
 * 一方の開閉が他方に影響してはならない。
 *
 * ⚠ **モーダルは閉じると unmount する**（`{open && <LazyMandala/>}`）。ホームの埋め込みも
 * ページを離れれば unmount する。だから記憶をコンポーネントの state に置くと開き直し・
 * ページ遷移で消える。モジュールスコープに置くことがそのまま「開き直しても残る」になる。
 *
 * ⚠ **日英で共通。** ロケールをスロットに含めない——開閉は言語の属性ではない。
 * `MandalaModal` は `SiteShell`（レイアウト）にあり `LanguageToggle` は `Link` なので、
 * ja↔en の切替はクライアント遷移になりモジュール state はそのまま生き残る。
 *
 * ⚠ **Studio と同型で持つ。** 同型なのは「読み書きの仕組み」までで、スロットの数と面の
 * 構成は異なる（Studio は全体曼陀羅がモーダル1面だけ。ミニ曼陀羅は course スコープで
 * 開閉を持たない）。片方に無い面のスロットを作らないこと。
 */

/** 開閉を記憶する面。ホームの埋め込みとモーダルは互いに独立 */
export type MandalaSurface = "site-home" | "site-modal";

const memory = new Map<MandalaSurface, ReadonlySet<string>>();

/** その面で展開しているシリーズ slug。記録が無ければ空＝全折りたたみ */
export function readExpandedSeries(
  surface: MandalaSurface,
): ReadonlySet<string> {
  return memory.get(surface) ?? EMPTY;
}

export function writeExpandedSeries(
  surface: MandalaSurface,
  expanded: ReadonlySet<string>,
): void {
  memory.set(surface, new Set(expanded));
}

const EMPTY: ReadonlySet<string> = new Set();

/**
 * 初期の展開集合を解く（純関数）。
 *
 * `expandSeries` は記憶に無くても展開して返す——現在地がコース・レッスンのとき、その
 * 所属シリーズが集約ノードに隠れた地図を開いても役に立たない。以後は state が正なので、
 * 保存 effect がこの展開済みの状態を書き、次も展開で開く（「最後に見た姿が次に出る」）。
 *
 * ⚠ 実在しない slug を捨てる処理は要らない——展開側を記憶しているので、消えた slug は
 * どのシリーズとも一致せず自然に無視される。
 */
export function resolveInitialExpanded(
  stored: ReadonlySet<string>,
  expandSeries: string | null,
): Set<string> {
  const result = new Set(stored);
  if (expandSeries) result.add(expandSeries);
  return result;
}

/** テスト用: 全スロットを消す */
export function resetMandalaMemory(): void {
  memory.clear();
}
