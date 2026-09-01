#!/usr/bin/env node
/**
 * Vercel 上のビルド前に、デモ配信の前提が成立しているかを検査する。
 * Usage: npm run build の前段（package.json の `build` から自動実行）
 *
 * この番人が守るもの:
 *
 *   ① 正本 `../contents/` がビルド時に見えること
 *      Studio のデモは正本をビルド時に静的ペイロードへ焼き込む。見えないまま
 *      ビルドすると `lib/contents-loader.ts` が黙って空を返し、
 *      **ビルド緑・デプロイ成功・中身が空のデモ**という気づけない壊れ方をする。
 *      主な原因は Vercel の `Include files outside the root directory` の無効化。
 *
 *   ② `next.config.ts` の `VERCEL_SOURCE_ROOT` の前提が崩れていないこと
 *      崩れると `@vercel/next` がビルド生成物の回収先を取り違え、解読しにくい
 *      `ENOENT: .../.next/routes-manifest-deterministic.json` で落ちる。
 *      ここで名指しして止めれば、その解読作業をしなくて済む。
 *
 * ローカルでは何もしない。正本が空でも起動できる現在の挙動（初回セットアップ）を
 * 壊さないため。
 */
import fs from "node:fs";
import path from "node:path";

// Vercel 以外では検査しない
if (!process.env.VERCEL) {
  process.exit(0);
}

/** `next.config.ts` の `VERCEL_SOURCE_ROOT` と同じ値を持つこと */
const VERCEL_SOURCE_ROOT = "/vercel/path0";

const appRoot = process.cwd();
/** `lib/project-root.ts` の `getProjectRoot()` と同じ規則（cwd の親） */
const projectRoot = path.resolve(appRoot, "..");
const contentsDir = path.join(projectRoot, "contents");

const failures = [];

// ① 正本がビルド時に見えるか
if (!fs.existsSync(contentsDir)) {
  failures.push(
    [
      `正本が見つかりません: ${contentsDir}`,
      "",
      "  このままビルドすると、中身が空のデモが成功として配信されます。",
      "  Vercel プロジェクトの設定を確認してください:",
      "    ・Root Directory = studio",
      "    ・Include files outside the root directory = Enabled  ← 無効だとこうなる",
    ].join("\n"),
  );
}

// ② ソースルートの前提が成立しているか
if (!fs.existsSync(VERCEL_SOURCE_ROOT)) {
  failures.push(
    [
      `ソースルートが存在しません: ${VERCEL_SOURCE_ROOT}`,
      "",
      "  Vercel 側がリポジトリの展開先を変えた可能性があります。",
      "  next.config.ts の VERCEL_SOURCE_ROOT と本スクリプトの値を更新してください。",
    ].join("\n"),
  );
} else if (!appRoot.startsWith(VERCEL_SOURCE_ROOT + path.sep)) {
  failures.push(
    [
      `ソースルートがアプリを含んでいません`,
      `  ソースルート: ${VERCEL_SOURCE_ROOT}`,
      `  アプリ:       ${appRoot}`,
      "",
      "  next.config.ts の outputFileTracingRoot がビルド生成物の実際の位置とズレます。",
      "  そのままだと ENOENT (routes-manifest-deterministic.json) で落ちます。",
    ].join("\n"),
  );
}

if (failures.length > 0) {
  console.error("Vercel ビルドの前提が崩れています。ビルドを中止します。\n");
  for (const failure of failures) {
    console.error(failure);
    console.error("");
  }
  console.error(
    "詳細: openspec/specs/studio-demo-deployment/spec.md（デモ配信の前提）",
  );
  process.exit(1);
}

console.log(`OK: 正本を検出しました（${contentsDir}）`);
console.log(`OK: ソースルートの前提が成立しています（${VERCEL_SOURCE_ROOT}）`);
