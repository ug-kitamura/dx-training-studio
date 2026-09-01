/**
 * site の読み取り専用ローダーが Studio の `lib/contents-loader.ts` とずれていないかを検出する。
 *
 * site は独立プロジェクトで Studio の `lib/` を import しないため（design D2）、
 * 実際の `contents/` を site 側で読んだ結果と、Studio 側で読んだ結果（別プロセスで取得）を突き合わせる。
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadContents } from "../scripts/lib/content-source.mts";
import {
  bodyFreshness,
  computeBodySourceHash,
  computeMetaSourceHash,
} from "../scripts/lib/translation-freshness.mts";

const siteRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
// siteRoot（mandala/）の親は入れ物 dx-training-studio/。正本はその直下、Studio アプリは studio/
const containerRoot = path.resolve(siteRoot, "..");
const studioRoot = path.join(containerRoot, "studio");
const contentsDir = path.join(containerRoot, "contents");

type Shape = {
  series: Array<{
    name: string;
    slug?: string;
    courses: Array<{
      name: string;
      slug?: string;
      style?: string;
      target?: string;
      targetEn?: string;
      lessons: Array<{ name: string; slug?: string; status: string }>;
    }>;
  }>;
};

/** Studio 側のローダーを別プロセスで実行して同じ形に畳む */
function loadViaStudio(): { shape: Shape } | { error: string } {
  const script = `
    import { loadContentsFolder } from "@/lib/contents-loader";
    import { getProjectRoot } from "@/lib/project-root";
    const series = loadContentsFolder(getProjectRoot()).map((s) => ({
      name: s.name,
      slug: s.slug,
      courses: s.courses.map((c) => ({
        name: c.name,
        slug: c.slug,
        style: c.style,
        target: c.target || undefined,
        targetEn: c.target_en,
        lessons: c.lessons.map((l) => ({ name: l.lesson, slug: l.slug, status: l.status })),
      })),
    }));
    process.stdout.write(JSON.stringify({ series }));
  `;
  const scriptPath = path.join(studioRoot, `.parity-probe-${process.pid}.mts`);
  const hooksPath = path.join(
    siteRoot,
    "__tests__",
    "helpers",
    "studio-alias-register.mjs",
  );
  fs.writeFileSync(scriptPath, script, "utf-8");
  try {
    const stdout = execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--no-warnings",
        "--import",
        pathToFileURL(hooksPath).href,
        scriptPath,
      ],
      {
        cwd: studioRoot,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, STUDIO_ROOT: studioRoot },
      },
    );
    return { shape: JSON.parse(stdout) as Shape };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { error: detail };
  } finally {
    fs.rmSync(scriptPath, { force: true });
  }
}

function loadViaSite(): Shape {
  return {
    series: loadContents(contentsDir).series.map((s) => ({
      name: s.name,
      slug: s.slug,
      courses: s.courses.map((c) => ({
        name: c.name,
        slug: c.slug,
        style: c.style,
        target: c.target,
        targetEn: c.targetEn,
        lessons: c.lessons.map((l) => ({
          name: l.name,
          slug: l.slug,
          status: l.status,
        })),
      })),
    })),
  };
}

/**
 * 実 contents/ の全レッスンについて、本文ハッシュ・鮮度3状態・メタハッシュを
 * mandala 側の実装（translation-freshness.mts）で計算する。
 * キーは `シリーズ/コース/レッスン`。メタハッシュは各階層のキーで持つ。
 */
function computeFreshnessViaSite(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const root = loadContents(contentsDir);
  const rootMetaRaw = JSON.parse(
    fs.readFileSync(path.join(contentsDir, ".meta.json"), "utf-8"),
  ) as Record<string, unknown>;
  result["(root)"] = computeMetaSourceHash({
    level: "root",
    name: typeof rootMetaRaw.name === "string" ? rootMetaRaw.name : "",
    description:
      typeof rootMetaRaw.description === "string" ? rootMetaRaw.description : "",
  });
  for (const s of root.series) {
    result[s.name] = computeMetaSourceHash({
      level: "series",
      name: s.name,
      catch: s.catch ?? "",
      description: s.description ?? "",
    });
    for (const c of s.courses) {
      result[`${s.name}/${c.name}`] = computeMetaSourceHash({
        level: "course",
        name: c.name,
        catch: c.catch ?? "",
        description: c.description ?? "",
        target: c.target ?? "",
      });
      for (const l of c.lessons) {
        const enPath = path.join(l.dir, "contents.en.md");
        const enRaw = fs.existsSync(enPath)
          ? fs.readFileSync(enPath, "utf-8")
          : null;
        result[`${s.name}/${c.name}/${l.name}`] = {
          bodyHash: computeBodySourceHash(l.body),
          bodyState: bodyFreshness(l.body, enRaw),
          metaHash: computeMetaSourceHash({
            level: "lesson",
            name: l.name,
            description: l.description,
          }),
        };
      }
    }
  }
  return result;
}

/** Studio 側の freshness lib を別プロセスで実行して同じ形に畳む */
function computeFreshnessViaStudio():
  | { result: Record<string, unknown> }
  | { error: string } {
  const script = `
    import fs from "node:fs";
    import path from "node:path";
    import { loadContentsFolder } from "@/lib/contents-loader";
    import { getProjectRoot } from "@/lib/project-root";
    import {
      bodyFreshness,
      computeBodySourceHash,
      computeMetaSourceHash,
    } from "@/lib/translation/freshness";

    const projectRoot = getProjectRoot();
    const contentsDir = path.join(projectRoot, "contents");
    const readMeta = (dir) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, ".meta.json"), "utf-8"));
      } catch {
        return {};
      }
    };
    const str = (v) => (typeof v === "string" ? v : "");

    const result = {};
    const rootMeta = readMeta(contentsDir);
    result["(root)"] = computeMetaSourceHash({
      level: "root",
      name: str(rootMeta.name),
      description: str(rootMeta.description),
    });
    for (const s of loadContentsFolder(projectRoot)) {
      const seriesDir = path.join(contentsDir, s.name);
      const seriesMeta = readMeta(seriesDir);
      result[s.name] = computeMetaSourceHash({
        level: "series",
        name: s.name,
        catch: str(seriesMeta.catch),
        description: str(seriesMeta.description),
      });
      for (const c of s.courses) {
        const courseDir = path.join(seriesDir, c.name);
        const courseMeta = readMeta(courseDir);
        result[s.name + "/" + c.name] = computeMetaSourceHash({
          level: "course",
          name: c.name,
          catch: str(courseMeta.catch),
          description: str(courseMeta.description),
          target: str(courseMeta.target),
        });
        for (const l of c.lessons) {
          const lessonDir = path.join(courseDir, l.lesson);
          const enPath = path.join(lessonDir, "contents.en.md");
          const enRaw = fs.existsSync(enPath)
            ? fs.readFileSync(enPath, "utf-8")
            : null;
          result[s.name + "/" + c.name + "/" + l.lesson] = {
            bodyHash: computeBodySourceHash(l.content),
            bodyState: bodyFreshness(l.content, enRaw),
            metaHash: computeMetaSourceHash({
              level: "lesson",
              name: l.lesson,
              description: l.description,
            }),
          };
        }
      }
    }
    process.stdout.write(JSON.stringify(result));
  `;
  const scriptPath = path.join(
    studioRoot,
    `.parity-freshness-probe-${process.pid}.mts`,
  );
  const hooksPath = path.join(
    siteRoot,
    "__tests__",
    "helpers",
    "studio-alias-register.mjs",
  );
  fs.writeFileSync(scriptPath, script, "utf-8");
  try {
    const stdout = execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--no-warnings",
        "--import",
        pathToFileURL(hooksPath).href,
        scriptPath,
      ],
      {
        cwd: studioRoot,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, STUDIO_ROOT: studioRoot },
      },
    );
    return { result: JSON.parse(stdout) as Record<string, unknown> };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { error: detail };
  } finally {
    fs.rmSync(scriptPath, { force: true });
  }
}

describe("content-source が Studio のローダーとずれない", () => {
  it("実 contents/ を読んだ構造が一致する", () => {
    const site = loadViaSite();
    expect(site.series.length).toBeGreaterThan(0);

    const studio = loadViaStudio();
    if ("error" in studio) {
      // 実行できないこと自体を失敗にする——スキップすると規則のずれを見逃す
      throw new Error(
        `Studio 側ローダーを実行できませんでした:\n${studio.error}`,
      );
    }
    expect(site).toEqual(studio.shape);
  });

  it("鮮度判定（ハッシュ値と3状態）が Studio 実装と一致する", () => {
    const site = computeFreshnessViaSite();
    expect(Object.keys(site).length).toBeGreaterThan(0);

    const studio = computeFreshnessViaStudio();
    if ("error" in studio) {
      throw new Error(
        `Studio 側の鮮度判定を実行できませんでした:\n${studio.error}`,
      );
    }
    expect(site).toEqual(studio.result);
  });

  it("`_` / `.` 始まりのディレクトリを構造に含めない", () => {
    const site = loadViaSite();
    const names = [
      ...site.series.map((s) => s.name),
      ...site.series.flatMap((s) => s.courses.map((c) => c.name)),
    ];
    expect(names.some((n) => n.startsWith("_") || n.startsWith("."))).toBe(
      false,
    );
  });
});
