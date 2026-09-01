import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Mandala } from "@/components/workspace/mandala/Mandala";
import { buildMandalaGraph } from "@/lib/mandala/build-graph";
import type { Course, Lesson, Series } from "@/lib/schema";

/**
 * コースメタ編集画面のミニ曼陀羅サムネイルと同じ構成
 * （`pointer-events-none` な div を挟んで button で包む）で
 * コースノードのクリック分岐を検証する。
 *
 * `pointer-events: none` そのものは jsdom がレイアウト計算をしないため
 * ここでは再現できないが、検証したいのは実際のクリック処理
 * （`onSelectCourse` の呼び分けと `stopPropagation` によるバブリング制御）
 * であり、それは DOM 上のイベント伝播として素直にテストできる。
 */

function lesson(minutes: number): Lesson {
  return {
    id: `lsn-${minutes}`,
    series: "s",
    course: "c",
    lesson: "l",
    status: "open",
    description: "",
    tags: [],
    estimated_minutes: minutes,
    author: "",
    content: "",
  } as Lesson;
}

function course(id: string, extra: Partial<Course> = {}): Course {
  return {
    id,
    name: `コース ${id}`,
    cross_series_prev: [],
    cross_series_next: [],
    lessons: [lesson(10)],
    ...extra,
  } as Course;
}

function series(id: string, courses: Course[]): Series {
  return { id, name: `シリーズ ${id}`, courses } as Series;
}

/**
 * git シリーズ: a → b(中心) → c
 * 中心の b 自身が Start を宣言する——ミニ曼陀羅は中心コース自身の宣言だけを
 * 拾う仕様（`Mandala.tsx` の `terminalSources`）なので、隣接コース側に
 * 宣言しても Start 端子は出ない
 */
const fixture: Series[] = [
  series("git", [
    course("a"),
    course("b", { is_start: true }),
    course("c"),
  ]),
];

afterEach(() => {
  cleanup();
});

function renderThumbnail(onSelectCourse: (courseId: string) => void) {
  const graph = buildMandalaGraph(fixture);
  const onOuterClick = vi.fn();
  render(
    <button type="button" onClick={onOuterClick} aria-label="拡大表示">
      <div className="pointer-events-none">
        <Mandala
          graph={graph}
          scope={{ kind: "course", courseId: "b" }}
          variant="compact"
          currentCourseId="b"
          staticView
          onSelectCourse={onSelectCourse}
        />
      </div>
    </button>,
  );
  return { onOuterClick };
}

describe("Mandala のサムネイルにおけるコースノードのクリック分岐", () => {
  it("隣接コースのブロックをクリックすると onSelectCourse を呼び、外側（拡大モーダルのボタン）へは伝播しない", () => {
    const onSelectCourse = vi.fn();
    const { onOuterClick } = renderThumbnail(onSelectCourse);

    fireEvent.click(screen.getByText("コース a"));

    expect(onSelectCourse).toHaveBeenCalledWith("a");
    expect(onOuterClick).not.toHaveBeenCalled();
  });

  it("中心（現在選択中）のコース自身をクリックしても何も起きない", () => {
    const onSelectCourse = vi.fn();
    const { onOuterClick } = renderThumbnail(onSelectCourse);

    fireEvent.click(screen.getByText("コース b"));

    expect(onSelectCourse).not.toHaveBeenCalled();
    expect(onOuterClick).not.toHaveBeenCalled();
  });

  it("コースのブロック以外（Start 端子）をクリックすると外側まで伝播し、拡大モーダルを開く動作に繋がる", () => {
    const onSelectCourse = vi.fn();
    const { onOuterClick } = renderThumbnail(onSelectCourse);

    fireEvent.click(screen.getByText("Start"));

    expect(onSelectCourse).not.toHaveBeenCalled();
    expect(onOuterClick).toHaveBeenCalledTimes(1);
  });
});
