/**
 * 変更履歴（contents/changelog.md → content/changelog.md）の要件:
 * - 正本はパースせず丸ごとコピー（本文に手を入れない）
 * - 正本が無ければページも _meta 項目も出さない（ビルドは成功）
 * - /en は changelog.en.md → 無ければ Coming soon（日本語へフォールバックしない）
 * - ルート _meta の最後尾に「変更履歴」/"Changelog"
 * - シリーズ slug "changelog" は予約語として弾く
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadChangelog } from "../scripts/lib/content-source.mts";
import { changelogTitle, emitChangelogPage, emitMetaFiles } from "../scripts/lib/emit.mts";
import { validateSlugs, formatSlugIssues } from "../scripts/lib/site-model.mts";
import type { ContentsRoot } from "../scripts/lib/content-source.mts";
import type { SiteData, SiteSeries } from "../scripts/lib/site-model.mts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

function makeContentsDir(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-test-"));
  roots.push(root);
  const contentsDir = path.join(root, "contents");
  fs.mkdirSync(contentsDir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(contentsDir, name), body, "utf-8");
  }
  return contentsDir;
}

const JA_BODY = "# 変更履歴\n\n主な更新のみ。\n\n## 2026-08-21\n\n- 新設\n";

describe("loadChangelog", () => {
  it("正本を読む（en 無しでは bodyEn を持たない）", () => {
    const dir = makeContentsDir({ "changelog.md": JA_BODY });
    const changelog = loadChangelog(dir);
    expect(changelog).not.toBeNull();
    expect(changelog?.body).toBe(JA_BODY);
    expect(changelog?.bodyEn).toBeUndefined();
  });

  it("正本が無ければ null（ビルドを止めない）", () => {
    const dir = makeContentsDir({});
    expect(loadChangelog(dir)).toBeNull();
  });

  it("changelog.en.md があれば bodyEn に読む", () => {
    const dir = makeContentsDir({
      "changelog.md": JA_BODY,
      "changelog.en.md": "# Changelog\n\n- added\n",
    });
    expect(loadChangelog(dir)?.bodyEn).toBe("# Changelog\n\n- added\n");
  });
});

describe("emitChangelogPage", () => {
  it("日本語: 本文をそのままコピーし、検索除外の searchable: false を持つ", () => {
    const file = emitChangelogPage({ body: JA_BODY }, "ja");
    expect(file.relativePath).toBe("changelog.md");
    // 本文は 1 文字も変えない（frontmatter の後にそのまま続く）
    expect(file.contents.endsWith(`---\n\n${JA_BODY}`)).toBe(true);
    expect(file.contents).toContain('searchable: false');
    expect(file.contents).toContain('title: "変更履歴"');
    expect(file.contents).not.toContain("translation:");
  });

  it("英語: en 無しでは日本語へフォールバックせず Coming soon にする", () => {
    const file = emitChangelogPage({ body: JA_BODY }, "en");
    expect(file.relativePath).toBe("en/changelog.md");
    // ⚠ 日本語本文を書かない（レッスンと同じ規則）
    expect(file.contents).not.toContain("主な更新のみ。");
    expect(file.contents).toContain("Coming soon");
    expect(file.contents).toContain("](/changelog)");
    expect(file.contents).toContain('title: "Changelog"');
    expect(file.contents).not.toContain("translation:");
  });

  it("英語: changelog.en.md があればその本文を出す", () => {
    const file = emitChangelogPage(
      { body: JA_BODY, bodyEn: "# Changelog\n\n## 2026-08-21\n\n- added\n" },
      "en",
    );
    expect(file.contents).toContain("- added");
    expect(file.contents).not.toContain("Coming soon");
    expect(file.contents).not.toContain("translation:");
  });

  it("英語: 先頭エントリが日本語側より古くてもバッジを出さない", () => {
    const file = emitChangelogPage(
      { body: JA_BODY, bodyEn: "# Changelog\n\n## 2026-08-15\n\n- old\n" },
      "en",
    );
    // 鮮度の合図は Studio 側だけが持つ（受講者は対処できない）
    expect(file.contents).not.toContain("translation:");
    expect(file.contents).not.toContain("locale:");
    // 本文は英語版のまま（日本語へは差し替えない）
    expect(file.contents).toContain("- old");
  });
});

const data = {
  series: [
    {
      name: "Git基礎シリーズ",
      nameEn: "Git Basics",
      slug: "git",
      courses: [],
    } as unknown as SiteSeries,
  ],
  siteDescription: "",
} as unknown as SiteData;

describe("emitMetaFiles の変更履歴項目", () => {
  it("hasChangelog で最後尾に出る（ja/en とも）", () => {
    for (const locale of ["ja", "en"] as const) {
      const root = emitMetaFiles(data, locale, { hasChangelog: true }).find(
        (f) => f.relativePath.endsWith("_meta.tsx"),
      );
      expect(root).toBeDefined();
      const body = root!.contents;
      expect(body).toContain(JSON.stringify(changelogTitle(locale)));
      // 最後のエントリ行が changelog であること（並び順の検証）
      const entryLines = body
        .split("\n")
        .filter((line) => line.startsWith('  "'));
      expect(entryLines.at(-1)).toContain('"changelog"');
    }
  });

  it("既定（正本なし）では出ない", () => {
    const root = emitMetaFiles(data, "ja").find((f) =>
      f.relativePath.endsWith("_meta.tsx"),
    );
    expect(root!.contents).not.toContain("changelog");
  });
});

describe("予約 slug", () => {
  it('シリーズ slug "changelog" を弾く', () => {
    const root = {
      series: [
        { name: "履歴シリーズ", slug: "changelog", courses: [] },
      ],
    } as unknown as ContentsRoot;
    const issues = validateSlugs(root);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe("reserved");
    expect(formatSlugIssues(issues)).toContain("予約されています");
  });

  it('コース slug "changelog" は URL が衝突しないので許す', () => {
    const root = {
      series: [
        {
          name: "S",
          slug: "s",
          courses: [{ name: "C", slug: "changelog", lessons: [] }],
        },
      ],
    } as unknown as ContentsRoot;
    expect(validateSlugs(root)).toHaveLength(0);
  });
});
