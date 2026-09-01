/**
 * ペイン1 ツリーの開閉状態の永続化（cookie）。
 *
 * ⚠ 保存先が localStorage ではなく cookie なのは、**サーバーの初期描画で使う**ため。
 * サーバーが全展開で描いた HTML は hydration まで表示され続け、クライアント側の復元
 * （`useState` 初期化関数・`useEffect`・`useLayoutEffect` のどれも）は hydration の前には
 * 走らない——つまりクライアント側では「全展開が一瞬見える」を原理的に消せない。
 * `app/page.tsx` が cookie を読んで、最初から畳んだ状態の HTML を返す。
 *
 * ⚠ 保存するのは **畳んでいる ID** だけ。展開側を保存してはならない——追加・同期で
 * 新しく現れたシリーズ・コースが「保存に無い＝展開」で出る現在の挙動が裏返る。
 * （曼陀羅の開閉記憶は逆に**展開側**を持つ。あちらは既定が全折りたたみでリロードごとに
 * 捨ててよく、事情が違う。極性を揃えようとしないこと）
 *
 * ⚠ **「記憶が無い」と「畳んだ ID が0件」は別物。** 記憶が無いとき（cookie が無い・
 * 壊れている）は**全折りたたみ**で開き、0件の記憶があるときは全展開で開く。
 * 詳細は `parseTreeCollapseCookie` のコメント。
 *
 * ⚠ cookie 名はここに置く。`lib/storage-keys.ts` は localStorage キーと CustomEvent 名の
 * 集約で、cookie は対象外（shadcn の sidebar も同じく自分のファイルに持つ）。
 *
 * このモジュールはサーバー（`page.tsx`）とクライアント（`ContentTreePane`）の両方から
 * 読まれる。`next/headers` や DOM を import してはならない——書き込みだけが `document` を
 * 触り、無いときは何もしない。
 */

import type { Series } from "@/lib/schema";

export const TREE_COLLAPSE_COOKIE_NAME = "dx-training-studio-tree-collapsed";

/** 1 年。sidebar の 7 日より長いのは、畳み方は作業の癖で安定しているため */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * cookie は 4KB が上限。ID は 1 件 20 文字弱なので 150 件程度まで入る。
 * これを超えたら `courses` を捨てて `series` だけ書く——シリーズの畳みのほうが
 * 一覧の圧縮に効くため。
 */
const COOKIE_VALUE_SOFT_LIMIT = 3800;

/** cookie・props に置く形。RSC の境界を越えるので `Set` ではなく配列 */
export type StoredTreeCollapse = {
  series: string[];
  courses: string[];
};

export const EMPTY_TREE_COLLAPSE: StoredTreeCollapse = Object.freeze({
  series: [],
  courses: [],
}) as StoredTreeCollapse;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * cookie の値を読む。**記憶が無いときは `null` を返す**——cookie が存在しないとき
 * （初回起動・失効）と、壊れていて読めないときの両方。
 *
 * ⚠ **`null`（記憶なし）と `{series: [], courses: []}`（畳んだ ID が0件）を同じに
 * してはならない。** 前者は「まだ何も覚えていない」＝全折りたたみで開く。後者は
 * 「すべて展開している」という記憶であり、全展開で開く。潰すと、全部開いた状態を
 * 保存した人が次回すべて畳まれて開くことになる。
 *
 * 壊れた値を `null` に倒すのは、記憶の**喪失**であって「すべて展開している」という
 * 記憶ではないため。
 *
 * `decodeURIComponent` は書く側の `encodeURIComponent` の対。Next の `cookies()` が
 * 既に復号して返す場合でも、JSON に `%` は無いので二重の復号は無害。
 */
export function parseTreeCollapseCookie(
  raw: string | undefined | null,
): StoredTreeCollapse | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as {
      series?: unknown;
      courses?: unknown;
    };
    if (parsed === null || typeof parsed !== "object") return null;
    return {
      series: toStringArray(parsed.series),
      courses: toStringArray(parsed.courses),
    };
  } catch {
    return null;
  }
}

/**
 * 全シリーズ・全コースを畳んだ集合（純関数）。
 *
 * 記憶が無いときの初期状態。⚠ サーバーで組むこと——クライアント側の復元は hydration
 * より後になるので、全展開のツリーが一瞬見えるのを消せない。
 */
export function allCollapsed(series: Series[]): StoredTreeCollapse {
  return {
    series: series.map((s) => s.id),
    courses: series.flatMap((s) => s.courses.map((c) => c.id)),
  };
}

/** 現在のコンテンツに実在しない ID を捨てる（リネーム・削除の残骸を溜めない） */
export function pruneTreeCollapse(
  stored: StoredTreeCollapse,
  series: Series[],
): StoredTreeCollapse {
  const seriesIds = new Set(series.map((s) => s.id));
  const courseIds = new Set(series.flatMap((s) => s.courses.map((c) => c.id)));
  return {
    series: stored.series.filter((id) => seriesIds.has(id)),
    courses: stored.courses.filter((id) => courseIds.has(id)),
  };
}

/**
 * cookie に書く値を組む。
 *
 * ⚠ **選択中のシリーズ・コースは除く。** サーバーは選択（localStorage）を知らないので、
 * 「復元時に選択の祖先を開く」をサーバーで再現できない。書く側で先に除いておけば、
 * サーバーの描画がそのまま最終状態になる。呼び出し側は選択が変わるたびに書き直すこと。
 */
export function serializeTreeCollapseCookie(
  collapsedSeriesIds: ReadonlySet<string>,
  collapsedCourseIds: ReadonlySet<string>,
  selection: { seriesId: string; courseId: string },
): string {
  const series = [...collapsedSeriesIds].filter(
    (id) => id !== selection.seriesId,
  );
  const courses = [...collapsedCourseIds].filter(
    (id) => id !== selection.courseId,
  );

  const full = encode({ series, courses });
  if (full.length <= COOKIE_VALUE_SOFT_LIMIT) return full;
  return encode({ series, courses: [] });
}

function encode(value: StoredTreeCollapse): string {
  return encodeURIComponent(JSON.stringify(value));
}

/** クライアントで cookie を書く。サーバー（`document` 無し）では何もしない */
export function writeTreeCollapseCookie(value: string): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${TREE_COLLAPSE_COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** テスト・デバッグ用: `document.cookie` から値を取り出す */
export function readTreeCollapseCookieFromDocument(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${TREE_COLLAPSE_COOKIE_NAME}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return undefined;
}
