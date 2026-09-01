import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceSelection } from "@/components/workspace/hooks/use-workspace-selection";
import type { Series } from "@/lib/schema";

const series: Series[] = [
  {
    id: "s1",
    name: "Series A",
    courses: [
      {
        id: "c1",
        name: "Course 1",
        target: "",
        cross_series_prev: [],
        cross_series_next: [],
        lessons: [
          {
            id: "l1",
            lesson: "Lesson 1",
            series: "Series A",
            course: "Course 1",
            status: "open",
            description: "",
            tags: [],
            estimated_minutes: 0,
            author: "",
            content: "",
          },
          {
            id: "l2",
            lesson: "Lesson 2",
            series: "Series A",
            course: "Course 1",
            status: "open",
            description: "",
            tags: [],
            estimated_minutes: 0,
            author: "",
            content: "",
          },
        ],
      },
      {
        id: "c2",
        name: "Course 2",
        target: "",
        cross_series_prev: [],
        cross_series_next: [],
        lessons: [],
      },
    ],
  },
];

describe("useWorkspaceSelection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("selectCourse stops at the course (no descent into lessons)", () => {
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        series,
        initialSeriesId: "",
        initialCourseId: "",
        initialLessonId: "",
      }),
    );

    act(() => {
      result.current.selectCourse("c1");
    });

    expect(result.current.selectedCourseId).toBe("c1");
    expect(result.current.selectedLessonId).toBe("");
  });

  it("selectSeries stops at the series and clears deeper levels", () => {
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        series,
        initialSeriesId: "s1",
        initialCourseId: "c1",
        initialLessonId: "l1",
      }),
    );

    act(() => {
      result.current.selectSeries("s1");
    });

    expect(result.current.selectedSeriesId).toBe("s1");
    expect(result.current.selectedCourseId).toBe("");
    expect(result.current.selectedLessonId).toBe("");
  });

  it("selectHome clears the whole selection and persists it", () => {
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        series,
        initialSeriesId: "s1",
        initialCourseId: "c1",
        initialLessonId: "l1",
      }),
    );

    act(() => {
      result.current.selectHome();
    });

    expect(result.current.selectedSeriesId).toBe("");
    expect(result.current.selectedCourseId).toBe("");
    expect(result.current.selectedLessonId).toBe("");
    expect(
      JSON.parse(localStorage.getItem("dx-training-studio-selection") ?? "{}"),
    ).toEqual({ seriesId: "", courseId: "", lessonId: "" });
  });

  it("selectLesson updates selected lesson only", () => {
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        series,
        initialSeriesId: "s1",
        initialCourseId: "c1",
        initialLessonId: "l1",
      }),
    );

    act(() => {
      result.current.selectLesson("l2");
    });

    expect(result.current.selectedCourseId).toBe("c1");
    expect(result.current.selectedLessonId).toBe("l2");
  });

  it("keeps renamed lesson selected when series updates after meta rename", () => {
    localStorage.setItem(
      "dx-training-studio-selection",
      JSON.stringify({ courseId: "c1", lessonId: "l2" }),
    );

    const renamedSeries: Series[] = [
      {
        ...series[0],
        courses: [
          {
            ...series[0].courses[0],
            lessons: [
              series[0].courses[0].lessons[0],
              {
                ...series[0].courses[0].lessons[1],
                id: "l2-renamed",
                lesson: "Lesson 2 renamed",
              },
            ],
          },
          series[0].courses[1],
        ],
      },
    ];

    const { result, rerender } = renderHook(
      (props: { data: Series[] }) =>
        useWorkspaceSelection({
          series: props.data,
          initialSeriesId: "s1",
          initialCourseId: "c1",
          initialLessonId: "l1",
        }),
      { initialProps: { data: series } },
    );

    expect(result.current.selectedLessonId).toBe("l2");

    act(() => {
      result.current.setSelection({
        seriesId: "s1",
        courseId: "c1",
        lessonId: "l2-renamed",
      });
      rerender({ data: renamedSeries });
    });

    expect(result.current.selectedCourseId).toBe("c1");
    expect(result.current.selectedLessonId).toBe("l2-renamed");
    expect(result.current.selectedLesson?.lesson).toBe("Lesson 2 renamed");
  });
});
