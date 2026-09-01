import Link from "next/link";
import Image from "next/image";
import { LazyMandala } from "@/components/mandala/LazyMandala";
import { TitleWithCatch } from "@/components/pages/TitleWithCatch";
import heroImage from "@/app/hero.jpg";
import {
  allSeries,
  data,
  formatMinutes,
  localized,
  localizedOptional,
  siteChrome,
} from "@/lib/site-data";
import { localizedHref, type Locale } from "@/lib/locale-path";
import { assetPath } from "@/lib/asset-path";

export function HomePage({ locale }: { locale: Locale }) {
  const chrome = siteChrome();
  const description = localizedOptional(
    data.siteDescription,
    data.siteDescriptionEn,
    locale,
  );

  return (
    <div className="dxm-page">
      {/* トレーニングを想起させるヒーロー画像。全体メタ（contents/.meta.json の
          hero）があれば正本 images/ の画像、無ければ同梱 `app/hero.jpg` を使う。
          切り抜かず全体を出すので、縦横比は画像がそのまま決める。 */}
      {chrome.hero ? (
        /* eslint-disable-next-line @next/next/no-img-element -- 変換がコピーした public/images を参照するため静的 import できない */
        <img
          src={assetPath(`/images/${chrome.hero}`)}
          alt=""
          aria-hidden
          className="dxm-home-hero-image"
        />
      ) : (
        <Image
          src={heroImage}
          alt=""
          aria-hidden
          priority
          className="dxm-home-hero-image"
        />
      )}

      <div className="dxm-hero">
        <h1 className="dxm-hero-title">
          {localized(chrome.name, chrome.nameEn, locale)}
        </h1>
        {description && <p>{description}</p>}
      </div>

      <h2 className="dxm-section-title">
        {locale === "en" ? "All courses" : "全体像"}
      </h2>
      <LazyMandala scope={{ kind: "global" }} locale={locale} />

      <h2 className="dxm-section-title">
        {locale === "en" ? "Series" : "シリーズ"}
      </h2>
      <div className="dxm-card-list">
        {allSeries().map((series) => (
          <Link
            key={series.slug}
            href={localizedHref(series.href, locale)}
            className="dxm-card"
          >
            <span className="dxm-card-title">
              <TitleWithCatch
                title={localized(series.name, series.nameEn, locale)}
                catchCopy={localizedOptional(
                  series.catch,
                  series.catchEn,
                  locale,
                )}
                catchClassName="dxm-card-catch"
              />
            </span>
            {series.description && (
              <span>
                {localizedOptional(
                  series.description,
                  series.descriptionEn,
                  locale,
                )}
              </span>
            )}
            <span className="dxm-card-meta">
              {series.courses.length} {locale === "en" ? "courses" : "コース"}・
              {series.lessonCount} {locale === "en" ? "lessons" : "レッスン"}・
              {formatMinutes(series.totalMinutes, locale)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
