import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildContentsMetaSnapshot } from "../../scripts/generate-contents-meta.mjs";
import { readMetaJson } from "@/lib/contents-loader";
import { readBakedMeta } from "@/lib/contents-meta-baked";
import bakedContentsMeta from "@/lib/contents-meta.generated.json";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
  delete process.env.VERCEL;
});

function writeMeta(dir: string, data: Record<string, unknown>): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, ".meta.json"), JSON.stringify(data), "utf-8");
}

/** contents/ を模したツリー（シリーズ → コース → レッスン） */
function makeContentsDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "contents-meta-"));
  tmpDirs.push(root);
  const contentsDir = path.join(root, "contents");
  writeMeta(contentsDir, { name: "全体", order: ["シリーズA"] });
  writeMeta(path.join(contentsDir, "シリーズA"), { id: "srs-a" });
  writeMeta(path.join(contentsDir, "シリーズA", "コースB"), { id: "crs-b" });
  writeMeta(path.join(contentsDir, "シリーズA", "コースB", "レッスンC"), {
    id: "lsn-c",
    name_en: "Lesson C",
  });
  return contentsDir;
}

describe("buildContentsMetaSnapshot", () => {
  it("contents からの相対パスで3階層ぶんを引ける（ルートは空キー）", () => {
    const snapshot = buildContentsMetaSnapshot(makeContentsDir());

    expect(Object.keys(snapshot)).toEqual([
      "",
      "シリーズA",
      "シリーズA/コースB",
      "シリーズA/コースB/レッスンC",
    ]);
    expect(snapshot[""]).toMatchObject({ name: "全体" });
    expect(snapshot["シリーズA/コースB/レッスンC"]).toMatchObject({
      id: "lsn-c",
      name_en: "Lesson C",
    });
  });

  it("`_` / `.` 始まりのフォルダと、メタを持たないフォルダは載せない", () => {
    const contentsDir = makeContentsDir();
    writeMeta(path.join(contentsDir, "_work"), { id: "ignored" });
    writeMeta(path.join(contentsDir, ".trash"), { id: "ignored" });
    fs.mkdirSync(path.join(contentsDir, "シリーズA", "メタ無しコース"), {
      recursive: true,
    });

    const keys = Object.keys(buildContentsMetaSnapshot(contentsDir));

    expect(keys).not.toContain("_work");
    expect(keys).not.toContain(".trash");
    expect(keys).not.toContain("シリーズA/メタ無しコース");
  });

  it("壊れた JSON はビルドを止めず、焼き込みから除外する", () => {
    const contentsDir = makeContentsDir();
    const brokenDir = path.join(contentsDir, "シリーズA", "壊れたコース");
    fs.mkdirSync(brokenDir, { recursive: true });
    fs.writeFileSync(path.join(brokenDir, ".meta.json"), "{ 壊れ", "utf-8");

    const keys = Object.keys(buildContentsMetaSnapshot(contentsDir));

    expect(keys).not.toContain("シリーズA/壊れたコース");
    expect(keys).toContain("シリーズA");
  });

  it("contents が無ければ空を返す（初回セットアップ）", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "contents-meta-empty-"));
    tmpDirs.push(root);
    expect(buildContentsMetaSnapshot(path.join(root, "contents"))).toEqual({});
  });
});

describe("readBakedMeta", () => {
  const contentsDir = path.join("/proj", "contents");
  /** 焼き込み済みの実データから 1 件借りる（中身に依存しないため） */
  const someKey = Object.keys(bakedContentsMeta).find((key) => key !== "")!;

  it("ローカル（VERCEL 未設定）では焼き込みを使わない", () => {
    expect(readBakedMeta(contentsDir, path.join(contentsDir, someKey))).toBeNull();
  });

  it("デプロイ先では焼き込みを返す", () => {
    process.env.VERCEL = "1";
    expect(
      readBakedMeta(contentsDir, path.join(contentsDir, someKey)),
    ).not.toBeNull();
  });

  it("返した object を書き換えても焼き込みへ漏れない", () => {
    process.env.VERCEL = "1";
    const dir = path.join(contentsDir, someKey);
    const first = readBakedMeta(contentsDir, dir)!;
    first.id = "書き換えた";

    expect(readBakedMeta(contentsDir, dir)!.id).not.toBe("書き換えた");
  });

  it("contents の外を指すディレクトリには応えない", () => {
    process.env.VERCEL = "1";
    expect(readBakedMeta(contentsDir, path.join("/tmp", "somewhere"))).toBeNull();
  });

  it("焼き込みに無いディレクトリは null（呼び出し側が空として扱う）", () => {
    process.env.VERCEL = "1";
    expect(
      readBakedMeta(contentsDir, path.join(contentsDir, "存在しないシリーズ")),
    ).toBeNull();
  });
});

/**
 * ジェネレータは Node 単体実行のための最小レプリカなので、正本ロジック
 * （contents-loader の readMetaJson）とのずれをここで検出する。
 * 前例は generate-skill-catalog.parity.test.ts。
 */
describe("generate-contents-meta と readMetaJson の parity", () => {
  it("実プロジェクトの contents/ で同じメタを返す", () => {
    // studio/ の親＝入れ物直下（ランタイムの getProjectRoot() と同じ場所）
    const realContentsDir = path.resolve(process.cwd(), "..", "contents");
    const snapshot = buildContentsMetaSnapshot(realContentsDir);

    for (const [key, baked] of Object.entries(snapshot)) {
      expect(baked).toEqual(readMetaJson(path.join(realContentsDir, key)));
    }
    // 実データが存在すること（空同士の一致で緑になっていないこと）
    expect(Object.keys(snapshot).length).toBeGreaterThan(0);
  });
});
