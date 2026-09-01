import { describe, expect, it } from "vitest";
import {
  buildMandalaGraph,
  buildSiteData,
  formatSlugIssues,
  resolveSiteChrome,
  validateSlugs,
} from "../scripts/lib/site-model.mts";
import type { ContentsRoot } from "../scripts/lib/content-source.mts";
import {
  computeBodySourceHash,
  formatSourceHashComment,
} from "../scripts/lib/translation-freshness.mts";

function lesson(name: string, slug: string | undefined, overrides = {}) {
  return {
    name,
    slug,
    id: `lsn-${slug}-aaa111`,
    status: "done" as const,
    description: `${name} の説明`,
    tags: [],
    estimatedMinutes: 15,
    author: "Kitamura",
    body: `# ${name}\n`,
    dir: `/tmp/${name}`,
    ...overrides,
  };
}

function root(overrides: Partial<ContentsRoot> = {}): ContentsRoot {
  return {
    description: "全体の説明",
    series: [
      {
        name: "Git基礎シリーズ",
        id: "srs-git",
        slug: "git",
        catch: "セーブポイントのある開発へ",
        cover: "cover-git.png",
        courses: [
          {
            name: "Git概念コース",
            id: "crs-concepts",
            slug: "concepts",
            crossSeriesPrev: ["crs-setup"],
            crossSeriesNext: [],
            lessons: [
              lesson("バージョン管理ってなに？", "what-is-version-control"),
            ],
            dir: "/tmp/concepts",
          },
          {
            name: "Git基本操作コース",
            id: "crs-basics",
            slug: "basics",
            crossSeriesPrev: [],
            crossSeriesNext: [],
            lessons: [
              lesson("最初のコミット", "first-commit", {
                estimatedMinutes: 20,
              }),
            ],
            dir: "/tmp/basics",
          },
        ],
        dir: "/tmp/git",
      },
      {
        name: "はじめにシリーズ",
        id: "srs-start",
        slug: "start",
        courses: [
          {
            name: "開発環境準備コース",
            id: "crs-setup",
            slug: "setup",
            crossSeriesPrev: [],
            crossSeriesNext: ["crs-concepts"],
            lessons: [lesson("VSCode", "vscode")],
            dir: "/tmp/setup",
          },
        ],
        dir: "/tmp/start",
      },
    ],
    ...overrides,
  };
}

describe("validateSlugs", () => {
  it("すべて揃っていれば問題を返さない", () => {
    expect(validateSlugs(root())).toEqual([]);
  });

  it("欠落を検出する", () => {
    const r = root();
    r.series[0]!.courses[0]!.slug = undefined;
    const issues = validateSlugs(r);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      reason: "missing",
      path: "Git基礎シリーズ/Git概念コース",
    });
  });

  it("形式違反を検出する", () => {
    const r = root();
    r.series[0]!.slug = "Git基礎";
    const issues = validateSlugs(r);
    expect(issues[0]).toMatchObject({ reason: "invalid", slug: "Git基礎" });
  });

  it("兄弟間の重複を検出する", () => {
    const r = root();
    r.series[0]!.courses[1]!.slug = "concepts";
    const issues = validateSlugs(r);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ reason: "duplicate", slug: "concepts" });
  });

  it("親が違えば同じ slug を許す", () => {
    const r = root();
    r.series[0]!.courses[1]!.slug = "setup"; // 別シリーズの setup と同名
    expect(validateSlugs(r)).toEqual([]);
  });

  it("レッスンの欠落も検出する", () => {
    const r = root();
    r.series[0]!.courses[0]!.lessons[0]!.slug = undefined;
    const issues = validateSlugs(r);
    expect(issues[0]!.path).toBe(
      "Git基礎シリーズ/Git概念コース/バージョン管理ってなに？",
    );
  });

  it("エラーメッセージに対象と理由が含まれる", () => {
    const r = root();
    r.series[0]!.courses[0]!.slug = undefined;
    const message = formatSlugIssues(validateSlugs(r));
    expect(message).toContain("Git基礎シリーズ/Git概念コース");
    expect(message).toContain("slug が設定されていません");
  });
});

describe("buildSiteData", () => {
  it("slug から URL を組み立てる", () => {
    const data = buildSiteData(root());
    const series = data.series[0]!;
    expect(series.href).toBe("/git");
    expect(series.courses[0]!.href).toBe("/git/concepts");
    expect(series.courses[0]!.lessons[0]!.href).toBe(
      "/git/concepts/what-is-version-control",
    );
  });

  it("所要時間とレッスン数を集計する", () => {
    const data = buildSiteData(root());
    const series = data.series[0]!;
    expect(series.courses[1]!.totalMinutes).toBe(20);
    expect(series.totalMinutes).toBe(35);
    expect(series.lessonCount).toBe(2);
  });

  it("英語版が無いレッスンを未翻訳として印す", () => {
    const data = buildSiteData(root());
    expect(data.series[0]!.courses[0]!.lessons[0]!.translation).toBe(
      "untranslated",
    );
  });

  it("ハッシュ一致の英語版はバッジ無し（キー自体を持たない）", () => {
    const r = root();
    const jaBody = r.series[0]!.courses[0]!.lessons[0]!.body;
    r.series[0]!.courses[0]!.lessons[0]!.bodyEn =
      `${formatSourceHashComment(computeBodySourceHash(jaBody))}\n\n# What is version control\n`;
    const data = buildSiteData(r);
    const emitted = data.series[0]!.courses[0]!.lessons[0]!;
    expect(emitted.translation).toBeUndefined();
    // ハッシュコメント行はページ本文に出さない
    expect(emitted.bodyEn).toBe("# What is version control\n");
  });

  it("ハッシュ不一致・未記録の英語版は stale として印す", () => {
    const withStaleHash = root();
    withStaleHash.series[0]!.courses[0]!.lessons[0]!.bodyEn =
      `${formatSourceHashComment(computeBodySourceHash("古い原文"))}\n# Old translation\n`;
    expect(
      buildSiteData(withStaleHash).series[0]!.courses[0]!.lessons[0]!
        .translation,
    ).toBe("stale");

    const withoutHash = root();
    withoutHash.series[0]!.courses[0]!.lessons[0]!.bodyEn =
      "# What is version control\n";
    expect(
      buildSiteData(withoutHash).series[0]!.courses[0]!.lessons[0]!.translation,
    ).toBe("stale");
  });

  it("コースの target_en を伝える", () => {
    const r = root();
    r.series[0]!.courses[0]!.targetEn = "Beginners";
    const data = buildSiteData(r);
    expect(data.series[0]!.courses[0]!.targetEn).toBe("Beginners");
  });

  it("コースの style を伝える", () => {
    const r = root();
    r.series[0]!.courses[0]!.style = "hands-on";
    const data = buildSiteData(r);
    expect(data.series[0]!.courses[0]!.style).toBe("hands-on");
    // ④ の曼陀羅ラベルが読むため、ノード側にも載せる
    const graph = buildMandalaGraph(data.series);
    expect(graph.nodes[0]!.style).toBe("hands-on");
  });

  it("style 未設定のコースには持たせない", () => {
    const data = buildSiteData(root());
    expect(data.series[0]!.courses[0]!.style).toBeUndefined();
  });
});

describe("buildMandalaGraph", () => {
  it("コースをノードにする", () => {
    const graph = buildMandalaGraph(buildSiteData(root()).series);
    expect(graph.nodes.map((n) => n.id)).toEqual([
      "crs-concepts",
      "crs-basics",
      "crs-setup",
    ]);
    expect(graph.nodes[0]).toMatchObject({
      label: "Git概念コース",
      seriesSlug: "git",
      href: "/git/concepts",
      lessonCount: 1,
      totalMinutes: 15,
      status: "done",
    });
    // 未設定のコースはノードにも持たせない
    expect(graph.nodes[0]!.style).toBeUndefined();
  });

  it("英語名をノードに載せ、未訳ではキーを持たない", () => {
    const r = root();
    r.series[0]!.nameEn = "Git Fundamentals Series";
    r.series[0]!.courses[0]!.nameEn = "Git Concepts Course";
    const graph = buildMandalaGraph(buildSiteData(r).series);

    expect(graph.nodes[0]).toMatchObject({
      label: "Git概念コース",
      labelEn: "Git Concepts Course",
      seriesName: "Git基礎シリーズ",
      seriesNameEn: "Git Fundamentals Series",
    });
    // 未訳のコースは英語名のキーを持たない（表示側が日本語へフォールバックする）
    expect(graph.nodes[1]!.labelEn).toBeUndefined();
    expect(graph.nodes[1]!.seriesNameEn).toBe("Git Fundamentals Series");
  });

  it("同一シリーズの並びを order 辺にする", () => {
    const graph = buildMandalaGraph(buildSiteData(root()).series);
    const orderEdges = graph.edges.filter((e) => e.kind === "order");
    expect(orderEdges).toHaveLength(1);
    expect(orderEdges[0]).toMatchObject({
      source: "crs-concepts",
      target: "crs-basics",
    });
  });

  it("シリーズ跨ぎを cross 辺にし、重複を作らない", () => {
    const graph = buildMandalaGraph(buildSiteData(root()).series);
    const crossEdges = graph.edges.filter((e) => e.kind === "cross");
    // prev 側と next 側の両方から同じ辺が来ても1本
    expect(crossEdges).toHaveLength(1);
    expect(crossEdges[0]).toMatchObject({
      source: "crs-setup",
      target: "crs-concepts",
    });
  });

  it("相手が存在しない cross 参照は辺にしない", () => {
    const r = root();
    r.series[0]!.courses[0]!.crossSeriesPrev = ["crs-does-not-exist"];
    r.series[1]!.courses[0]!.crossSeriesNext = [];
    const graph = buildMandalaGraph(buildSiteData(r).series);
    expect(graph.edges.filter((e) => e.kind === "cross")).toHaveLength(0);
  });

  it("コース内レッスンの status を畳んでノードの状態にする", () => {
    const r = root();
    r.series[0]!.courses[0]!.lessons.push(
      lesson("次のレッスン", "next", { status: "open" }),
    );
    const graph = buildMandalaGraph(buildSiteData(r).series);
    expect(graph.nodes[0]!.status).toBe("in_progress");
  });
});

describe("resolveSiteChrome", () => {
  const config = {
    siteName: "DX Training Mandala",
    repositoryUrl: "https://github.com/",
  };

  it("全体メタの値が優先される", () => {
    expect(
      resolveSiteChrome(
        {
          name: "上書き名",
          nameEn: "Override",
          hero: "hero-2.png",
          githubUrl: "https://github.com/x/y",
        },
        config,
      ),
    ).toEqual({
      name: "上書き名",
      nameEn: "Override",
      githubUrl: "https://github.com/x/y",
      hero: "hero-2.png",
    });
  });

  it("未設定は site.config.json / 同梱 hero（null）へフォールバックする", () => {
    expect(resolveSiteChrome({}, config)).toEqual({
      name: "DX Training Mandala",
      githubUrl: "https://github.com/",
      hero: null,
    });
  });
});
