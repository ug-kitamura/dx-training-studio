import fs from "node:fs";
import path from "node:path";
import { getProjectRoot } from "@/lib/project-root";
import { loadContentsFolder, resolveLessonDirPath } from "@/lib/contents-loader";
import { LESSON_CONTENTS_EN_FILENAME } from "@/lib/lesson-paths";

/** これを超える一致は打ち切り、絞り込みを促す（EBEX の全文検索と同じ上限） */
const MATCH_LIMIT = 200;

export type ContentSearchResponse = {
  matches: Array<{ series: string; course?: string; lesson?: string }>;
  truncated: boolean;
};

/**
 * 英語版本文を読む。⚠ ローダーの戻り値（`Lesson`）には載せない——載せると
 * Studio 全体のメモリと保存経路へ波及する。検索は読み捨てなので、走査対象
 * （どのレッスンが存在するか）だけローダーに委ね、訳文はここで読む。
 *
 * 原文ハッシュ行（`<!-- source: sha256:… -->`）は剥がさずそのまま照合する
 * ——自然文の検索語がハッシュに当たることは無く、剥がす手間に見合わない。
 */
function readEnBody(
  projectRoot: string,
  series: string,
  course: string,
  lesson: string,
): string | null {
  const dir = resolveLessonDirPath(projectRoot, series, course, lesson);
  if (!dir) return null;
  const enPath = path.join(dir, LESSON_CONTENTS_EN_FILENAME);
  try {
    if (!fs.existsSync(enPath)) return null;
    return fs.readFileSync(enPath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * コンテンツ全文検索。`contents/` のレッスン本文と各階層の名前を
 * 大文字小文字無視の部分一致で検索する。読み方はローダー
 * （`loadContentsFolder`）に委ねることで、走査規則・BOM の扱いを
 * ツリー表示と一致させる。
 *
 * 検索対象は編集言語に連動する（unified-content-tree spec）:
 *
 * | lang | 名前の照合 | 本文の照合 |
 * |---|---|---|
 * | ja | 日本語名 | `contents.md` |
 * | en | **`name_en` と日本語名の両方** | `contents.en.md` |
 *
 * ⚠ 英語モードで名前を両言語照合するのは、ツリーが未訳ユニットを日本語名
 * フォールバックで表示するため——**画面に見えている文字列で検索してヒットしない
 * 状態を作らない**。
 *
 * ⚠ 英語モードで `contents.en.md` が無いレッスンの日本語本文へフォールバック
 * しない。英語ビューに存在しない一致でツリーを絞ると、開いた先でハイライトが
 * 空振りする（サイトの `Coming soon` と同じ整理）。
 */
export function GET(request: Request): Response {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const lang = url.searchParams.get("lang") === "en" ? "en" : "ja";
  if (!q) {
    return Response.json({ matches: [], truncated: false });
  }
  const needle = q.toLowerCase();
  const includes = (value: string | undefined) =>
    typeof value === "string" && value.toLowerCase().includes(needle);
  /** 英語モードは name_en と日本語名の OR（見えている文字列で必ず引ける） */
  const matchesName = (jaName: string, nameEn: string | undefined) =>
    includes(jaName) || (lang === "en" && includes(nameEn));

  const projectRoot = getProjectRoot();
  const series = loadContentsFolder(projectRoot);
  const matches: ContentSearchResponse["matches"] = [];
  let truncated = false;

  const push = (match: ContentSearchResponse["matches"][number]): boolean => {
    if (matches.length >= MATCH_LIMIT) {
      truncated = true;
      return false;
    }
    matches.push(match);
    return true;
  };

  outer: for (const s of series) {
    if (matchesName(s.name, s.name_en)) {
      if (!push({ series: s.name })) break;
      continue;
    }
    for (const c of s.courses) {
      if (matchesName(c.name, c.name_en)) {
        if (!push({ series: s.name, course: c.name })) break outer;
        continue;
      }
      for (const l of c.lessons) {
        const body =
          lang === "en"
            ? readEnBody(projectRoot, s.name, c.name, l.lesson)
            : l.content;
        if (matchesName(l.lesson, l.name_en) || includes(body ?? undefined)) {
          if (!push({ series: s.name, course: c.name, lesson: l.lesson })) {
            break outer;
          }
        }
      }
    }
  }

  return Response.json({ matches, truncated });
}
