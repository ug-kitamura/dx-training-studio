import fs from "node:fs";
import path from "node:path";

/**
 * agent ツールのテスト用の作業フォルダ（フォーカス中のコンテンツフォルダ）。
 *
 * `workspace/<案件>/` を廃止し、相対パスの基準を `contents/` 配下の
 * フォーカス階層にしたため、旧 `workspace-mutations` の `createFolder` /
 * `createFile` を置き換える最小の足場をここに置く。
 */
export const SCOPE = "シリーズA/コースB/レッスンC";

/** 作業フォルダの絶対パス */
export function scopeAbsolute(projectRoot: string): string {
  return path.join(projectRoot, "contents", ...SCOPE.split("/"));
}

/** 表示用パス（ツールが返す relativePath と同じ形） */
export function scopeDisplayPath(relative = ""): string {
  return relative ? `contents/${SCOPE}/${relative}` : `contents/${SCOPE}`;
}

/** 作業フォルダを作る（旧 createFolder 相当） */
export function makeScope(projectRoot: string): void {
  fs.mkdirSync(scopeAbsolute(projectRoot), { recursive: true });
}

/** 作業フォルダ内にファイルを作る（旧 createFile 相当） */
export function makeScopeFile(
  projectRoot: string,
  fileName: string,
  content = "",
): string {
  const absolutePath = path.join(scopeAbsolute(projectRoot), fileName);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf-8");
  return absolutePath;
}
