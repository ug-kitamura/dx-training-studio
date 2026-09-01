import { describe, expect, it } from "vitest";
import {
  applySeriesRename,
  remapCourseAndLessonIds,
  remapSelection,
} from "@/lib/content-rename";
import type { Series } from "@/lib/schema";

const initial: Series[] = [
  {
    id: "srs-series-a-abc123",
    name: "シリーズA",
    courses: [
      {
        id: "crs-course-1-def456",
        name: "コース1",
        target: "",
        cross_series_prev: ["crs-course-x-ghi789"],
        cross_series_next: [],
        lessons: [
          {
            id: "lesson-シリーズA-コース1-レッスン1",
            series: "シリーズA",
            course: "コース1",
            lesson: "レッスン1",
            status: "open",
            description: "",
            tags: [],
            estimated_minutes: 0,
            author: "",
            content: "",
          },
        ],
      },
    ],
  },
  {
    id: "srs-series-b-jkl012",
    name: "シリーズB",
    courses: [
      {
        id: "crs-course-x-ghi789",
        name: "コースX",
        target: "",
        cross_series_prev: [],
        cross_series_next: ["crs-course-1-def456"],
        lessons: [],
      },
    ],
  },
];

describe("applySeriesRename", () => {
  it("keeps stable ids and updates lesson ids on series rename", () => {
    const { series, remap } = applySeriesRename(
      initial,
      "srs-series-a-abc123",
      "シリーズA改",
    );

    expect(series[0].id).toBe("srs-series-a-abc123");
    expect(series[0].name).toBe("シリーズA改");
    expect(series[0].courses[0].id).toBe("crs-course-1-def456");
    expect(series[0].courses[0].lessons[0].id).toBe(
      "lesson-シリーズA改-コース1-レッスン1",
    );
    expect(series[1].courses[0].cross_series_next).toEqual([
      "crs-course-1-def456",
    ]);
    expect(series[0].courses[0].cross_series_prev).toEqual([
      "crs-course-x-ghi789",
    ]);

    expect(
      remapSelection(
        {
          seriesId: "srs-series-a-abc123",
          courseId: "crs-course-1-def456",
          lessonId: "lesson-シリーズA-コース1-レッスン1",
        },
        remap,
      ),
    ).toEqual({
      seriesId: "srs-series-a-abc123",
      courseId: "crs-course-1-def456",
      lessonId: "lesson-シリーズA改-コース1-レッスン1",
    });
  });
});

describe("remapCourseAndLessonIds", () => {
  it("keeps stable course id and updates lesson ids on course rename", () => {
    const { series, remap } = remapCourseAndLessonIds(
      initial,
      "crs-course-1-def456",
      "シリーズA",
      "コース1改",
    );

    expect(series[0].courses[0].id).toBe("crs-course-1-def456");
    expect(series[0].courses[0].name).toBe("コース1改");
    expect(series[0].courses[0].lessons[0].id).toBe(
      "lesson-シリーズA-コース1改-レッスン1",
    );
    expect(series[1].courses[0].cross_series_next).toEqual([
      "crs-course-1-def456",
    ]);

    expect(
      remapSelection(
        {
          seriesId: "srs-series-a-abc123",
          courseId: "crs-course-1-def456",
          lessonId: "lesson-シリーズA-コース1-レッスン1",
        },
        remap,
      ),
    ).toEqual({
      seriesId: "srs-series-a-abc123",
      courseId: "crs-course-1-def456",
      lessonId: "lesson-シリーズA-コース1改-レッスン1",
    });
  });
});
