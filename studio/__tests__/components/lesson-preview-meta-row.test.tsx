import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LessonPreviewMetaRow } from "@/components/workspace/LessonPreviewMetaRow";
import type { Course, Lesson } from "@/lib/schema";

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "lsn-1",
    series: "S",
    course: "C",
    lesson: "L",
    status: "in_progress",
    description: "",
    tags: [],
    estimated_minutes: 15,
    author: "Kitamura",
    content: "",
    ...overrides,
  };
}

const course: Course = {
  id: "crs-1",
  name: "C",
  target: "",
  style: "lecture",
  cross_series_prev: [],
  cross_series_next: [],
  lessons: [],
};

afterEach(cleanup);

describe("LessonPreviewMetaRow", () => {
  it("状態・所要時間・受講形態（コースメタ由来）・著者を表示する", () => {
    render(<LessonPreviewMetaRow lesson={lesson()} course={course} />);
    expect(screen.getByText("作成中")).toBeDefined();
    expect(screen.getByText("15分")).toBeDefined();
    expect(screen.getByText("講義")).toBeDefined();
    expect(screen.getByText("著者: Kitamura")).toBeDefined();
  });

  it("完成（done）は状態ラベルを出さない", () => {
    render(<LessonPreviewMetaRow lesson={lesson({ status: "done" })} course={course} />);
    expect(screen.queryByText("完成")).toBeNull();
    expect(screen.getByText("15分")).toBeDefined();
  });

  it("値が無いラベルは出さず、全て無ければ行ごと出さない", () => {
    const { container } = render(
      <LessonPreviewMetaRow
        lesson={lesson({ status: "done", estimated_minutes: 0, author: "" })}
        course={undefined}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
