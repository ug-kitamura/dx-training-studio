/**
 * 全体（contents/.meta.json）のサイト表示フィールド（name / hero / github_url）の
 * 読み取り規則。値の解決（site.config.json フォールバック）は build-content が行う。
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadContents } from "../scripts/lib/content-source.mts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

/** シリーズ1・コース1・レッスン1 の最小構成を作り、ルートメタを読む */
function loadRoot(rootMeta: Record<string, unknown>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "content-source-chrome-"));
  roots.push(root);
  const contentsDir = path.join(root, "contents");
  const courseDir = path.join(contentsDir, "S", "C");
  const lessonDir = path.join(courseDir, "L");
  fs.mkdirSync(lessonDir, { recursive: true });
  fs.writeFileSync(
    path.join(lessonDir, "contents.md"),
    `---\nseries: S\ncourse: C\nlesson: L\nslug: l\nstatus: done\ndescription: d\ntags: []\nestimated_minutes: 10\nauthor: a\n---\n\n本文\n`,
    "utf-8",
  );
  fs.writeFileSync(
    path.join(courseDir, ".meta.json"),
    JSON.stringify({ slug: "c", order: ["L"] }),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(contentsDir, "S", ".meta.json"),
    JSON.stringify({ slug: "s", order: ["C"] }),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(contentsDir, ".meta.json"),
    JSON.stringify({ order: ["S"], ...rootMeta }),
    "utf-8",
  );
  return loadContents(contentsDir);
}

describe("全体メタのサイト表示フィールド", () => {
  it("name / hero / github_url を読み取る", () => {
    const root = loadRoot({
      name: "DX Training Mandala",
      name_en: "DX Training Mandala (en)",
      hero: "hero-1.png",
      github_url: "https://github.com/x/y",
    });
    expect(root.name).toBe("DX Training Mandala");
    expect(root.nameEn).toBe("DX Training Mandala (en)");
    expect(root.hero).toBe("hero-1.png");
    expect(root.githubUrl).toBe("https://github.com/x/y");
  });

  it("キーが無ければ未設定（既存正本の後方互換）", () => {
    const root = loadRoot({});
    expect(root.name).toBeUndefined();
    expect(root.hero).toBeUndefined();
    expect(root.githubUrl).toBeUndefined();
    expect(root.series).toHaveLength(1);
  });
});
