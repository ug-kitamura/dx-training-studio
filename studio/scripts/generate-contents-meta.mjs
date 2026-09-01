/**
 * 正本の `.meta.json` をビルド時に焼き込む。
 *
 * Vercel（読み取り専用デモ）のサーバーレス関数には `contents/**\/.meta.json` が
 * 同梱されない。`readMetaJson` は `path.join(dir, ".meta.json")` という動的パスを
 * 読むため `outputFileTracing` が追跡できず、`contents/` をまとめて拾う経路も
 * **先頭がドットのエントリを取りこぼす**（同じフォルダの `contents.md` /
 * `contents.en.md` / `changelog.md` は届く。フォルダ自体も残る）。
 *
 * そのため `lib/contents-loader.ts` の `readMetaJson` は、デプロイ先で実ファイルが
 * 無いとき本生成物へフォールバックする。前例はスキルカタログ
 * （`generate-skill-catalog.mjs` / `studio-demo-deployment` spec）。
 *
 * ⚠ **これは閲覧のための焼き込みであって正本ではない。** 編集の正本は常に
 * `contents/**\/.meta.json`。人もツールもこの生成物を編集してはならない。
 *
 * `npm run build` の前段で実行される（package.json の build script）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT_META_FILENAME = ".meta.json";

/** シリーズ → コース → レッスンの3階層だけを見る（正本にメタがあるのはここまで） */
const MAX_DEPTH = 3;

/** `contents-loader.ts` の isContentFolderName と同値（`_` / `.` 始まりは構造ではない） */
function isContentFolderName(name) {
  return !name.startsWith("_") && !name.startsWith(".");
}

/**
 * `contents/` 以下の `.meta.json` を「contents からの相対パス」で引ける辞書にする。
 * ルート（`contents/.meta.json`）のキーは空文字列。
 *
 * @param {string} contentsDir
 * @returns {Record<string, Record<string, unknown>>}
 */
export function buildContentsMetaSnapshot(contentsDir) {
  const snapshot = {};
  if (!fs.existsSync(contentsDir)) return snapshot;

  function visit(dir, relKey, depth) {
    const metaPath = path.join(dir, CONTENT_META_FILENAME);
    if (fs.existsSync(metaPath)) {
      // 壊れた JSON は焼き込まない。読めない `.meta.json` の扱いは正本側の
      // MetaJsonParseError に委ね、ここでビルドを止めない
      try {
        snapshot[relKey] = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      } catch (cause) {
        console.warn(
          `contents meta: JSON として読めないため焼き込みから除外しました: ${metaPath}\n  ${cause}`,
        );
      }
    }
    if (depth >= MAX_DEPTH) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (!isContentFolderName(entry.name)) continue;
      visit(
        path.join(dir, entry.name),
        relKey ? `${relKey}/${entry.name}` : entry.name,
        depth + 1,
      );
    }
  }

  visit(contentsDir, "", 0);

  // キー順を固定して差分を安定させる
  return Object.fromEntries(
    Object.keys(snapshot)
      .sort()
      .map((key) => [key, snapshot[key]]),
  );
}

function main() {
  const studioRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  // projectRoot はランタイムの getProjectRoot()（cwd の親）と同じ入れ物直下
  const projectRoot = path.resolve(studioRoot, "..");
  const snapshot = buildContentsMetaSnapshot(path.join(projectRoot, "contents"));
  const target = path.join(studioRoot, "lib", "contents-meta.generated.json");
  fs.writeFileSync(target, JSON.stringify(snapshot, null, 2) + "\n", "utf-8");
  console.log(
    `contents meta: ${Object.keys(snapshot).length} 件を焼き込みました → lib/contents-meta.generated.json`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
