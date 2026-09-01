import Link from "next/link";
import { HeroTitle } from "@/components/pages/HeroTitle";
import { StatusLabel } from "@/components/Label";
import { courseNeighbors } from "@/lib/mandala/graph";
import {
  data as siteData,
  formatMinutes,
  localized,
  localizedOptional,
  type MandalaNode,
  type SiteCourse,
  type SiteSeries,
} from "@/lib/site-data";
import { localizedHref, type Locale } from "@/lib/locale-path";

/**
 * 前後のコース。レッスン一覧（カード）より軽いバレットで出す——
 * コーストップの主役はレッスン一覧で、ここは道のりの前後を示す補助。
 */
function CourseLinks({
  courses,
  seriesSlug,
  locale,
}: {
  courses: MandalaNode[];
  seriesSlug: string;
  locale: Locale;
}) {
  if (courses.length === 0) {
    return (
      <p className="dxm-course-links-empty">
        {locale === "en" ? "None" : "なし"}
      </p>
    );
  }

  return (
    <ul className="dxm-course-links">
      {courses.map((course) => (
        <li key={course.id}>
          <Link href={localizedHref(course.href, locale)}>
            {localized(course.label, course.labelEn, locale)}
          </Link>
          {/* 他シリーズの相手にだけシリーズ名を添える。リンクの外に置いて
              リンクテキストを「コース名」だけに保つ */}
          {course.seriesSlug !== seriesSlug && (
            <span className="dxm-course-links-series">
              {localized(course.seriesName, course.seriesNameEn, locale)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function CoursePage({
  series,
  course,
  locale,
}: {
  series: SiteSeries;
  course: SiteCourse;
  locale: Locale;
}) {
  const courseTitle = localized(course.name, course.nameEn, locale);
  const neighbors = course.id
    ? courseNeighbors(siteData.mandala, course.id)
    : { prev: [], next: [] };

  return (
    <div className="dxm-page">
      <div className="dxm-hero">
        <HeroTitle
          title={courseTitle}
          catchCopy={localizedOptional(course.catch, course.catchEn, locale)}
        />
        {course.description && (
          <p>
            {localizedOptional(
              course.description,
              course.descriptionEn,
              locale,
            )}
          </p>
        )}
        <span className="dxm-card-meta">
          {course.lessons.length} {locale === "en" ? "lessons" : "レッスン"}・
          {formatMinutes(course.totalMinutes, locale)}
          {course.target &&
            ` ・${locale === "en" ? "For" : "対象"}: ${localizedOptional(course.target, course.targetEn, locale)}`}
        </span>
      </div>

      <h2 className="dxm-section-title">
        {locale === "en" ? "Lessons" : "レッスン"}
      </h2>
      <div className="dxm-card-list">
        {course.lessons.map((lesson) => (
          <Link
            key={lesson.slug}
            href={localizedHref(lesson.href, locale)}
            className="dxm-card"
          >
            <span className="dxm-card-title">
              {localized(lesson.name, lesson.titleEn, locale)}
              <StatusLabel status={lesson.status} locale={locale} />
            </span>
            {lesson.description && (
              <span>
                {localizedOptional(
                  lesson.description,
                  lesson.descriptionEn,
                  locale,
                )}
              </span>
            )}
            <span className="dxm-card-meta">
              {formatMinutes(lesson.estimatedMinutes, locale)}
            </span>
          </Link>
        ))}
      </div>

      <h2 className="dxm-section-title">
        {locale === "en" ? "Before this course" : "前に受けるコース"}
      </h2>
      <CourseLinks
        courses={neighbors.prev}
        seriesSlug={series.slug}
        locale={locale}
      />

      <h2 className="dxm-section-title">
        {locale === "en" ? "Next courses" : "次に受けるコース"}
      </h2>
      <CourseLinks
        courses={neighbors.next}
        seriesSlug={series.slug}
        locale={locale}
      />
    </div>
  );
}
