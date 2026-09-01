import type { Series } from "@/lib/schema";
import type { EditLanguage } from "@/lib/display-name";

/**
 * 統合コンテンツツリーの可視行（ホーム → シリーズ → コース → レッスン）。
 * EBEX の `workspace-tree-flatten` の3階層版。キーボードカーソルの移動・
 * Home/End・← / Backspace の解決を pure function で提供する。
 */
export type ContentTreeRow =
  | { id: string; kind: "home"; depth: 0 }
  | { id: string; kind: "series"; seriesId: string; depth: 0 }
  | {
      id: string;
      kind: "course";
      seriesId: string;
      courseId: string;
      depth: 1;
    }
  | {
      id: string;
      kind: "lesson";
      seriesId: string;
      courseId: string;
      lessonId: string;
      depth: 2;
    };

export const HOME_ROW_ID = "home";

export function seriesRowId(seriesId: string): string {
  return `series:${seriesId}`;
}

export function courseRowId(courseId: string): string {
  return `course:${courseId}`;
}

export function lessonRowId(lessonId: string): string {
  return `lesson:${lessonId}`;
}

/** 選択状態（最深の非空フィールド）から対応する行 ID を導出する。全空はホーム行。 */
export function selectionRowId(selection: {
  seriesId: string;
  courseId: string;
  lessonId: string;
}): string {
  if (selection.lessonId) return lessonRowId(selection.lessonId);
  if (selection.courseId) return courseRowId(selection.courseId);
  if (selection.seriesId) return seriesRowId(selection.seriesId);
  return HOME_ROW_ID;
}

/**
 * collapse all で畳む対象（シリーズ・コースの ID）。
 *
 * ⚠ 開いたまま残すのは選択の**祖先だけ**で、選択自身は畳む——シリーズ行・コース行は
 * 自分を畳んでも見えるので、選択自身を残すと「畳み済みのシリーズを選んで collapse all」
 * でそれが逆に開いてしまう。
 *
 * 祖先かどうかは選択の深さで決まる（`selectionRowId` と同じ規約）——コース以下を
 * 選んでいればシリーズが祖先、レッスンを選んでいればコースが祖先。
 */
export function resolveCollapseAllTargets(
  series: Series[],
  selection: { seriesId: string; courseId: string; lessonId: string },
): { series: string[]; courses: string[] } {
  const ancestorSeriesId = selection.courseId ? selection.seriesId : "";
  const ancestorCourseId = selection.lessonId ? selection.courseId : "";
  return {
    series: series.filter((s) => s.id !== ancestorSeriesId).map((s) => s.id),
    courses: series
      .flatMap((s) => s.courses)
      .filter((c) => c.id !== ancestorCourseId)
      .map((c) => c.id),
  };
}

export function buildVisibleContentRows(
  series: Series[],
  collapsedSeriesIds: ReadonlySet<string>,
  collapsedCourseIds: ReadonlySet<string>,
): ContentTreeRow[] {
  const rows: ContentTreeRow[] = [{ id: HOME_ROW_ID, kind: "home", depth: 0 }];

  for (const s of series) {
    rows.push({ id: seriesRowId(s.id), kind: "series", seriesId: s.id, depth: 0 });
    if (collapsedSeriesIds.has(s.id)) continue;
    for (const c of s.courses) {
      rows.push({
        id: courseRowId(c.id),
        kind: "course",
        seriesId: s.id,
        courseId: c.id,
        depth: 1,
      });
      if (collapsedCourseIds.has(c.id)) continue;
      for (const l of c.lessons) {
        rows.push({
          id: lessonRowId(l.id),
          kind: "lesson",
          seriesId: s.id,
          courseId: c.id,
          lessonId: l.id,
          depth: 2,
        });
      }
    }
  }
  return rows;
}

export type LeftNavigationResult = {
  /** 折りたたむ対象。kind とその id */
  collapse: { kind: "series" | "course"; id: string } | null;
  focusRowId: string | null;
};

/**
 * ← / Backspace の解決。開いているシリーズ・コースは折りたたみ、
 * それ以外は親階層の行へカーソルを移す（レッスン→コース、コース→シリーズ、
 * シリーズ→ホーム）。ホーム行は no-op。
 */
export function resolveLeftNavigation(
  row: ContentTreeRow,
  options: {
    isSeriesExpanded: (seriesId: string) => boolean;
    isCourseExpanded: (courseId: string) => boolean;
  },
): LeftNavigationResult | null {
  if (row.kind === "home") return null;

  if (row.kind === "series") {
    if (options.isSeriesExpanded(row.seriesId)) {
      return {
        collapse: { kind: "series", id: row.seriesId },
        focusRowId: seriesRowId(row.seriesId),
      };
    }
    return { collapse: null, focusRowId: HOME_ROW_ID };
  }

  if (row.kind === "course") {
    if (options.isCourseExpanded(row.courseId)) {
      return {
        collapse: { kind: "course", id: row.courseId },
        focusRowId: courseRowId(row.courseId),
      };
    }
    return { collapse: null, focusRowId: seriesRowId(row.seriesId) };
  }

  return { collapse: null, focusRowId: courseRowId(row.courseId) };
}

/**
 * 祖先の行 ID を近い順に返す（ホームは含めない——最終フォールバックが
 * 先頭行＝ホームを拾うため）。
 */
function getAncestorRowIds(row: ContentTreeRow): string[] {
  if (row.kind === "course") return [seriesRowId(row.seriesId)];
  if (row.kind === "lesson") {
    return [courseRowId(row.courseId), seriesRowId(row.seriesId)];
  }
  return [];
}

/**
 * カーソル行が可視でなくなったときの付け替え先を解決する。
 * 折りたたみ・絞り込み・削除で行が消えるとキーボード操作が死ぬため、
 * 生きている行へカーソルを移す。
 *
 * 優先順は「消えた行の祖先 → 消えた位置の直前にあった可視行 → 先頭行」。
 * カーソル行が可視のままなら `null`（付け替え不要）。
 */
export function resolveFocusFallbackRowId(
  previousRows: readonly ContentTreeRow[],
  visibleRows: readonly ContentTreeRow[],
  focusedRowId: string | null,
): string | null {
  if (!focusedRowId) return null;
  const visibleIds = new Set(visibleRows.map((row) => row.id));
  if (visibleIds.has(focusedRowId)) return null;

  const vanishedIndex = previousRows.findIndex(
    (row) => row.id === focusedRowId,
  );
  const vanished = vanishedIndex >= 0 ? previousRows[vanishedIndex] : undefined;

  if (vanished) {
    for (const ancestorId of getAncestorRowIds(vanished)) {
      if (visibleIds.has(ancestorId)) return ancestorId;
    }
    for (let i = vanishedIndex - 1; i >= 0; i -= 1) {
      const candidate = previousRows[i];
      if (candidate && visibleIds.has(candidate.id)) return candidate.id;
    }
  }

  return visibleRows[0]?.id ?? null;
}

/** 兄弟判定用の親キー。ホームとシリーズは同じルート区画。 */
export function getRowParentKey(row: ContentTreeRow): string {
  if (row.kind === "home" || row.kind === "series") return "";
  if (row.kind === "course") return seriesRowId(row.seriesId);
  return courseRowId(row.courseId);
}

export type HomeEndNavigationResult = {
  /** null は no-op（すでに端、または無効な index） */
  focusRowId: string | null;
};

/**
 * Home / End / Ctrl+Home / Ctrl+End の移動先を解決する。
 * Ctrl なし: 同一親の visible な兄弟の先頭／末尾。
 * Ctrl あり: visibleRows 全体の先頭／末尾。
 */
export function resolveHomeEndNavigation(
  rows: ContentTreeRow[],
  index: number,
  key: "Home" | "End",
  ctrlKey: boolean,
): HomeEndNavigationResult {
  if (rows.length === 0 || index < 0 || index >= rows.length) {
    return { focusRowId: null };
  }
  const current = rows[index];
  if (!current) return { focusRowId: null };

  if (ctrlKey) {
    const target = key === "Home" ? rows[0] : rows[rows.length - 1];
    if (!target || target.id === current.id) return { focusRowId: null };
    return { focusRowId: target.id };
  }

  const parentKey = getRowParentKey(current);
  const siblings = rows.filter((row) => getRowParentKey(row) === parentKey);
  const target = key === "Home" ? siblings[0] : siblings[siblings.length - 1];
  if (!target || target.id === current.id) return { focusRowId: null };
  return { focusRowId: target.id };
}

// ---------------------------------------------------------------------------
// フィルタ（名前フィルタ / 全文検索キー集合）
// ---------------------------------------------------------------------------

function includesIgnoreCase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * 名前フィルタ。一致したノードの祖先は残し、一致したシリーズ・コースの
 * 配下はすべて残す（EBEX `filterWorkspaceTree` と同じ考え方）。
 */
/**
 * 名前フィルタ。照合対象は編集言語に連動する（unified-content-tree spec）。
 *
 * ⚠ 英語モードは **`name_en` と日本語名の両方**に当てる。ツリーは未訳ユニットを
 * 日本語名フォールバックで表示しているので、片方だけにすると
 * **画面に見えているのに検索でヒットしない**状態ができる。
 */
export function filterSeriesByName(
  series: Series[],
  query: string,
  language: EditLanguage = "ja",
): Series[] {
  const q = query.trim();
  if (!q) return series;

  const hit = (jaName: string, nameEn: string | undefined) =>
    includesIgnoreCase(jaName, q) ||
    (language === "en" && nameEn !== undefined && includesIgnoreCase(nameEn, q));

  const result: Series[] = [];
  for (const s of series) {
    if (hit(s.name, s.name_en)) {
      result.push(s);
      continue;
    }
    const courses = [];
    for (const c of s.courses) {
      if (hit(c.name, c.name_en)) {
        courses.push(c);
        continue;
      }
      const lessons = c.lessons.filter((l) => hit(l.lesson, l.name_en));
      if (lessons.length > 0) {
        courses.push({ ...c, lessons });
      }
    }
    if (courses.length > 0) {
      result.push({ ...s, courses });
    }
  }
  return result;
}

/** 全文検索 API の一致（名前ベース）。lesson まで埋まっていればレッスン一致。 */
export type ContentSearchMatch = {
  series: string;
  course?: string;
  lesson?: string;
};

/**
 * 全文検索の一致集合でツリーを絞り込む。シリーズ一致は配下ごと、
 * コース一致はそのコースごと残し、レッスン一致は当該レッスンと祖先を残す。
 */
export function filterSeriesByContentMatches(
  series: Series[],
  matches: readonly ContentSearchMatch[],
): Series[] {
  if (matches.length === 0) return [];

  const seriesHit = new Set<string>();
  const courseHit = new Set<string>();
  const lessonHit = new Set<string>();
  for (const m of matches) {
    if (m.lesson && m.course) {
      lessonHit.add(`${m.series} ${m.course} ${m.lesson}`);
    } else if (m.course) {
      courseHit.add(`${m.series} ${m.course}`);
    } else {
      seriesHit.add(m.series);
    }
  }

  const result: Series[] = [];
  for (const s of series) {
    if (seriesHit.has(s.name)) {
      result.push(s);
      continue;
    }
    const courses = [];
    for (const c of s.courses) {
      if (courseHit.has(`${s.name} ${c.name}`)) {
        courses.push(c);
        continue;
      }
      const lessons = c.lessons.filter((l) =>
        lessonHit.has(`${s.name} ${c.name} ${l.lesson}`),
      );
      if (lessons.length > 0) {
        courses.push({ ...c, lessons });
      }
    }
    if (courses.length > 0) {
      result.push({ ...s, courses });
    }
  }
  return result;
}
