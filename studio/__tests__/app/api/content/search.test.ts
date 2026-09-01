import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET } from "@/app/api/content/search/route";

const roots: string[] = [];
let cwdSpy: ReturnType<typeof vi.spyOn> | undefined;

afterEach(() => {
  cwdSpy?.mockRestore();
  for (const root of roots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  roots.length = 0;
});

function lessonMd(lesson: string, body: string): string {
  return `---
series: Git基礎
course: Git概念
lesson: ${lesson}
status: open
description: ""
tags: []
estimated_minutes: 10
author: Kitamura
---
${body}
`;
}

/** contents/Git基礎/Git概念/{レッスン2本} を持つフィクスチャを作る */
function setup(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "content-search-"));
  roots.push(root);
  // getProjectRoot() は cwd の親を返すため、cwd は root/studio 相当を指す
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));

  const courseDir = path.join(root, "contents", "Git基礎", "Git概念");
  fs.mkdirSync(path.join(courseDir, "三大エリア"), { recursive: true });
  fs.mkdirSync(path.join(courseDir, "コミット入門"), { recursive: true });
  fs.writeFileSync(
    path.join(courseDir, "三大エリア", "contents.md"),
    lessonMd("三大エリア", "ワークツリーとステージの説明。"),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(courseDir, "コミット入門", "contents.md"),
    lessonMd("コミット入門", "セーブポイントを作る操作です。"),
    "utf-8",
  );
  return root;
}

function get(q: string, lang?: "ja" | "en") {
  const langParam = lang ? `&lang=${lang}` : "";
  return GET(
    new Request(
      `http://localhost/api/content/search?q=${encodeURIComponent(q)}${langParam}`,
    ),
  );
}

async function json(res: Response) {
  return (await res.json()) as {
    matches: Array<{ series: string; course?: string; lesson?: string }>;
    truncated: boolean;
  };
}

describe("GET /api/content/search", () => {
  it("レッスン本文の部分一致でレッスンを返す", async () => {
    setup();
    const data = await json(await get("セーブポイント"));
    expect(data.matches).toEqual([
      { series: "Git基礎", course: "Git概念", lesson: "コミット入門" },
    ]);
    expect(data.truncated).toBe(false);
  });

  it("大文字小文字を無視して一致する", async () => {
    setup();
    const data = await json(await get("git基礎"));
    expect(data.matches).toEqual([{ series: "Git基礎" }]);
  });

  it("コース名の一致はコースとして返す", async () => {
    setup();
    const data = await json(await get("Git概念"));
    expect(data.matches).toEqual([{ series: "Git基礎", course: "Git概念" }]);
  });

  it("空クエリは空の一致を返す", async () => {
    setup();
    const data = await json(await get("  "));
    expect(data.matches).toEqual([]);
    expect(data.truncated).toBe(false);
  });

  it("一致しなければ空", async () => {
    setup();
    const data = await json(await get("存在しない語"));
    expect(data.matches).toEqual([]);
  });
});

/**
 * 検索対象は編集言語に連動する（unified-content-tree spec）。
 * 「画面に見えている文字列で検索してヒットしない」を作らないことが要。
 */
describe("GET /api/content/search（言語連動）", () => {
  /** `三大エリア` にだけ英語名と英語本文を与える */
  function setupTranslated(): string {
    const root = setup();
    const courseDir = path.join(root, "contents", "Git基礎", "Git概念");
    fs.writeFileSync(
      path.join(courseDir, "三大エリア", ".meta.json"),
      JSON.stringify({ name_en: "Three areas" }, null, 2),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(courseDir, "三大エリア", "contents.en.md"),
      "<!-- source: sha256:x -->\n\nThe working tree and the staging area.\n",
      "utf-8",
    );
    return root;
  }

  it("英語モードでは name_en でヒットする", async () => {
    setupTranslated();
    const data = await json(await get("Three areas", "en"));
    expect(data.matches).toEqual([
      { series: "Git基礎", course: "Git概念", lesson: "三大エリア" },
    ]);
  });

  it("英語モードでも未訳は日本語名でヒットする", async () => {
    // ⚠ ツリーは未訳を日本語名で表示している。見えている文字列で引けないと破綻する
    setupTranslated();
    const data = await json(await get("コミット入門", "en"));
    expect(data.matches).toEqual([
      { series: "Git基礎", course: "Git概念", lesson: "コミット入門" },
    ]);
  });

  it("英語モードの本文検索は contents.en.md を引く", async () => {
    setupTranslated();
    const data = await json(await get("staging area", "en"));
    expect(data.matches).toEqual([
      { series: "Git基礎", course: "Git概念", lesson: "三大エリア" },
    ]);
  });

  it("英語モードで日本語本文へフォールバックしない", async () => {
    // 「セーブポイント」は日本語本文にしか無い。英語ビューに一致が無いので出さない
    setupTranslated();
    const data = await json(await get("セーブポイント", "en"));
    expect(data.matches).toEqual([]);
  });

  it("日本語モードは英語本文を引かない", async () => {
    setupTranslated();
    const data = await json(await get("staging area", "ja"));
    expect(data.matches).toEqual([]);
  });

  it("日本語モードは name_en を引かない", async () => {
    setupTranslated();
    const data = await json(await get("Three areas", "ja"));
    expect(data.matches).toEqual([]);
  });

  it("lang 省略時は従来（日本語）と同じ結果", async () => {
    setupTranslated();
    const omitted = await json(await get("セーブポイント"));
    const explicit = await json(await get("セーブポイント", "ja"));
    expect(omitted.matches).toEqual(explicit.matches);
    expect(omitted.matches).toEqual([
      { series: "Git基礎", course: "Git概念", lesson: "コミット入門" },
    ]);
  });
});
