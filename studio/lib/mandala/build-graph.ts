/**
 * 正本（`contents/` を読んだ `Series[]`）から曼陀羅グラフを組む。
 *
 * ⚠ 辺の導出規則は公開サイトの `mandala/scripts/lib/site-model.mts` の
 * `buildMandalaGraph` と**同一でなければならない**——規則が割れると、同じ
 * `contents/` を見ているのに 2 つのアプリで違う地図が出る。規則は 2 つだけ:
 *   - order 辺: シリーズ内 `courses` 配列の隣接鎖
 *   - cross 辺: `cross_series_prev` / `cross_series_next`（相手が実在するときのみ）
 * Start / Goal は `is_start` / `is_goal` の宣言から生える。
 *
 * サイト側は camelCase の中間表現（site-data.json）を経由するが、Studio は
 * snake_case の `.meta.json` を直接読む。差はここで吸収する。
 */
import type { MandalaEdge, MandalaGraph, MandalaNode } from "@/lib/mandala/graph";
import type { Series } from "@/lib/schema";
import {
  courseDisplayName,
  seriesDisplayName,
  type EditLanguage,
} from "@/lib/display-name";

/**
 * ⚠ ノードのラベルは**表示名**（英語モードでは `name_en`・未訳は日本語名）。
 * 描画側に言語分岐を持ち込まないよう、ここで解決してから渡す。
 * ID と辺の導出は名前に依存しないので、言語を変えてもグラフの形は変わらない。
 */
export function buildMandalaGraph(
  series: readonly Series[],
  language: EditLanguage = "ja",
): MandalaGraph {
  const nodes: MandalaNode[] = [];
  const knownCourseIds = new Set<string>();

  for (const s of series) {
    for (const course of s.courses) {
      knownCourseIds.add(course.id);
      nodes.push({
        id: course.id,
        label: courseDisplayName(course, language),
        seriesId: s.id,
        seriesName: seriesDisplayName(s, language),
        lessonCount: course.lessons.length,
        totalMinutes: course.lessons.reduce(
          (sum, lesson) => sum + (lesson.estimated_minutes ?? 0),
          0,
        ),
        style: course.style,
        ...(course.is_start ? { isStart: true } : {}),
        ...(course.is_goal ? { isGoal: true } : {}),
      });
    }
  }

  const edges: MandalaEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (source: string, target: string) => {
    const id = `${source}__${target}`;
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({ id, source, target });
  };

  for (const s of series) {
    // 同一シリーズ内は配列の並びがそのまま辺になる
    for (let i = 0; i < s.courses.length - 1; i++) {
      addEdge(s.courses[i]!.id, s.courses[i + 1]!.id);
    }
    // シリーズ跨ぎは相手が存在するときだけ辺にする——存在しない ID を指す
    // 宣言が残っていても、行き先の無い矢印を描かない
    for (const course of s.courses) {
      for (const prevId of course.cross_series_prev) {
        if (knownCourseIds.has(prevId)) addEdge(prevId, course.id);
      }
      for (const nextId of course.cross_series_next) {
        if (knownCourseIds.has(nextId)) addEdge(course.id, nextId);
      }
    }
  }

  return { nodes, edges };
}
