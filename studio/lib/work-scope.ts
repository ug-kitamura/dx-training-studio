import { sanitizeFilename } from "@/lib/content-filename";

/**
 * 作業スコープ。ペイン1〜3 のフォーカス階層と 1 対 1 で対応する。
 *
 * 用途は「相対パスの基準」「`@` 参照候補」「invoke への受け渡し」の 3 つ。
 * **Agent 会話の保存先は決めない** — 保存先は単一（`lib/agent-session-store.ts` の
 * `AGENT_SESSION_PATH`）で、フォーカスを変えても会話は切り替わらない。
 *
 * フォーカスは「下の階層があれば先頭へ降り、無ければその階層で止まる」規則で決まるため、
 * 下位が埋まっているのに上位で止まる状態は存在しない。したがって階層を表す判別フィールドは
 * 持たず、最も深い非空フィールドから導出する。
 */
export type WorkScope = {
  series?: string;
  course?: string;
  lesson?: string;
};

export type WorkScopeLevel = "lesson" | "course" | "series" | "root";

/** 最も深い非空フィールドからフォーカス階層を導出する。 */
export function workScopeLevel(scope: WorkScope): WorkScopeLevel {
  if (scope.lesson) return "lesson";
  if (scope.course) return "course";
  if (scope.series) return "series";
  return "root";
}

/**
 * スコープを API のクエリで運ぶ 1 本の文字列にする。
 * 空文字はシリーズ 0 件（`contents/` 直下）を表す。
 *
 * セグメント名はディスク上のディレクトリ名に合わせて sanitize する。表示名に `/` を
 * 含むレッスンがあるため（`lib/content-filename.ts` の `sanitizeFilename` が正本）、
 * 生の表示名をそのまま連結するとパスが 1 段深くなる。
 */
export function serializeWorkScope(scope: WorkScope): string {
  const segments: string[] = [];
  if (scope.series) segments.push(sanitizeFilename(scope.series));
  if (scope.series && scope.course)
    segments.push(sanitizeFilename(scope.course));
  if (scope.series && scope.course && scope.lesson) {
    segments.push(sanitizeFilename(scope.lesson));
  }
  return segments.join("/");
}

/**
 * `serializeWorkScope` の逆。不正な入力（`..`・絶対パス・4 段以上）は null を返す。
 * 値は sanitize 済みのディレクトリ名として扱う。
 */
export function parseWorkScope(raw: string): WorkScope | null {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("/") || trimmed.includes("\\")) return null;

  const segments = trimmed.split("/");
  if (segments.length > 3) return null;
  if (
    segments.some((s) => !s || s === "." || s === ".." || s.startsWith("."))
  ) {
    return null;
  }

  const [series, course, lesson] = segments;
  return {
    ...(series ? { series } : {}),
    ...(course ? { course } : {}),
    ...(lesson ? { lesson } : {}),
  };
}

/**
 * 作業フォルダの、リポジトリルートからの相対パス。
 * 明示プレフィックスのない相対パスはここを基準に解決される。
 */
export function workScopeBaseDir(scope: WorkScope): string {
  const dir = serializeWorkScope(scope);
  return dir ? `contents/${dir}` : "contents";
}
