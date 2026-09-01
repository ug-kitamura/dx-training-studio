import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  CrossSeriesCourseTreePicker,
  toggleCrossSeriesSelection,
  type CrossSeriesCourseCandidate,
} from "@/components/workspace/CrossSeriesCourseTreePicker";

const candidates: CrossSeriesCourseCandidate[] = [
  { id: "crs-a", name: "Git概念コース", seriesName: "Git基礎シリーズ" },
  { id: "crs-b", name: "Git基本操作コース", seriesName: "Git基礎シリーズ" },
];

afterEach(cleanup);

describe("CrossSeriesCourseTreePicker の特殊枠", () => {
  it("marker を渡すと候補の先頭にチェックボックスが出る", () => {
    render(
      <CrossSeriesCourseTreePicker
        candidates={candidates}
        selectedIds={[]}
        onChange={() => {}}
        marker={{ label: "Start", checked: false, onToggle: () => {} }}
      />,
    );
    expect(screen.getByLabelText("Start")).toBeDefined();
  });

  it("特殊枠の切り替えは onToggle だけを呼び、選択 ID を変えない", () => {
    const onToggle = vi.fn();
    const onChange = vi.fn();
    render(
      <CrossSeriesCourseTreePicker
        candidates={candidates}
        selectedIds={["crs-a"]}
        onChange={onChange}
        marker={{ label: "Start", checked: false, onToggle }}
      />,
    );

    fireEvent.click(screen.getByLabelText("Start"));

    expect(onToggle).toHaveBeenCalledWith(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("コース選択は特殊枠に影響しない（別シリーズ選択は従来どおり）", () => {
    const onChange = vi.fn();
    const onToggle = vi.fn();
    render(
      <CrossSeriesCourseTreePicker
        candidates={candidates}
        selectedIds={[]}
        onChange={onChange}
        marker={{ label: "Start", checked: true, onToggle }}
      />,
    );

    fireEvent.click(screen.getByLabelText("Git概念コース"));

    expect(onChange).toHaveBeenCalledWith(["crs-a"]);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("候補が0件でも特殊枠があれば描画する", () => {
    render(
      <CrossSeriesCourseTreePicker
        candidates={[]}
        selectedIds={[]}
        onChange={() => {}}
        marker={{ label: "Goal", checked: false, onToggle: () => {} }}
      />,
    );
    expect(screen.getByLabelText("Goal")).toBeDefined();
  });

  it("特殊枠は各シリーズ1件までのルールに関与しない", () => {
    // 純関数側の確認: 候補に無い ID（特殊枠）は選択リストを変えない
    expect(toggleCrossSeriesSelection([], "start", candidates)).toEqual([]);
  });
});
