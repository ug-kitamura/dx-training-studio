import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Mandala } from "@/components/workspace/mandala/Mandala";
import { buildMandalaGraph } from "@/lib/mandala/build-graph";
import {
  readExpandedSeries,
  resetMandalaMemory,
  writeExpandedSeries,
} from "@/lib/mandala/collapse-memory";
import type { Course, Lesson, Series } from "@/lib/schema";

/**
 * モーダルの全体曼陀羅だけの振る舞い（mandala-modal-behaviors）:
 *   - 既定は**全シリーズ折りたたみ**
 *   - 展開したシリーズをセッション内の記憶から最初の描画で復元する
 *   - 選択中の**コース**の所属シリーズは記録に無くても展開する
 *     （シリーズだけの選択では展開しない）
 *   - シリーズ枠・集約ノードのダブルクリックで開閉がトグルし、記憶される
 *   - `showChrome` 無し（ミニ曼陀羅相当）では読まず書かず、畳みもしない
 *
 * React Flow は jsdom でもノードを DOM に出すので、集約ノードの「N コース・M レッスン」
 * と枠のラベルの有無で開閉を判定する。
 */

function lesson(id: string): Lesson {
  return {
    id,
    series: "s",
    course: "c",
    lesson: "l",
    status: "open",
    description: "",
    tags: [],
    estimated_minutes: 10,
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
    lessons: [lesson(`${id}-1`)],
    ...extra,
  } as Course;
}

function series(id: string, courses: Course[]): Series {
  return { id, name: `シリーズ ${id}`, courses } as Series;
}

const fixture: Series[] = [
  series("ai", [course("ai-1")]),
  series("git", [course("git-1"), course("git-2")]),
];

beforeEach(() => {
  resetMandalaMemory();
});

afterEach(() => {
  cleanup();
  resetMandalaMemory();
});

function renderGlobal({
  showChrome = true,
  currentCourseId = null,
  currentSeriesId = null,
}: {
  showChrome?: boolean;
  currentCourseId?: string | null;
  currentSeriesId?: string | null;
} = {}) {
  const graph = buildMandalaGraph(fixture);
  return render(
    <Mandala
      graph={graph}
      scope={{ kind: "global" }}
      variant="compact"
      currentCourseId={currentCourseId}
      currentSeriesId={currentSeriesId}
      showChrome={showChrome}
      onSelectSeries={vi.fn()}
    />,
  );
}

/** 集約ノードの本文。畳まれているときだけ出る */
const collapsedAi = () => screen.queryByText("1 コース・1 レッスン");
const collapsedGit = () => screen.queryByText("2 コース・2 レッスン");

const expanded = () => [...readExpandedSeries("studio-modal")].sort();

describe("モーダルの全体曼陀羅の既定は全折りたたみ", () => {
  it("記憶が無ければ最初の描画から全シリーズが集約ノードになる", () => {
    renderGlobal();

    expect(collapsedAi()).not.toBeNull();
    expect(collapsedGit()).not.toBeNull();
    expect(screen.queryByText("コース git-1")).toBeNull();
  });
});

describe("モーダルの全体曼陀羅は開閉状態を記憶する", () => {
  it("記憶にあるシリーズは最初の描画から展開されている", () => {
    writeExpandedSeries("studio-modal", new Set(["git"]));
    renderGlobal();

    expect(collapsedGit()).toBeNull();
    expect(screen.getByText("コース git-1")).toBeTruthy();
    expect(collapsedAi()).not.toBeNull();
  });

  it("選択中のコースの所属シリーズは記録に無くても展開され、記憶にも反映される", () => {
    renderGlobal({ currentCourseId: "git-1" });

    expect(collapsedGit()).toBeNull();
    expect(collapsedAi()).not.toBeNull();
    expect(expanded()).toEqual(["git"]);
  });

  it("シリーズだけを選んでいるときは展開しない", () => {
    renderGlobal({ currentSeriesId: "git" });

    expect(collapsedGit()).not.toBeNull();
    expect(expanded()).toEqual([]);
  });

  it("実在しないシリーズの記録は掃除しなくてよい（描画に影響しない）", () => {
    writeExpandedSeries("studio-modal", new Set(["deleted", "git"]));
    renderGlobal();

    expect(collapsedGit()).toBeNull();
    expect(collapsedAi()).not.toBeNull();
  });

  it("showChrome 無しでは記憶を読まず、書かず、畳みもしない", () => {
    writeExpandedSeries("studio-modal", new Set(["git"]));
    renderGlobal({ showChrome: false });

    // 開閉を持たない面なので、記憶の内容によらず全部見えている
    expect(collapsedAi()).toBeNull();
    expect(screen.getByText("コース ai-1")).toBeTruthy();
    expect(screen.getByText("コース git-1")).toBeTruthy();
    expect(expanded()).toEqual(["git"]);
  });
});

describe("モーダルの全体曼陀羅はダブルクリックでシリーズを開閉できる", () => {
  it("集約ノードのダブルクリックで展開され、記憶される", () => {
    renderGlobal();

    fireEvent.doubleClick(collapsedGit()!);

    expect(collapsedGit()).toBeNull();
    expect(screen.getByText("コース git-1")).toBeTruthy();
    expect(expanded()).toEqual(["git"]);
  });

  it("枠のダブルクリックで畳まれ、記憶される", () => {
    writeExpandedSeries("studio-modal", new Set(["git"]));
    renderGlobal();

    fireEvent.doubleClick(screen.getByText("シリーズ git"));

    expect(collapsedGit()).not.toBeNull();
    expect(screen.queryByText("コース git-1")).toBeNull();
    expect(expanded()).toEqual([]);
  });

  it("コースノードのダブルクリックでは何も畳まれない", () => {
    writeExpandedSeries("studio-modal", new Set(["git"]));
    renderGlobal();

    fireEvent.doubleClick(screen.getByText("コース git-1"));

    expect(collapsedGit()).toBeNull();
    expect(screen.getByText("コース git-1")).toBeTruthy();
  });

  it("showChrome 無しでは枠をダブルクリックしても畳まれない", () => {
    renderGlobal({ showChrome: false });

    fireEvent.doubleClick(screen.getByText("シリーズ git"));

    expect(collapsedGit()).toBeNull();
  });
});
