import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLessonMutations } from "@/components/workspace/hooks/use-lesson-mutations";
import type { Series } from "@/lib/schema";
import type { WorkspaceSelection } from "@/lib/workspace-selection";

// mutation コールバックは呼び出し時点の選択状態を用いる（workspace-state-hooks spec）。
// 依存配列から selectedSeriesId が欠落すると、シリーズ切替後の addLesson が
// 古いクロージャの選択シリーズを selection に書き戻す。

function makeSeries(id: string, name: string, courseId: string): Series {
  return {
    id,
    name,
    courses: [
      {
        id: courseId,
        name: `${name}のコース`,
        target: "",
        cross_series_prev: [],
        cross_series_next: [],
        is_start: false,
        is_goal: false,
        lessons: [],
      },
    ],
  } as unknown as Series;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useLessonMutations の選択状態", () => {
  it("シリーズ切替後の addLesson は切替後のシリーズを selection に書く", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({}), { status: 200 }),
    ) as never;

    const seriesA = makeSeries("ser-a", "シリーズA", "crs-a");
    const seriesB = makeSeries("ser-b", "シリーズB", "crs-b");
    const allSeries = [seriesA, seriesB];

    const selections: WorkspaceSelection[] = [];

    const { result, rerender } = renderHook(
      ({ selectedSeriesId }: { selectedSeriesId: string }) =>
        useLessonMutations({
          series: allSeries,
          setSeries: () => {},
          selectedSeriesId,
          selectedCourseId: "",
          selectedLessonId: "",
          setSelection: (s) => selections.push(s),
        }),
      { initialProps: { selectedSeriesId: "ser-a" } },
    );

    // シリーズ B へ切り替えてからレッスンを追加する
    rerender({ selectedSeriesId: "ser-b" });
    await act(async () => {
      result.current.addLesson("crs-b", "新しいレッスン");
    });

    expect(selections.length).toBeGreaterThan(0);
    expect(selections.at(-1)?.seriesId).toBe("ser-b");
  });
});
