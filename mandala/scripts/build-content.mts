/**
 * 正本（`../contents`）から Nextra の入力（`content/`）とサイトデータ（`content/site-data.json`）を生成する。
 *
 * 生成物は毎回作り直す前提で git 追跡対象外。`npm run build` が最初に実行する。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadChangelog, loadContents } from "./lib/content-source.mts";
import {
  buildSiteData,
  formatSlugIssues,
  resolveSiteChrome,
  validateSlugs,
  type SiteData,
} from "./lib/site-model.mts";
import {
  copyCanonicalImages,
  resolveImagesForMode,
  type ImageSource,
} from "./lib/images.mts";
import {
  emitChangelogPage,
  emitIndexPages,
  emitLessonMarkdown,
  emitMetaFiles,
  localeContentPrefix,
  type EmittedFile,
  type Locale,
} from "./lib/emit.mts";

const siteRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
// siteRoot（mandala/）の親は入れ物 dx-training-studio/ で、正本はその直下にある（兄弟構成）
const containerRoot = path.resolve(siteRoot, "..");
const contentsDir = path.join(containerRoot, "contents");
const canonicalImagesDir = path.join(containerRoot, "images");
const outputContentDir = path.join(siteRoot, "content");
const publicImagesDir = path.join(siteRoot, "public", "images");

const LOCALES: Locale[] = ["ja", "en"];

type SiteConfig = {
  siteName: string;
  imageSource: ImageSource;
  repositoryUrl: string;
};

function readSiteConfig(): SiteConfig {
  const raw = fs.readFileSync(path.join(siteRoot, "site.config.json"), "utf-8");
  return JSON.parse(raw) as SiteConfig;
}

function resetDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(baseDir: string, file: EmittedFile): void {
  const target = path.join(baseDir, file.relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, file.contents, "utf-8");
}

/** レッスン `.md` を全ロケール分そろえる。英語版が無ければ日本語本文にフォールバックする */
function emitLessons(
  data: SiteData,
  imageSource: ImageSource,
): {
  files: EmittedFile[];
  referencedImages: Set<string>;
} {
  const files: EmittedFile[] = [];
  const referencedImages = new Set<string>();

  for (const locale of LOCALES) {
    const prefix = localeContentPrefix(locale);
    for (const series of data.series) {
      for (const course of series.courses) {
        for (const lesson of course.lessons) {
          const sourceBody =
            locale === "en" && lesson.bodyEn !== undefined
              ? lesson.bodyEn
              : lesson.body;
          const { body, referenced } = resolveImagesForMode(
            sourceBody,
            imageSource,
          );
          for (const name of referenced) referencedImages.add(name);

          files.push({
            relativePath: `${prefix}${series.slug}/${course.slug}/${lesson.slug}.md`,
            contents: emitLessonMarkdown(lesson, series, course, locale, body),
          });
        }
      }
    }
  }

  return { files, referencedImages };
}

function main(): void {
  const config = readSiteConfig();

  const root = loadContents(contentsDir);
  if (root.series.length === 0) {
    console.error(`正本が見つかりません: ${contentsDir}`);
    process.exit(1);
  }

  const issues = validateSlugs(root);
  if (issues.length > 0) {
    console.error(formatSlugIssues(issues));
    process.exit(1);
  }

  const data = buildSiteData(root);

  // サイト表示フィールドは全体メタ（contents/.meta.json）が優先、
  // 未設定は site.config.json / 同梱 hero.jpg へフォールバックする
  data.site = resolveSiteChrome(root, config);

  resetDir(outputContentDir);
  resetDir(publicImagesDir);

  const { files: lessonFiles, referencedImages } = emitLessons(
    data,
    config.imageSource,
  );
  for (const file of lessonFiles) writeFile(outputContentDir, file);

  // `cover` は読者向けページに出さないのでコピーも実体チェックもしない
  // （表示しない画像の欠落でビルドが落ちるのを避ける）。フィールド自体は正本に残る。

  // 変更履歴（contents/changelog.md）。無ければページも _meta 項目も出さない
  const changelog = loadChangelog(contentsDir);

  for (const locale of LOCALES) {
    for (const file of emitIndexPages(data, locale))
      writeFile(outputContentDir, file);
    for (const file of emitMetaFiles(data, locale, {
      hasChangelog: changelog !== null,
    }))
      writeFile(outputContentDir, file);
    if (changelog) writeFile(outputContentDir, emitChangelogPage(changelog, locale));
  }

  // 全体メタのヒーロー画像は表示に使うので、実体が無ければビルドを止める
  // （本文画像の参照切れ検出と同じ扱い）
  if (data.site.hero) {
    const heroSource = path.join(canonicalImagesDir, data.site.hero);
    if (!fs.existsSync(heroSource)) {
      console.error(
        [
          `全体メタ（contents/.meta.json）の hero が見つかりません: images/${data.site.hero}`,
          `正本の画像置き場: ${canonicalImagesDir}`,
        ].join("\n"),
      );
      process.exit(1);
    }
    fs.mkdirSync(publicImagesDir, { recursive: true });
    fs.copyFileSync(heroSource, path.join(publicImagesDir, data.site.hero));
  }

  if (config.imageSource === "local") {
    const { copied, missing } = copyCanonicalImages(
      [...referencedImages],
      canonicalImagesDir,
      publicImagesDir,
    );
    if (missing.length > 0) {
      console.error(
        [
          `本文が参照する画像の実体が見つかりません（${missing.length} 件）:`,
          ...missing.map((name) => `  - images/${name}`),
          "",
          `正本の画像置き場: ${canonicalImagesDir}`,
        ].join("\n"),
      );
      process.exit(1);
    }
    console.log(`画像: ${copied.length} 件をコピーしました`);
  }

  fs.writeFileSync(
    path.join(outputContentDir, "site-data.json"),
    JSON.stringify(data, null, 2),
    "utf-8",
  );

  const lessonCount = data.series.reduce((sum, s) => sum + s.lessonCount, 0);
  console.log(
    `変換完了: シリーズ ${data.series.length} / コース ${data.series.reduce((n, s) => n + s.courses.length, 0)} / レッスン ${lessonCount}（日英 ${lessonFiles.length} ファイル）`,
  );
}

main();
