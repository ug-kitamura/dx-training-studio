/**
 * コースの受講順・前提/続きリンクのドメインロジック。
 * シリーズ内順序は series.courses[] のみ。cross_series_prev / cross_series_next は別シリーズ ID のみ。
 */

import type { Series, Course } from "@/lib/schema";

export type CourseRef = { id: string; name: string };

export type IntraSeriesNeighbors = {
  prev: CourseRef | null;
  next: CourseRef | null;
};

export type CourseNeighbors = {
  intraPrev: CourseRef | null;
  intraNext: CourseRef | null;
  crossPrevs: CourseRef[];
  crossNexts: CourseRef[];
};

export type MiniMandalaGraphInput = {
  current: CourseRef;
  intraPrev: CourseRef | null;
  intraNext: CourseRef | null;
  crossPrereqs: CourseRef[];
  crossNexts: CourseRef[];
  /** 当該コースがカリキュラムの入口・到達点として宣言されているか */
  isStart: boolean;
  isGoal: boolean;
};

/** コース ID を含むシリーズを返す */
export function findSeriesContainingCourse(
  allSeries: Series[],
  courseId: string,
): Series | undefined {
  return allSeries.find((s) => s.courses.some((c) => c.id === courseId));
}

/** シリーズ内インデックス（見つからなければ -1） */
export function getCourseIndexInSeries(
  parentSeries: Series,
  courseId: string,
): number {
  return parentSeries.courses.findIndex((c) => c.id === courseId);
}

/** 同シリーズ ID かどうか */
export function isSameSeriesCourse(
  allSeries: Series[],
  courseId: string,
  otherCourseId: string,
): boolean {
  const parent = findSeriesContainingCourse(allSeries, courseId);
  if (!parent) return false;
  return parent.courses.some((c) => c.id === otherCourseId);
}

/** 別シリーズのコース ID のみ残す */
export function filterCrossSeriesIds(
  allSeries: Series[],
  courseId: string,
  ids: string[],
): string[] {
  return ids.filter(
    (id) => id !== courseId && !isSameSeriesCourse(allSeries, courseId, id),
  );
}

/** シリーズ内の直前・直後（各0〜1） */
export function getIntraSeriesNeighbors(
  allSeries: Series[],
  courseId: string,
): IntraSeriesNeighbors {
  const parent = findSeriesContainingCourse(allSeries, courseId);
  if (!parent) return { prev: null, next: null };
  const i = getCourseIndexInSeries(parent, courseId);
  if (i < 0) return { prev: null, next: null };
  const prev =
    i > 0
      ? { id: parent.courses[i - 1].id, name: parent.courses[i - 1].name }
      : null;
  const next =
    i < parent.courses.length - 1
      ? { id: parent.courses[i + 1].id, name: parent.courses[i + 1].name }
      : null;
  return { prev, next };
}

export function resolveCourseRefs(
  allSeries: Series[],
  courseIds: string[],
): CourseRef[] {
  const refs: CourseRef[] = [];
  for (const id of courseIds) {
    for (const s of allSeries) {
      const c = s.courses.find((co) => co.id === id);
      if (c) {
        refs.push({ id, name: c.name });
        break;
      }
    }
  }
  return refs;
}

/** 同シリーズ前後 + 別シリーズリンクを統合して返す（曼陀羅共通） */
export function buildCourseNeighbors(
  allSeries: Series[],
  course: Course,
): CourseNeighbors {
  const { prev, next } = getIntraSeriesNeighbors(allSeries, course.id);
  const crossPrevIds = filterCrossSeriesIds(
    allSeries,
    course.id,
    course.cross_series_prev,
  );
  const crossNextIds = filterCrossSeriesIds(
    allSeries,
    course.id,
    course.cross_series_next,
  );
  return {
    intraPrev: prev,
    intraNext: next,
    crossPrevs: resolveCourseRefs(allSeries, crossPrevIds),
    crossNexts: resolveCourseRefs(allSeries, crossNextIds),
  };
}

function existingCourseIds(allSeries: Series[]): Set<string> {
  return new Set(allSeries.flatMap((s) => s.courses.map((c) => c.id)));
}

/** cross_series_prev / cross_series_next から存在しないコース ID を除去する */
export function stripDanglingCourseLinks(allSeries: Series[]): Series[] {
  const ids = existingCourseIds(allSeries);
  return allSeries.map((s) => ({
    ...s,
    courses: s.courses.map((c) => ({
      ...c,
      cross_series_prev: c.cross_series_prev.filter((id) => ids.has(id)),
      cross_series_next: c.cross_series_next.filter((id) => ids.has(id)),
    })),
  }));
}

/** コース削除: 当該コースを除去し、全シリーズのリンク参照を掃除する */
export function applyCourseDeletion(
  allSeries: Series[],
  seriesId: string,
  courseId: string,
): Series[] {
  const withoutCourse = allSeries.map((s) =>
    s.id === seriesId
      ? { ...s, courses: s.courses.filter((c) => c.id !== courseId) }
      : s,
  );
  return stripDanglingCourseLinks(withoutCourse);
}

/** シリーズ削除: 当該シリーズを除去し、削除コースへのリンク参照を掃除する */
export function applySeriesDeletion(
  allSeries: Series[],
  seriesId: string,
): Series[] {
  const withoutSeries = allSeries.filter((s) => s.id !== seriesId);
  return stripDanglingCourseLinks(withoutSeries);
}

/** 1コースのメタを正規化 */
export function normalizeCourseMeta(
  allSeries: Series[],
  courseId: string,
  course: Course,
): Course {
  return {
    ...course,
    cross_series_prev: filterCrossSeriesIds(
      allSeries,
      courseId,
      course.cross_series_prev,
    ),
    cross_series_next: filterCrossSeriesIds(
      allSeries,
      courseId,
      course.cross_series_next,
    ),
  };
}

/** 全シリーズのコースメタを正規化 */
export function normalizeSeriesCourseMeta(allSeries: Series[]): Series[] {
  const normalized = allSeries.map((s) => ({
    ...s,
    courses: s.courses.map((c) => normalizeCourseMeta(allSeries, c.id, c)),
  }));
  return stripDanglingCourseLinks(normalized);
}

/** Pane1 一覧と同じ順（シリーズ配列順 → 各 courses 配列順） */
export function listCrossSeriesCourseCandidates(
  allSeries: Series[],
  courseId: string,
): Array<CourseRef & { seriesName: string }> {
  const out: Array<CourseRef & { seriesName: string }> = [];
  for (const s of allSeries) {
    for (const c of s.courses) {
      if (c.id === courseId) continue;
      if (isSameSeriesCourse(allSeries, courseId, c.id)) continue;
      out.push({ id: c.id, name: c.name, seriesName: s.name });
    }
  }
  return out;
}

/** 別シリーズ候補の表示ラベル（Pane1 並びの表記） */
export function formatCrossSeriesCourseLabel(
  seriesName: string,
  courseName: string,
): string {
  return `${seriesName} / ${courseName}`;
}

/** ミニ曼陀羅用ノード集合 */
export function buildMiniMandalaGraphInput(
  allSeries: Series[],
  course: Course,
): MiniMandalaGraphInput {
  const neighbors = buildCourseNeighbors(allSeries, course);
  return {
    current: { id: course.id, name: course.name },
    intraPrev: neighbors.intraPrev,
    intraNext: neighbors.intraNext,
    crossPrereqs: neighbors.crossPrevs,
    crossNexts: neighbors.crossNexts,
    isStart: course.is_start === true,
    isGoal: course.is_goal === true,
  };
}

/** cross_series_next が別シリーズ先か */
export function isCrossSeriesLink(
  allSeries: Series[],
  fromCourseId: string,
  toCourseId: string,
): boolean {
  return !isSameSeriesCourse(allSeries, fromCourseId, toCourseId);
}

function findCourse(allSeries: Series[], courseId: string): Course | undefined {
  for (const s of allSeries) {
    const c = s.courses.find((co) => co.id === courseId);
    if (c) return c;
  }
  return undefined;
}

function cloneSeriesLinkArrays(allSeries: Series[]): Series[] {
  return allSeries.map((s) => ({
    ...s,
    courses: s.courses.map((c) => ({
      ...c,
      cross_series_prev: [...c.cross_series_prev],
      cross_series_next: [...c.cross_series_next],
    })),
  }));
}

function updateCourseById(
  allSeries: Series[],
  courseId: string,
  patch: (course: Course) => Course,
): Series[] {
  return allSeries.map((s) => ({
    ...s,
    courses: s.courses.map((c) => (c.id === courseId ? patch(c) : c)),
  }));
}

function courseIdsInSameSeries(
  allSeries: Series[],
  courseId: string,
): Set<string> {
  const parent = findSeriesContainingCourse(allSeries, courseId);
  if (!parent) return new Set();
  return new Set(parent.courses.map((c) => c.id));
}

function removeFromCrossSeriesPrev(
  allSeries: Series[],
  targetCourseId: string,
  sourceCourseId: string,
): Series[] {
  return updateCourseById(allSeries, targetCourseId, (c) => ({
    ...c,
    cross_series_prev: c.cross_series_prev.filter((id) => id !== sourceCourseId),
  }));
}

function removeFromCrossSeriesNext(
  allSeries: Series[],
  sourceCourseId: string,
  targetCourseId: string,
): Series[] {
  return updateCourseById(allSeries, sourceCourseId, (c) => ({
    ...c,
    cross_series_next: c.cross_series_next.filter((id) => id !== targetCourseId),
  }));
}

/** 出口元から、ターゲットと同シリーズの他 next を1つに排他しミラーを除去 */
function removeOtherNextInTargetSeries(
  allSeries: Series[],
  sourceCourseId: string,
  targetCourseId: string,
): Series[] {
  const targetParent = findSeriesContainingCourse(allSeries, targetCourseId);
  if (!targetParent) return allSeries;

  const targetSeriesIds = new Set(targetParent.courses.map((c) => c.id));
  const source = findCourse(allSeries, sourceCourseId);
  if (!source) return allSeries;

  let series = allSeries;
  for (const otherTargetId of source.cross_series_next) {
    if (otherTargetId !== targetCourseId && targetSeriesIds.has(otherTargetId)) {
      series = removeFromCrossSeriesPrev(series, otherTargetId, sourceCourseId);
    }
  }

  return updateCourseById(series, sourceCourseId, (c) => ({
    ...c,
    cross_series_next: c.cross_series_next.filter(
      (id) => id === targetCourseId || !targetSeriesIds.has(id),
    ),
  }));
}

/** source → target の出口リンク: ミラー + ソースシリーズ排他 */
function establishOutgoingLink(
  allSeries: Series[],
  sourceCourseId: string,
  targetCourseId: string,
): Series[] {
  const parent = findSeriesContainingCourse(allSeries, sourceCourseId);
  if (!parent) return allSeries;

  let series = allSeries;
  const sameSeriesIds = courseIdsInSameSeries(series, sourceCourseId);

  for (const c of parent.courses) {
    if (c.id === sourceCourseId) continue;
    series = updateCourseById(series, c.id, (course) => ({
      ...course,
      cross_series_next: course.cross_series_next.filter((id) => id !== targetCourseId),
    }));
  }

  series = updateCourseById(series, targetCourseId, (c) => {
    const prevs = c.cross_series_prev.filter((id) => !sameSeriesIds.has(id));
    if (!prevs.includes(sourceCourseId)) {
      prevs.push(sourceCourseId);
    }
    return { ...c, cross_series_prev: prevs };
  });

  series = updateCourseById(series, sourceCourseId, (c) => ({
    ...c,
    cross_series_next: c.cross_series_next.includes(targetCourseId)
      ? c.cross_series_next
      : [...c.cross_series_next, targetCourseId],
  }));

  return removeOtherNextInTargetSeries(series, sourceCourseId, targetCourseId);
}

/** source → target の入口リンク: ミラー + ソースシリーズ排他 */
function establishIncomingLink(
  allSeries: Series[],
  sourceCourseId: string,
  targetCourseId: string,
): Series[] {
  const parent = findSeriesContainingCourse(allSeries, sourceCourseId);
  if (!parent) return allSeries;

  let series = allSeries;
  const sameSeriesIds = courseIdsInSameSeries(series, sourceCourseId);

  for (const c of parent.courses) {
    if (c.id === sourceCourseId) continue;
    series = updateCourseById(series, c.id, (course) => ({
      ...course,
      cross_series_next: course.cross_series_next.filter((id) => id !== targetCourseId),
    }));
  }

  series = updateCourseById(series, sourceCourseId, (c) => ({
    ...c,
    cross_series_next: c.cross_series_next.includes(targetCourseId)
      ? c.cross_series_next
      : [...c.cross_series_next, targetCourseId],
  }));

  series = updateCourseById(series, targetCourseId, (c) => {
    const prevs = c.cross_series_prev.filter((id) => !sameSeriesIds.has(id));
    if (!prevs.includes(sourceCourseId)) {
      prevs.push(sourceCourseId);
    }
    return { ...c, cross_series_prev: prevs };
  });

  series = removeOtherNextInTargetSeries(series, sourceCourseId, targetCourseId);

  return series;
}

/**
 * コースメタ保存時に別シリーズリンクを双方向同期する。
 * 編集コースの cross_series_prev / cross_series_next を正とし、ミラー・排他を伝播する。
 */
export function applyCrossSeriesCourseMetaEdit(
  allSeries: Series[],
  editedCourseId: string,
  crossSeriesPrev: string[],
  crossSeriesNext: string[],
): Series[] {
  const edited = findCourse(allSeries, editedCourseId);
  if (!edited) return allSeries;

  const oldCrossSeriesPrev = filterCrossSeriesIds(
    allSeries,
    editedCourseId,
    edited.cross_series_prev,
  );
  const oldCrossSeriesNext = filterCrossSeriesIds(
    allSeries,
    editedCourseId,
    edited.cross_series_next,
  );

  let series = cloneSeriesLinkArrays(allSeries);

  series = updateCourseById(series, editedCourseId, (c) => ({
    ...c,
    cross_series_prev: [...crossSeriesPrev],
    cross_series_next: [...crossSeriesNext],
  }));

  for (const targetId of oldCrossSeriesNext) {
    if (!crossSeriesNext.includes(targetId)) {
      series = removeFromCrossSeriesPrev(series, targetId, editedCourseId);
    }
  }

  for (const sourceId of oldCrossSeriesPrev) {
    if (!crossSeriesPrev.includes(sourceId)) {
      series = removeFromCrossSeriesNext(series, sourceId, editedCourseId);
    }
  }

  for (const targetId of crossSeriesNext) {
    series = establishOutgoingLink(series, editedCourseId, targetId);
  }

  for (const sourceId of crossSeriesPrev) {
    series = establishIncomingLink(series, sourceId, editedCourseId);
  }

  return series;
}

/** 曼陀羅全体の有向辺（シリーズ内鎖 + 別シリーズリンク）を構築する */
export function buildCourseFlowAdjacency(
  allSeries: Series[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();

  const addEdge = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const next = adj.get(fromId) ?? [];
    if (!next.includes(toId)) {
      next.push(toId);
      adj.set(fromId, next);
    }
    if (!adj.has(toId)) adj.set(toId, []);
  };

  for (const s of allSeries) {
    for (let i = 1; i < s.courses.length; i++) {
      addEdge(s.courses[i - 1].id, s.courses[i].id);
    }
  }

  const ids = existingCourseIds(allSeries);
  for (const s of allSeries) {
    for (const c of s.courses) {
      for (const prevId of c.cross_series_prev) {
        if (
          ids.has(prevId) &&
          isCrossSeriesLink(allSeries, c.id, prevId)
        ) {
          addEdge(prevId, c.id);
        }
      }
      for (const nextId of c.cross_series_next) {
        if (
          ids.has(nextId) &&
          isCrossSeriesLink(allSeries, c.id, nextId)
        ) {
          addEdge(c.id, nextId);
        }
      }
    }
  }

  return adj;
}

/** 曼陀羅全体のグラフに循環があるか */
export function hasCourseFlowCycle(allSeries: Series[]): boolean {
  const adj = buildCourseFlowAdjacency(allSeries);
  const nodes = new Set<string>();
  for (const [from, tos] of adj) {
    nodes.add(from);
    for (const to of tos) nodes.add(to);
  }

  const state = new Map<string, 0 | 1 | 2>();

  const dfs = (nodeId: string): boolean => {
    state.set(nodeId, 1);
    for (const nextId of adj.get(nodeId) ?? []) {
      const nextState = state.get(nextId) ?? 0;
      if (nextState === 1) return true;
      if (nextState === 0 && dfs(nextId)) return true;
    }
    state.set(nodeId, 2);
    return false;
  };

  for (const nodeId of nodes) {
    if ((state.get(nodeId) ?? 0) === 0 && dfs(nodeId)) return true;
  }
  return false;
}

/** コースメタ保存をドライランし、曼陀羅全体で新たに循環が生じるか */
export function wouldCourseMetaEditCreateCycle(
  allSeries: Series[],
  editedCourseId: string,
  crossSeriesPrev: string[],
  crossSeriesNext: string[],
): boolean {
  const edited = findCourse(allSeries, editedCourseId);
  if (!edited) return false;

  const preview = applyCrossSeriesCourseMetaEdit(
    allSeries,
    editedCourseId,
    crossSeriesPrev,
    crossSeriesNext,
  );
  if (!hasCourseFlowCycle(preview)) return false;

  if (!hasCourseFlowCycle(allSeries)) return true;

  const oldCrossSeriesPrev = filterCrossSeriesIds(
    allSeries,
    editedCourseId,
    edited.cross_series_prev,
  );
  const oldCrossSeriesNext = filterCrossSeriesIds(
    allSeries,
    editedCourseId,
    edited.cross_series_next,
  );
  const sameIds = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id, i) => id === b[i]);

  const linksChanged =
    !sameIds(oldCrossSeriesPrev, crossSeriesPrev) ||
    !sameIds(oldCrossSeriesNext, crossSeriesNext);

  return linksChanged;
}

export type CourseMetaPersistTarget = {
  seriesName: string;
  course: Course;
};

/** 別シリーズリンク同期後に .meta.json へ書き戻す必要があるコースを列挙する */
export function listCoursesNeedingMetaPersist(
  before: Series[],
  after: Series[],
  editedCourseId: string,
): CourseMetaPersistTarget[] {
  const out: CourseMetaPersistTarget[] = [];
  for (const s of after) {
    const oldS = before.find((x) => x.id === s.id);
    if (!oldS) continue;
    for (const c of s.courses) {
      const oldC = oldS.courses.find((x) => x.id === c.id);
      if (!oldC) continue;
      const linksChanged =
        !sameCourseIdList(oldC.cross_series_prev, c.cross_series_prev) ||
        !sameCourseIdList(oldC.cross_series_next, c.cross_series_next);
      const isEdited = c.id === editedCourseId;
      const editedMetaChanged =
        isEdited &&
        (oldC.name !== c.name ||
          oldC.target !== c.target ||
          oldC.style !== c.style ||
          // ⚠ コースメタに項目を足したらここにも足すこと。
          // 漏れると「その項目だけ変更」が保存されず消える。
          // 未設定はキー無し・空文字のどちらでも来るので正規化して比べる
          (oldC.slug ?? "") !== (c.slug ?? "") ||
          (oldC.catch ?? "") !== (c.catch ?? "") ||
          (oldC.description ?? "") !== (c.description ?? "") ||
          // 未宣言はキー無し・false のどちらでも来るので真偽で比べる
          !!oldC.is_start !== !!c.is_start ||
          !!oldC.is_goal !== !!c.is_goal ||
          linksChanged);
      if (linksChanged || editedMetaChanged) {
        out.push({ seriesName: s.name, course: c });
      }
    }
  }
  return out;
}

function sameCourseIdList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
