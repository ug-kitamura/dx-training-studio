/**
 * postbuild: `out/` のセグメントプリフェッチ `.txt` を平坦化する（Windows ビルド対策）。
 * 詳細は lib/flatten-export-segments.mts のコメントを参照。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flattenExportSegments } from "./lib/flatten-export-segments.mts";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(siteRoot, "out");

const { moved, removedDirs } = flattenExportSegments(outDir);
if (moved > 0) {
  console.log(
    `セグメントファイルを平坦化しました: ${moved} 件（ディレクトリ ${removedDirs} 個を削除）`,
  );
} else {
  console.log("セグメントファイルの平坦化: 対象なし");
}
