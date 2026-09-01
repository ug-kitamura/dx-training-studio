import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/schema";
import {
  countImageRefsInSeries,
  extractImageRefs,
  FILTER_SERIES_UNUSED,
  indexImageRefLocations,
  isUsedImageFilterActive,
  usedRowMatchesFilter,
  type UsedImageFilter,
} from "@/lib/extract-image-refs";

const seriesFixture: Series[] = [
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
            series: "Series A",
            course: "Course 1",
            lesson: "Lesson 1",
            status: "open",
            description: "",
            tags: [],
            estimated_minutes: 0,
            author: "",
            content: "![a](images/used.png)\n",
          },
          {
            id: "l2",
            series: "Series A",
            course: "Course 1",
            lesson: "Lesson 2",
            status: "open",
            description: "",
            tags: [],
            estimated_minutes: 0,
            author: "",
            content: "no images",
          },
        ],
      },
    ],
  },
];

describe("extractImageRefs", () => {
  it("extracts mp4 canonical paths", () => {
    expect(extractImageRefs("![demo](images/demo.mp4)")).toEqual([
      "images/demo.mp4",
    ]);
  });

  it("decodes percent-encoded paths in markdown", () => {
    expect(
      extractImageRefs(
        "![demo](images/DX_Training_Editor_6%E6%9C%886%E6%97%A5_14_31.mp4)",
      ),
    ).toEqual(["images/DX_Training_Editor_6月6日_14_31.mp4"]);
  });
});

describe("usedRowMatchesFilter", () => {
  const refLocations = indexImageRefLocations(seriesFixture);

  it("shows all rows when filter inactive", () => {
    const filter: UsedImageFilter = {
      seriesId: null,
      courseId: null,
      lessonId: null,
    };
    expect(isUsedImageFilterActive(filter)).toBe(false);
    expect(
      usedRowMatchesFilter("images/used.png", 1, filter, refLocations),
    ).toBe(true);
    expect(
      usedRowMatchesFilter("images/unused.png", 0, filter, refLocations),
    ).toBe(true);
  });

  it("hides unused when filter active", () => {
    const filter: UsedImageFilter = {
      seriesId: "s1",
      courseId: null,
      lessonId: null,
    };
    expect(
      usedRowMatchesFilter("images/unused.png", 0, filter, refLocations),
    ).toBe(false);
  });

  it("series unused mode shows only unreferenced images", () => {
    const filter: UsedImageFilter = {
      seriesId: FILTER_SERIES_UNUSED,
      courseId: null,
      lessonId: null,
    };
    expect(isUsedImageFilterActive(filter)).toBe(true);
    expect(
      usedRowMatchesFilter("images/used.png", 1, filter, refLocations),
    ).toBe(false);
    expect(
      usedRowMatchesFilter("images/unused.png", 0, filter, refLocations),
    ).toBe(true);
  });

  it("matches lesson scope", () => {
    const filter: UsedImageFilter = {
      seriesId: "s1",
      courseId: "c1",
      lessonId: "l1",
    };
    expect(
      usedRowMatchesFilter("images/used.png", 1, filter, refLocations),
    ).toBe(true);
    expect(
      usedRowMatchesFilter("images/other.png", 1, filter, refLocations),
    ).toBe(false);
  });
});

describe("countImageRefsInSeries は日英どちらの本文も数える", () => {
  const lessonBase = {
    id: "l1",
    series: "Series A",
    course: "Course 1",
    lesson: "Lesson 1",
    status: "open" as const,
    description: "",
    tags: [] as string[],
    estimated_minutes: 0,
    author: "",
  };

  const seriesWith = (content: string, contentEn?: string): Series[] => [
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
              ...lessonBase,
              content,
              ...(contentEn === undefined ? {} : { content_en: contentEn }),
            },
          ],
        },
      ],
    },
  ];

  it("英語本文だけで使われている画像を使用中として数える", () => {
    const counts = countImageRefsInSeries(
      seriesWith("no images", "![a](images/en-only.png)"),
    );
    expect(counts.get("images/en-only.png")).toBe(1);
  });

  it("日英の両方で使われていれば合計する", () => {
    const counts = countImageRefsInSeries(
      seriesWith("![a](images/both.png)", "![a](images/both.png)"),
    );
    expect(counts.get("images/both.png")).toBe(2);
  });

  it("どちらにも無ければ数えない", () => {
    const counts = countImageRefsInSeries(seriesWith("no images", "no images either"));
    expect(counts.get("images/nowhere.png")).toBeUndefined();
  });

  it("英語本文が無いレッスンでも日本語側は数える", () => {
    const counts = countImageRefsInSeries(seriesWith("![a](images/ja-only.png)"));
    expect(counts.get("images/ja-only.png")).toBe(1);
  });

  it("英語本文だけの参照でもレッスン位置が引ける", () => {
    const locations = indexImageRefLocations(
      seriesWith("no images", "![a](images/en-only.png)"),
    );
    expect(locations.get("images/en-only.png")?.[0]?.lessonId).toBe("l1");
  });
});
