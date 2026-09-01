import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  LessonMetaPanel,
  lessonToMetaDraft,
} from "@/components/workspace/LessonMetaPanel";
import type { Lesson } from "@/lib/schema";

const lesson: Lesson = {
  id: "lsn-1",
  series: "S",
  course: "C",
  lesson: "L01 はじめの一歩",
  slug: "first-step",
  status: "open",
  description: "この回でやること",
  tags: [],
  estimated_minutes: 15,
  author: "Kitamura",
  content: "",
};

function renderPanel() {
  return render(
    <LessonMetaPanel
      draft={lessonToMetaDraft(lesson)}
      onDraftChange={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe("LessonMetaPanel の並びと入力欄", () => {
  it("レッスン名 → 講義内容 → スラッグ → タグ → 著者 → 所要時間・進捗 の順に並ぶ", () => {
    renderPanel();

    const labels = screen
      .getAllByText(
        /^(レッスン名|講義内容|スラッグ（公開 URL 用）|タグ|著者|所要時間|進捗)$/,
      )
      .map((el) => el.textContent);

    expect(labels).toEqual([
      "レッスン名",
      "講義内容",
      "スラッグ（公開 URL 用）",
      "タグ",
      "著者",
      "所要時間",
      "進捗",
    ]);
  });

  it("講義内容は3行の複数行入力である", () => {
    renderPanel();

    const description = screen.getByLabelText("講義内容");
    expect(description.tagName).toBe("TEXTAREA");
    expect(description).toHaveAttribute("rows", "3");
  });
});
