/**
 * 表示中のページからコースを解く（純関数）。
 *
 * レッスンページは素の MDX で `components/pages` を通らないため、ページ側から
 * 現在地を渡す経路が無い。パスから解くのが唯一の道で、SiteShell が
 * `usePathname()` で言語を解いているのと同じ流儀に合わせている。
 */
import { stripLocale } from "@/lib/locale-path";
import type { SiteSeries } from "@/lib/site-data";

/**
 * `/git/concepts` `/git/concepts/three-areas` `/en/git/concepts` → コース ID。
 * 全体トップ・シリーズトップなどコースが決まらないパスでは null。
 */
export function findCourseIdByPath(
  series: SiteSeries[],
  pathname: string,
): string | null {
  const segments = stripLocale(pathname).split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [seriesSlug, courseSlug] = segments;
  const course = series
    .find((s) => s.slug === seriesSlug)
    ?.courses.find((c) => c.slug === courseSlug);

  return course?.id ?? null;
}

/**
 * 表示中のページが「曼陀羅のどのノードに当たるか」を表す。
 * シリーズは折りたたまれているときだけノードとして存在するので、
 * ノード ID ではなく slug のまま返し、解決は曼陀羅側に委ねる。
 */
export type CurrentLocation =
  | { kind: "course"; courseId: string }
  | { kind: "series"; seriesSlug: string };

/**
 * `/git/concepts` `/git/concepts/three-areas` → そのコース。
 * `/git` `/en/git` → そのシリーズ。
 * `/` `/en` や実在しない slug → null（全体トップを表すノードは無い）。
 */
export function findCurrentLocation(
  series: SiteSeries[],
  pathname: string,
): CurrentLocation | null {
  const segments = stripLocale(pathname).split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const [seriesSlug, courseSlug] = segments;
  const found = series.find((s) => s.slug === seriesSlug);
  if (!found) return null;
  if (!courseSlug) return { kind: "series", seriesSlug: found.slug };

  // `id` はローダーが採番するので、採番前のコースは現在地にできない
  // （`findCourseIdByPath` が null を返すのと同じ扱い）
  const course = found.courses.find((c) => c.slug === courseSlug);
  return course?.id ? { kind: "course", courseId: course.id } : null;
}
