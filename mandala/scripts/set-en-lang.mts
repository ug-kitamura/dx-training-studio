/**
 * `/en` 配下の生成 HTML の `<html lang="ja">` を `lang="en"` へ書き換える。
 *
 * ルートレイアウトは1つ（`app/layout.tsx` の `lang="ja"` 固定）で、静的 export の
 * 単一キャッチオールルートではパスごとに `<html>` の属性を変えられないため、
 * postbuild で生成物を直す（publishing-site-build spec「検索インデックスは言語ごとに分離される」）。
 *
 * - Pagefind はページの `<html lang>` で言語別索引を自動生成し、検索 UI も
 *   現在ページの lang で索引を選ぶ——**Pagefind 実行より前に走ること**
 * - 対象は `.next/server/app`（Pagefind の入力）と `out`（配信物）の両方
 * - `<html>` タグに `lang="ja"` が見つからないファイルがあればビルドを落とす
 *   ——黙って日本語のまま索引される回帰を防ぐ（既に `lang="en"` なら冪等に通す）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 処理対象のルート。`en.html`（/en 自身）と `en/` 配下の両方を拾う */
const TARGET_ROOTS = [
  path.join(siteRoot, ".next", "server", "app"),
  path.join(siteRoot, "out"),
];

function listEnHtmlFiles(root: string): string[] {
  const files: string[] = [];
  const enIndex = path.join(root, "en.html");
  if (fs.existsSync(enIndex)) files.push(enIndex);
  const enDir = path.join(root, "en");
  if (fs.existsSync(enDir)) {
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".html")) files.push(full);
      }
    };
    walk(enDir);
  }
  return files;
}

function rewriteLang(filePath: string): "rewritten" | "already-en" {
  const content = fs.readFileSync(filePath, "utf-8");
  const htmlTagMatch = /<html\b[^>]*>/.exec(content);
  if (!htmlTagMatch) {
    throw new Error(`<html> タグが見つかりません: ${filePath}`);
  }
  const tag = htmlTagMatch[0];
  if (/\blang="en"/.test(tag)) return "already-en";
  if (!/\blang="ja"/.test(tag)) {
    throw new Error(
      `<html> タグに lang="ja" が見つかりません（書き換え先を判断できません）: ${filePath}\nタグ: ${tag}`,
    );
  }
  const rewritten = tag.replace(/\blang="ja"/, 'lang="en"');
  fs.writeFileSync(
    filePath,
    content.slice(0, htmlTagMatch.index) +
      rewritten +
      content.slice(htmlTagMatch.index + tag.length),
    "utf-8",
  );
  return "rewritten";
}

let total = 0;
for (const root of TARGET_ROOTS) {
  if (!fs.existsSync(root)) {
    console.error(`生成物が見つかりません（ビルド後に実行すること): ${root}`);
    process.exit(1);
  }
  const files = listEnHtmlFiles(root);
  if (files.length === 0) {
    console.error(`/en の HTML が見つかりません: ${root}`);
    process.exit(1);
  }
  for (const file of files) {
    rewriteLang(file);
    total += 1;
  }
}
console.log(`/en の HTML ${total} 件の lang を en に設定しました`);
