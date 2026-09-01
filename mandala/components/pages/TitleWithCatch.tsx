/**
 * タイトルとキャッチコピーを「{タイトル} ——{キャッチ}」の1行に組み立てる。
 * ヒーロー見出し（`HeroTitle`）と一覧カード（`HomePage` / `SeriesPage`）が
 * **どちらもこれを使う**——記法の正本はここ1箇所。
 *
 * ⚠ ダッシュの前は**半角スペース1つ**。EM DASH 自体が前後に空きを持つので、
 *   全角スペースを重ねると字間が抜けて見える（2026-08-20 に全角から変更）。
 *   JSX のテキストに直接書くと消えたように見えるため `{" ——"}` の形で残す。
 * ⚠ 閉じ記号は付けない——以前は「～…～」で挟んでいた（2026-08-19 に変更）。
 * ⚠ 上の2つの変更はどちらもヒーローにしか届かず、カード側に取り残しが出た。
 *   記法を足す・変えるときは必ずこのファイルだけを触ること。
 *
 * 文字サイズ・色・太さは持たない——場所ごとに違うため、キャッチに当てるクラスを
 * `catchClassName` で受け取る（ヒーロー: `dxm-hero-catch` / カード: `dxm-card-catch`）。
 *
 * 返すのは**単一の要素**。`.dxm-card-title` は StatusLabel のために
 * `display: flex; gap: .5rem` を持っており、タイトルとキャッチを別々の flex
 * アイテムにすると (1) gap と記法の半角スペースで空きが二重になり
 * (2) アイテム境界で折り返せず狭い画面で溢れる。1アイテムに包めば両方消える。
 */
export function TitleWithCatch({
  title,
  catchCopy,
  catchClassName,
}: {
  title: string;
  catchCopy?: string;
  catchClassName: string;
}) {
  return (
    <span className="dxm-title-line">
      {title}
      {catchCopy && (
        <span className={catchClassName}>
          {" ——"}
          {catchCopy}
        </span>
      )}
    </span>
  );
}
