/**
 * 生成された `index.mdx` から呼ばれる入口。
 *
 * MDX 側は slug と locale だけを渡し、データ引きはここで行う——
 * 変換スクリプトが吐く MDX を最小限に保つ。
 */
import { findCourse, findSeries } from "@/lib/site-data";
import type { Locale } from "@/lib/locale-path";
import { HomePage } from "./HomePage";
import { SeriesPage } from "./SeriesPage";
import { CoursePage } from "./CoursePage";

export function SiteHome({ locale = "ja" }: { locale?: Locale }) {
  return <HomePage locale={locale} />;
}

export function SiteSeries({
  seriesSlug,
  locale = "ja",
}: {
  seriesSlug: string;
  locale?: Locale;
}) {
  const series = findSeries(seriesSlug);
  if (!series) return null;
  return <SeriesPage series={series} locale={locale} />;
}

export function SiteCourse({
  seriesSlug,
  courseSlug,
  locale = "ja",
}: {
  seriesSlug: string;
  courseSlug: string;
  locale?: Locale;
}) {
  const series = findSeries(seriesSlug);
  const course = findCourse(seriesSlug, courseSlug);
  if (!series || !course) return null;
  return <CoursePage series={series} course={course} locale={locale} />;
}
