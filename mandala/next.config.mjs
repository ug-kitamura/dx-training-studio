import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextra from "nextra";
import { rehypeGithubAlerts } from "rehype-github-alerts";

/** GitHub Pages のサブパス配信で使う。未設定ならルート配信（Vercel / ローカル） */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * サイドバー最上部の「YYYY.MM.DD HH:mm 更新」に使う日時をビルド時に解決する。
 *
 * 1. HEAD の commit date（`git show`。shallow clone でも HEAD 1 コミットは読める）
 * 2. 取れなければ正本 changelog の先頭エントリの日付（`YYYY-MM-DD`。時刻なし）
 * 3. どちらも無ければ空 → サイトは行ごと出さない
 *
 * ⚠ ビルド時刻を使ってはならない——再デプロイのたびに「更新」が動いて意味を失う。
 * どの経路で解決したかは必ずログに出す——Vercel のビルドコンテナに `.git` が
 * あるかどうかの実測は、このログをデプロイログで読むことで完了する。
 */
function resolveCommitDate() {
  try {
    const date = execSync("git show -s --format=%cI HEAD", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (date) {
      console.log(`サイト更新日時: git の commit date を使います（${date}）`);
      return date;
    }
  } catch {
    // .git が無い環境（Vercel のビルドコンテナ等の可能性）→ フォールバックへ
  }

  const changelogPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "contents",
    "changelog.md",
  );
  try {
    const first = fs
      .readFileSync(changelogPath, "utf-8")
      .match(/\d{4}-\d{2}-\d{2}/);
    if (first) {
      console.warn(
        `サイト更新日時: git が読めないため changelog 先頭日付で代替します（${first[0]}）`,
      );
      return first[0];
    }
  } catch {
    // changelog も無ければ諦める（行を出さない）
  }

  console.warn(
    "サイト更新日時: git も changelog も読めないため表示しません",
  );
  return "";
}

const withNextra = nextra({
  mdxOptions: {
    // `> [!NOTE]` 等の GitHub アラートを Nextra は素で解釈しない（引用に「[!NOTE]」が
    // そのまま出る）。Studio のプレビューと同じプラグインを使い、同じ class 名
    // （`markdown-alert-*`）で出して見た目を揃える。
    //
    // ⚠ このプラグイン指定があるため **dev / build とも `--webpack` が必須**
    // （`package.json` の scripts）。Turbopack はローダーの options を
    // シリアライズ可能な値に限るので、関数であるプラグインを渡すと
    // 「does not have serializable options」で落ちる。unified は文字列での
    // プラグイン指定を受け付けないため、逃げ道は webpack しかない。
    rehypePlugins: [rehypeGithubAlerts],
  },
});

export default withNextra({
  output: "export",
  // 画像最適化はサーバーが要るため静的 export では使えない
  images: { unoptimized: true },
  // Next.js が AGENTS.md / CLAUDE.md を自動生成するのを止める
  // （プロジェクト側の CLAUDE.md 運用と衝突する）
  agentRules: false,
  env: {
    // 静的 export でもクライアントから読めるよう NEXT_PUBLIC_ で注入。
    // 整形（Asia/Tokyo・表示文字列）は lib/release-info.ts が担う
    NEXT_PUBLIC_SITE_COMMIT_DATE:
      process.env.NEXT_PUBLIC_SITE_COMMIT_DATE || resolveCommitDate(),
  },
  ...(basePath ? { basePath } : {}),
});
