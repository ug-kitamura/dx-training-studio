import siteData from "@/content/site-data.json";
import type { Locale } from "./locale-path";
import type { CourseStyle, LessonStatus } from "./site-labels";

// 表示ラベルの語彙と、その引数型の正本は生成物に依存しない `./site-labels`。
// 公開サイト内の既存の呼び出し元が `@/lib/site-data` から読めるよう再エクスポートする。
export type { CourseStyle, LessonStatus };
export {
  formatCourseStyle,
  formatLessonStatus,
  formatMinutes,
} from "./site-labels";

export type SiteLesson = {
  name: string;
  slug: string;
  stableId?: string;
  status: LessonStatus;
  description: string;
  estimatedMinutes: number;
  href: string;
  titleEn?: string;
  descriptionEn?: string;
};

export type SiteCourse = {
  name: string;
  nameEn?: string;
  id?: string;
  slug: string;
  description?: string;
  descriptionEn?: string;
  catch?: string;
  catchEn?: string;
  target?: string;
  targetEn?: string;
  crossSeriesPrev: string[];
  crossSeriesNext: string[];
  isStart?: boolean;
  isGoal?: boolean;
  lessons: SiteLesson[];
  href: string;
  totalMinutes: number;
};

export type SiteSeries = {
  name: string;
  nameEn?: string;
  id?: string;
  slug: string;
  description?: string;
  descriptionEn?: string;
  catch?: string;
  catchEn?: string;
  cover?: string;
  courses: SiteCourse[];
  href: string;
  totalMinutes: number;
  lessonCount: number;
};

export type MandalaNode = {
  id: string;
  label: string;
  /** コース名の英語。未訳ではキーを持たない（表示側が日本語へフォールバックする） */
  labelEn?: string;
  seriesSlug: string;
  seriesName: string;
  /** シリーズ名の英語。未訳ではキーを持たない */
  seriesNameEn?: string;
  courseSlug: string;
  href: string;
  catch?: string;
  lessonCount: number;
  totalMinutes: number;
  status: LessonStatus;
  style?: CourseStyle;
  /** カリキュラムの入口・到達点の宣言。未宣言ではキーを持たない */
  isStart?: boolean;
  isGoal?: boolean;
};

export type MandalaEdge = {
  id: string;
  source: string;
  target: string;
  kind: "order" | "cross";
};

export type MandalaGraph = { nodes: MandalaNode[]; edges: MandalaEdge[] };

/** サイト表示フィールド（変換が全体メタ＋ site.config.json から解決した値） */
export type SiteChrome = {
  name: string;
  nameEn?: string;
  githubUrl: string;
  /** 全体メタ由来のヒーロー画像ファイル名。未設定（同梱 hero.jpg）なら null */
  hero: string | null;
};

export type SiteData = {
  site?: SiteChrome;
  siteDescription?: string;
  siteDescriptionEn?: string;
  series: SiteSeries[];
  mandala: MandalaGraph;
};

export const data = siteData as SiteData;

/** 旧形式の site-data.json（site 無し）でも落とさないためのフォールバック */
const FALLBACK_CHROME: SiteChrome = {
  name: "DX Training Mandala",
  githubUrl: "https://github.com/ug-kitamura/dx-training-studio",
  hero: null,
};

export function siteChrome(): SiteChrome {
  return data.site ?? FALLBACK_CHROME;
}

export function allSeries(): SiteSeries[] {
  return data.series;
}

export function findSeries(slug: string): SiteSeries | undefined {
  return data.series.find((s) => s.slug === slug);
}

export function findCourse(
  seriesSlug: string,
  courseSlug: string,
): SiteCourse | undefined {
  return findSeries(seriesSlug)?.courses.find((c) => c.slug === courseSlug);
}

/** 表示テキストのロケール解決（英語が無ければ日本語へフォールバック） */
export function localized(
  ja: string,
  en: string | undefined,
  locale: Locale,
): string {
  return locale === "en" ? (en ?? ja) : ja;
}

export function localizedOptional(
  ja: string | undefined,
  en: string | undefined,
  locale: Locale,
): string | undefined {
  return locale === "en" ? (en ?? ja) : ja;
}
