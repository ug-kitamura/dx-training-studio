import Link from "next/link";
import { HeroTitle } from "@/components/pages/HeroTitle";
import { TitleWithCatch } from "@/components/pages/TitleWithCatch";
import {
  formatMinutes,
  localized,
  localizedOptional,
  type SiteSeries,
} from "@/lib/site-data";
import { localizedHref, type Locale } from "@/lib/locale-path";

export function SeriesPage({
  series,
  locale,
}: {
  series: SiteSeries;
  locale: Locale;
}) {
  const title = localized(series.name, series.nameEn, locale);

  return (
    <div className="dxm-page">
      <div className="dxm-hero">
        <HeroTitle
          title={title}
          catchCopy={localizedOptional(series.catch, series.catchEn, locale)}
        />
        {series.description && (
          <p>
            {localizedOptional(
              series.description,
              series.descriptionEn,
              locale,
            )}
          </p>
        )}
      </div>

      <h2 className="dxm-section-title">
        {locale === "en" ? "Courses" : "コース"}
      </h2>
      <div className="dxm-card-list">
        {series.courses.map((course) => (
          <Link
            key={course.slug}
            href={localizedHref(course.href, locale)}
            className="dxm-card"
          >
            <span className="dxm-card-title">
              <TitleWithCatch
                title={localized(course.name, course.nameEn, locale)}
                catchCopy={localizedOptional(
                  course.catch,
                  course.catchEn,
                  locale,
                )}
                catchClassName="dxm-card-catch"
              />
            </span>
            {course.description && (
              <span>
                {localizedOptional(
                  course.description,
                  course.descriptionEn,
                  locale,
                )}
              </span>
            )}
            <span className="dxm-card-meta">
              {course.lessons.length} {locale === "en" ? "lessons" : "レッスン"}
              ・{formatMinutes(course.totalMinutes, locale)}
              {course.target &&
                ` ・${locale === "en" ? "For" : "対象"}: ${localizedOptional(course.target, course.targetEn, locale)}`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
