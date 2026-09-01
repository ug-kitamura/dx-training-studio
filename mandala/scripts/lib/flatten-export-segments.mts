/**
 * 静的 export の成果物 `out/` で、セグメントプリフェッチ用 `.txt` が
 * 入れ子ディレクトリになっているものを平坦なファイル名へ畳む。
 *
 * Next.js 16.x は Windows 上で `convertSegmentPathToStaticExportFilename` に
 * `path.relative()` の `\` 区切りをそのまま渡すため（`/` しか `.` に置換しない）、
 * `out/git/__next.$oc$mdxPath/__PAGE__.txt` のような入れ子が生まれる。
 * クライアントはドット連結の平坦名（`__next.$oc$mdxPath.__PAGE__.txt`）を
 * 要求するので、そのままでは 404 になる。Linux ビルドでは発生しない。
 */
import fs from "node:fs";
import path from "node:path";

/** `__next.` で始まる名前だけが修復対象（`_next` や `_pagefind` は一致しない） */
const SEGMENT_DIR_PREFIX = "__next.";

/**
 * 入れ子ディレクトリ名とその配下の相対パスから、平坦なファイル名を作る。
 * 例: ("__next.$oc$mdxPath", "__PAGE__.txt") → "__next.$oc$mdxPath.__PAGE__.txt"
 * 深い入れ子（"a/b.txt"）は区切りをすべて `.` にする。
 */
export function flattenedName(dirName: string, relativeFilePath: string): string {
  const joined = relativeFilePath.split(/[\\/]/).filter(Boolean).join(".");
  return `${dirName}.${joined}`;
}

export type FlattenResult = {
  /** 平坦化で移動したファイル数 */
  moved: number;
  /** 削除した入れ子ディレクトリ数 */
  removedDirs: number;
};

/** ディレクトリ配下の全ファイルを相対パスで列挙する */
function listFilesRecursive(dir: string, prefix = ""): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(path.join(dir, entry.name), rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

/**
 * `outDir` を再帰走査し、`__next.` で始まる **ディレクトリ** を平坦化する。
 * 冪等: 対象が無ければ何もしない。同名の平坦ファイルが既にあれば上書きする
 * （Linux ビルドの正規形と同一名のため、上書きが正しい）。
 */
export function flattenExportSegments(outDir: string): FlattenResult {
  const result: FlattenResult = { moved: 0, removedDirs: 0 };
  if (!fs.existsSync(outDir)) return result;
  walk(outDir, result);
  return result;
}

function walk(dir: string, result: FlattenResult): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.name.startsWith(SEGMENT_DIR_PREFIX)) {
      for (const rel of listFilesRecursive(absolute)) {
        const dest = path.join(dir, flattenedName(entry.name, rel));
        fs.renameSync(path.join(absolute, rel), dest);
        result.moved += 1;
      }
      fs.rmSync(absolute, { recursive: true });
      result.removedDirs += 1;
    } else {
      walk(absolute, result);
    }
  }
}
