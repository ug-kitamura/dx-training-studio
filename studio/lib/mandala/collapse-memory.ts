/**
 * モーダルの全体曼陀羅の開閉状態の記憶（セッション内）。
 *
 * ⚠ **永続保存領域（`localStorage` / cookie）を使わない。** 記憶はタブが生きている
 * 間だけ持てばよく、Studio の起動・リロードでは既定（全折りたたみ）へ戻ってよい——と
 * いう仕様なので、モジュールスコープで足りる。保存層を持たないことが「リロードで既定に
 * 戻る」の実装そのものになっている。ツリーの開閉が cookie なのは**サーバーが描く HTML に
 * 効かせるため**で、事情が違う（曼陀羅はモーダルが開いたときにクライアントで描かれる）。
 *
 * ⚠ **記憶するのは「展開しているシリーズ」の集合。** 折りたたんでいる側を記憶しては
 * ならない——既定が全折りたたみなので、記録の無いシリーズ（実行中に新しく作られたものを
 * 含む）は「記録に無い＝折りたたみ」で既定と一致する必要がある。畳んだ側を記憶する作りだと
 * これが裏返る。極性がこうなっているおかげで、実在しない ID の掃除も要らない。
 *
 * ⚠ **日英で共通。** 編集言語をスロットに含めない——開閉は言語の属性ではない。
 * `editLanguage` は prop なので切り替えても曼陀羅はリマウントせず、記憶はそのまま生きる。
 *
 * ⚠ **公開サイトと同型で持つ**（`mandala/lib/mandala/collapse-memory.ts`）。同型なのは
 * 「読み書きの仕組み」までで、**スロットの数と面の構成は異なる**——Studio の全体曼陀羅は
 * モーダル1面だけで、ミニ曼陀羅は course スコープなので開閉を持たない。公開サイトにある
 * ホーム埋め込み用のスロットをこちらに作らないこと。
 */

/** 開閉を記憶する面。Studio は全体曼陀羅のモーダル1面だけ */
export type MandalaSurface = "studio-modal";

const EMPTY: ReadonlySet<string> = new Set();

const memory = new Map<MandalaSurface, ReadonlySet<string>>();

/** その面で展開しているシリーズ ID。記録が無ければ空＝全折りたたみ */
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

/**
 * 初期の展開集合を解く（純関数）。
 *
 * `expandSeries` は記憶に無くても展開して返す——選択中のコースが集約ノードに隠れた
 * 地図を開いても役に立たない。以後は state が正なので、保存 effect がこの展開済みの
 * 状態を書き、次も展開で開く（「最後に見た姿が次に出る」）。
 *
 * ⚠ 実在しない ID を捨てる処理は要らない——展開側を記憶しているので、消えた ID は
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
