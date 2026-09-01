import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  emitIndexPages,
  emitLessonMarkdown,
  emitMetaFile,
  emitMetaFiles,
  localeContentPrefix,
  localizedHref,
  type EmittedFile,
} from "../scripts/lib/emit.mts";
import {
  BlobModeNotImplementedError,
  copyCanonicalImages,
  resolveImagesForMode,
  rewriteImageRefs,
} from "../scripts/lib/images.mts";
import type {
  SiteCourse,
  SiteData,
  SiteLesson,
  SiteSeries,
} from "../scripts/lib/site-model.mts";

const series = {
  name: "Git基礎シリーズ",
  nameEn: "Git Basics",
  slug: "git",
  courses: [],
  href: "/git",
  totalMinutes: 15,
  lessonCount: 1,
} as unknown as SiteSeries;

const course = {
  name: "Git概念コース",
  slug: "concepts",
  lessons: [],
  href: "/git/concepts",
  totalMinutes: 15,
  crossSeriesPrev: [],
  crossSeriesNext: [],
} as unknown as SiteCourse;

const lesson: SiteLesson = {
  name: "バージョン管理ってなに？",
  slug: "what-is-version-control",
  stableId: "lsn-what-is-version-control-aaa111",
  status: "done",
  description: "説明: コロンを含む文",
  estimatedMinutes: 15,
  author: "Kitamura",
  body: "# 本文\n",
  translation: "untranslated" as const,
  href: "/git/concepts/what-is-version-control",
  dir: "/tmp/lesson",
};

describe("emitLessonMarkdown", () => {
  it("日本語版の frontmatter を出す", () => {
    const md = emitLessonMarkdown(lesson, series, course, "ja", "# 本文\n");
    expect(md).toContain('title: "バージョン管理ってなに？"');
    expect(md).toContain("lessonStatus: done");
    expect(md).toContain("estimatedMinutes: 15");
    expect(md).toContain('seriesHref: "/git"');
    expect(md).toContain('courseHref: "/git/concepts"');
    expect(md).not.toContain("untranslated");
  });

  it("コロンを含む値を壊さない", () => {
    const md = emitLessonMarkdown(lesson, series, course, "ja", "# 本文\n");
    expect(md).toContain('description: "説明: コロンを含む文"');
  });

  it("英語版で未翻訳なら本文を Coming soon に差し替える", () => {
    const md = emitLessonMarkdown(lesson, series, course, "en", "# 本文\n");
    // ⚠ 日本語本文を書かない（書くと Pagefind の英語索引が日本語で汚染される）
    expect(md).not.toContain("# 本文");
    expect(md).toContain("Coming soon");
    // 内容へ辿り着く手段として日本語版へのリンクを残す
    expect(md).toContain("](/git/concepts/what-is-version-control)");
    expect(md).toContain('seriesHref: "/en/git"');
    expect(md).toContain('seriesName: "Git Basics"');
  });

  it("Coming soon は見出しを含まない（TOC に出さない）", () => {
    const md = emitLessonMarkdown(lesson, series, course, "en", "# 本文\n");
    const body = md.split("---").slice(2).join("---");
    expect(body).not.toMatch(/^#/m);
  });

  it("古い翻訳でも翻訳バッジを出さない", () => {
    const stale = {
      ...lesson,
      bodyEn: "# Body\n",
      translation: "stale" as const,
    };
    const md = emitLessonMarkdown(stale, series, course, "en", "# Body\n");
    expect(md).not.toContain("translation:");
    expect(md).toContain("# Body");
    // 執筆状況のラベルは翻訳とは別の軸なので残る
    expect(md).toContain("lessonStatus: done");
  });

  it("英語版があればその本文を出す（バッジは無し）", () => {
    const translated = {
      ...lesson,
      bodyEn: "# Body\n",
      translation: undefined,
      titleEn: "What is version control?",
    };
    const md = emitLessonMarkdown(translated, series, course, "en", "# Body\n");
    expect(md).not.toContain("translation:");
    expect(md).not.toContain("Coming soon");
    expect(md).toContain("# Body");
    expect(md).toContain('title: "What is version control?"');
  });

  it("ラベル行が使う author と courseStyle を出す", () => {
    const styledCourse = { ...course, style: "lecture" } as SiteCourse;
    const md = emitLessonMarkdown(lesson, series, styledCourse, "ja", "# 本文\n");
    expect(md).toContain('author: "Kitamura"');
    expect(md).toContain("courseStyle: lecture");
  });

  it("style 未設定・author 空なら該当行を出さない", () => {
    const md = emitLessonMarkdown(
      { ...lesson, author: "" },
      series,
      course,
      "ja",
      "# 本文\n",
    );
    expect(md).not.toContain("author:");
    expect(md).not.toContain("courseStyle:");
  });

  it("著者は双方向フォールバックで解決する", () => {
    // 表記を書き分けた著者: ja は author、en は author_en
    const both = { ...lesson, author: "北村", authorEn: "Kitamura" };
    expect(emitLessonMarkdown(both, series, course, "ja", "# 本文\n")).toContain(
      'author: "北村"',
    );
    expect(emitLessonMarkdown(both, series, course, "en", "# body\n")).toContain(
      'author: "Kitamura"',
    );

    // author_en だけが書かれている: 日本語ページでも author_en が出る
    const enOnly = { ...lesson, author: "", authorEn: "Kitamura" };
    expect(
      emitLessonMarkdown(enOnly, series, course, "ja", "# 本文\n"),
    ).toContain('author: "Kitamura"');

    // 英語名のみの著者: author だけで両ページに出る
    const jaOnly = { ...lesson, author: "John Smith", authorEn: undefined };
    expect(
      emitLessonMarkdown(jaOnly, series, course, "en", "# body\n"),
    ).toContain('author: "John Smith"');
  });
});

describe("emitMetaFile", () => {
  it("slug をキーに日本語表示名を割り当てる", () => {
    const contents = emitMetaFile([
      { slug: "git", title: "Git基礎シリーズ" },
      { slug: "start", title: "はじめにシリーズ" },
    ]);
    expect(contents).toContain('"git": "Git基礎シリーズ"');
    // 並びは配列順（= order 順）
    expect(contents.indexOf('"git"')).toBeLessThan(contents.indexOf('"start"'));
  });

  it("theme を持つ項目はページ設定オブジェクトで出す", () => {
    const contents = emitMetaFile([
      { slug: "index", title: "トップ", theme: { breadcrumb: false } },
    ]);
    expect(contents).toContain(
      '"index": {"title":"トップ","theme":{"breadcrumb":false}}',
    );
  });
});

describe("emitMetaFiles / emitIndexPages", () => {
  const data = {
    siteDescription: "全体の説明",
    siteDescriptionEn: "Overall",
    series: [
      {
        ...series,
        courses: [{ ...course, lessons: [lesson] }],
      },
    ],
  } as unknown as SiteData;

  function fileOf(files: EmittedFile[], relativePath: string): string {
    const found = files.find((f) => f.relativePath === relativePath);
    if (!found) throw new Error(`not emitted: ${relativePath}`);
    return found.contents;
  }

  it("シリーズ・コース階層に「概要」の項目を出さない", () => {
    const files = emitMetaFiles(data, "ja");
    expect(fileOf(files, "git/_meta.js")).not.toContain("概要");
    expect(fileOf(files, "git/concepts/_meta.js")).not.toContain("概要");
    // コース・レッスンの項目自体は出る
    expect(fileOf(files, "git/_meta.js")).toContain('"concepts"');
    expect(fileOf(files, "git/concepts/_meta.js")).toContain(
      '"what-is-version-control"',
    );
  });

  it("英語側も Overview を出さない", () => {
    const files = emitMetaFiles(data, "en");
    expect(fileOf(files, "en/git/_meta.js")).not.toContain("Overview");
  });

  it("ルートは「ホーム」項目を残し、パンくずを無効にする", () => {
    const contents = fileOf(emitMetaFiles(data, "ja"), "_meta.tsx");
    expect(contents).toContain('"index"');
    expect(contents).toContain("ホーム");
    expect(contents).not.toContain("トップ");
    expect(contents).toContain('"breadcrumb":false');
  });

  it("英語ルートは Home", () => {
    const contents = fileOf(emitMetaFiles(data, "en"), "en/_meta.tsx");
    expect(contents).toContain("Home");
  });

  it("ルートだけ `.tsx` で、ホーム項目に House アイコンを付ける", () => {
    for (const [locale, path] of [
      ["ja", "_meta.tsx"],
      ["en", "en/_meta.tsx"],
    ] as const) {
      const files = emitMetaFiles(data, locale);
      const contents = fileOf(files, path);
      // Nextra の `_meta` は title に React 要素を認めている
      expect(contents).toContain('import { House } from "lucide-react";');
      expect(contents).toContain('<span className="dxm-home-item">');
      expect(contents).toContain("<House aria-hidden />");
      // シリーズ以下は素の文字列のまま（`.js` で出す）
      expect(files.some((f) => f.relativePath.endsWith("_meta.js"))).toBe(true);
    }
  });

  it("シリーズはパンくずを切り、コース以下で戻す", () => {
    // `theme` は子へ継承されるので、シリーズで切ったままだと
    // コース・レッスンのパンくずまで消える
    const files = emitMetaFiles(data, "ja");
    expect(fileOf(files, "_meta.tsx")).toContain(
      '"git": {"title":"Git基礎シリーズ","theme":{"breadcrumb":false}}',
    );
    expect(fileOf(files, "git/_meta.js")).toContain('"breadcrumb":true');
  });

  it("シリーズ・コースの index はフォルダ自身のページになる", () => {
    const files = emitIndexPages(data, "ja");
    expect(fileOf(files, "git/index.mdx")).toContain("asIndexPage: true");
    expect(fileOf(files, "git/concepts/index.mdx")).toContain(
      "asIndexPage: true",
    );
    // 全体トップはルートなので付けない
    expect(fileOf(files, "index.mdx")).not.toContain("asIndexPage");
  });
});

describe("locale パス", () => {
  it("日本語はルート、英語は /en", () => {
    expect(localizedHref("/git/concepts", "ja")).toBe("/git/concepts");
    expect(localizedHref("/git/concepts", "en")).toBe("/en/git/concepts");
    expect(localizedHref("/", "en")).toBe("/en");
    expect(localeContentPrefix("ja")).toBe("");
    expect(localeContentPrefix("en")).toBe("en/");
  });
});

describe("rewriteImageRefs", () => {
  it("markdown 画像の参照を /images へ書き換える", () => {
    const { body, referenced } = rewriteImageRefs("![図](images/a.png)\n");
    expect(body).toBe("![図](/images/a.png)\n");
    expect(referenced).toEqual(["a.png"]);
  });

  it("img タグも書き換える", () => {
    const { body, referenced } = rewriteImageRefs(
      '<img src="images/b.png" alt="b">',
    );
    expect(body).toContain('src="/images/b.png"');
    expect(referenced).toEqual(["b.png"]);
  });

  it("同じ画像を重複して数えない", () => {
    const { referenced } = rewriteImageRefs(
      "![a](images/a.png)\n![a again](images/a.png)",
    );
    expect(referenced).toEqual(["a.png"]);
  });

  it("外部 URL は触らない", () => {
    const src = "![外部](https://example.com/images/x.png)";
    expect(rewriteImageRefs(src).body).toBe(src);
  });

  it("Blob モードは未実装エラーで止まる", () => {
    expect(() => resolveImagesForMode("![a](images/a.png)", "blob")).toThrow(
      BlobModeNotImplementedError,
    );
  });
});

describe("copyCanonicalImages", () => {
  it("実体をコピーし、無いものは missing で返す", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "site-images-"));
    const canonical = path.join(tmp, "images");
    const publicDir = path.join(tmp, "public", "images");
    fs.mkdirSync(canonical, { recursive: true });
    fs.writeFileSync(path.join(canonical, "a.png"), "dummy");

    const result = copyCanonicalImages(
      ["a.png", "missing.png"],
      canonical,
      publicDir,
    );

    expect(result.copied).toEqual(["a.png"]);
    expect(result.missing).toEqual(["missing.png"]);
    expect(fs.existsSync(path.join(publicDir, "a.png"))).toBe(true);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
