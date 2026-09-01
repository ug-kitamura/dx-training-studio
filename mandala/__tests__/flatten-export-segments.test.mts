import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  flattenExportSegments,
  flattenedName,
} from "../scripts/lib/flatten-export-segments.mts";

function makeOutDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "flatten-segments-"));
}

function writeFile(root: string, relativePath: string, contents: string): void {
  const absolute = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents, "utf-8");
}

/** ディレクトリ配下のファイルを相対パス（`/` 区切り）でソートして列挙する */
function listFiles(root: string, prefix = ""): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) results.push(...listFiles(root, rel));
    else results.push(rel);
  }
  return results.sort();
}

describe("flattenedName", () => {
  it("単一階層をドットで連結する", () => {
    expect(flattenedName("__next.$oc$mdxPath", "__PAGE__.txt")).toBe(
      "__next.$oc$mdxPath.__PAGE__.txt",
    );
  });

  it("複数階層の区切りをすべてドットにする", () => {
    expect(flattenedName("__next.$oc$mdxPath", "nested/__PAGE__.txt")).toBe(
      "__next.$oc$mdxPath.nested.__PAGE__.txt",
    );
  });

  it("Windows の区切り文字も連結できる", () => {
    expect(flattenedName("__next.$oc$mdxPath", "nested\\__PAGE__.txt")).toBe(
      "__next.$oc$mdxPath.nested.__PAGE__.txt",
    );
  });
});

describe("flattenExportSegments", () => {
  it("入れ子ディレクトリを平坦なファイルへ畳む", () => {
    const out = makeOutDir();
    writeFile(out, "git/__next.$oc$mdxPath/__PAGE__.txt", "page");
    writeFile(out, "git/__next._index.txt", "index");

    const result = flattenExportSegments(out);

    expect(result.moved).toBe(1);
    expect(result.removedDirs).toBe(1);
    expect(listFiles(out)).toEqual([
      "git/__next.$oc$mdxPath.__PAGE__.txt",
      "git/__next._index.txt",
    ]);
    expect(fs.existsSync(path.join(out, "git", "__next.$oc$mdxPath"))).toBe(false);
    expect(
      fs.readFileSync(path.join(out, "git", "__next.$oc$mdxPath.__PAGE__.txt"), "utf-8"),
    ).toBe("page");
  });

  it("深い階層のページも平坦化する", () => {
    const out = makeOutDir();
    writeFile(out, "en/git/basics/undo/__next.$oc$mdxPath/__PAGE__.txt", "deep");

    flattenExportSegments(out);

    expect(listFiles(out)).toEqual([
      "en/git/basics/undo/__next.$oc$mdxPath.__PAGE__.txt",
    ]);
  });

  it("平坦なファイル（__next._index.txt 等）は対象にしない", () => {
    const out = makeOutDir();
    writeFile(out, "__next._index.txt", "index");
    writeFile(out, "__next._tree.txt", "tree");
    writeFile(out, "_next/static/chunk.js", "chunk");
    writeFile(out, "_pagefind/pagefind.js", "pagefind");

    const result = flattenExportSegments(out);

    expect(result).toEqual({ moved: 0, removedDirs: 0 });
    expect(listFiles(out)).toEqual([
      "__next._index.txt",
      "__next._tree.txt",
      "_next/static/chunk.js",
      "_pagefind/pagefind.js",
    ]);
  });

  it("対象が無ければ成果物を変えない（no-op）", () => {
    const out = makeOutDir();
    writeFile(out, "index.html", "<html></html>");
    const before = listFiles(out);

    const result = flattenExportSegments(out);

    expect(result).toEqual({ moved: 0, removedDirs: 0 });
    expect(listFiles(out)).toEqual(before);
  });

  it("冪等である（2回実行しても結果が変わらない）", () => {
    const out = makeOutDir();
    writeFile(out, "git/__next.$oc$mdxPath/__PAGE__.txt", "page");

    flattenExportSegments(out);
    const afterFirst = listFiles(out);
    const second = flattenExportSegments(out);

    expect(second).toEqual({ moved: 0, removedDirs: 0 });
    expect(listFiles(out)).toEqual(afterFirst);
  });

  it("out/ が存在しなくても失敗しない", () => {
    const missing = path.join(makeOutDir(), "does-not-exist");
    expect(flattenExportSegments(missing)).toEqual({ moved: 0, removedDirs: 0 });
  });
});
