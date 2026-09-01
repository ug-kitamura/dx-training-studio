import { describe, expect, it } from "vitest";
import {
  clampPaneWidth,
  computePane3Width,
  fitPaneLayout,
  PANE3_MIN_WIDTH,
  PANE4_COLLAPSED_WIDTH,
  PANE_RESIZE_HANDLE_WIDTH_PX,
  PANE_WIDTH_DEFAULTS,
  PANE_WIDTH_LIMITS,
  PANE_WIDTH_STEP,
  snapPaneWidth,
  snapPaneWidths,
} from "@/components/workspace/pane-layout";

function handles(pane4Open: boolean) {
  return (pane4Open ? 1 : 0) * PANE_RESIZE_HANDLE_WIDTH_PX;
}

describe("clampPaneWidth", () => {
  it("clamps tree to min and max", () => {
    expect(clampPaneWidth("tree", 100)).toBe(PANE_WIDTH_LIMITS.tree.min);
    expect(clampPaneWidth("tree", 900)).toBe(PANE_WIDTH_LIMITS.tree.max);
  });

  it("clamps pane4 to min and max", () => {
    expect(clampPaneWidth("pane4", 200)).toBe(PANE_WIDTH_LIMITS.pane4.min);
    expect(clampPaneWidth("pane4", 1500)).toBe(PANE_WIDTH_LIMITS.pane4.max);
  });

  it("returns value unchanged when within range", () => {
    expect(clampPaneWidth("tree", 300)).toBe(300);
    expect(clampPaneWidth("pane4", 600)).toBe(600);
  });

  it("uses 400 as the pane4 lower bound", () => {
    expect(PANE_WIDTH_LIMITS.pane4.min).toBe(400);
  });

  // 下限を 300 → 400 に上げた（2026-08-19）。それ以前に保存された幅は
  // 起動時の読み込みで clamp され、エラーにはならない
  it.each([300, 320, 399])("rounds the old saved width %i up to 400", (old) => {
    expect(clampPaneWidth("pane4", old)).toBe(400);
  });
});

describe("PANE_WIDTH_DEFAULTS", () => {
  it("tree 350 / pane4 500", () => {
    expect(PANE_WIDTH_DEFAULTS).toEqual({ tree: 350, pane4: 500 });
  });
});

describe("snapPaneWidth", () => {
  it("snaps to nearest 5px step within limits", () => {
    expect(snapPaneWidth("tree", 313)).toBe(315);
    expect(snapPaneWidth("tree", 312)).toBe(310);
  });

  it("clamps before snapping at boundaries", () => {
    expect(snapPaneWidth("tree", 100)).toBe(PANE_WIDTH_LIMITS.tree.min);
    expect(snapPaneWidth("pane4", 2000)).toBe(PANE_WIDTH_LIMITS.pane4.max);
  });
});

describe("snapPaneWidths", () => {
  it("snaps each pane independently within limits and step", () => {
    const snapped = snapPaneWidths({ tree: 213, pane4: 998 });
    expect(snapped.tree % PANE_WIDTH_STEP).toBe(0);
    expect(snapped.pane4 % PANE_WIDTH_STEP).toBe(0);
    expect(snapped.tree).toBeGreaterThanOrEqual(PANE_WIDTH_LIMITS.tree.min);
    expect(snapped.tree).toBeLessThanOrEqual(PANE_WIDTH_LIMITS.tree.max);
    expect(snapped.pane4).toBeLessThanOrEqual(PANE_WIDTH_LIMITS.pane4.max);
  });
});

describe("computePane3Width", () => {
  it("subtracts pane widths and handles", () => {
    const totalWidth = 1600;
    const widths = { tree: 300, pane4: 500 };
    expect(computePane3Width(widths, { totalWidth, pane4Open: true })).toBe(
      totalWidth - widths.tree - widths.pane4 - handles(true),
    );
  });

  it("uses collapsed pane4 width when closed", () => {
    const totalWidth = 1600;
    const widths = { tree: 300, pane4: 500 };
    expect(computePane3Width(widths, { totalWidth, pane4Open: false })).toBe(
      totalWidth - widths.tree - PANE4_COLLAPSED_WIDTH - handles(false),
    );
  });
});

describe("fitPaneLayout", () => {
  it("returns requested widths when pane3 has room", () => {
    const requested = { tree: 300, pane4: 600 };
    const result = fitPaneLayout({
      requested,
      totalWidth: 2000,
      pane4Open: true,
    });
    expect(result).toEqual(requested);
  });

  it("shrinks pane4 first when pane3 is below min", () => {
    const result = fitPaneLayout({
      requested: { tree: 300, pane4: 700 },
      // tree 300 + pane4 700 + handle 8 + pane3 500 = 1508 が必要。
      // 1500 では pane4 が 8 譲る
      totalWidth: 1500,
      pane4Open: true,
    });
    expect(result.tree).toBe(300);
    expect(result.pane4).toBe(700 - 8);
    expect(
      computePane3Width(result, { totalWidth: 1500, pane4Open: true }),
    ).toBe(PANE3_MIN_WIDTH);
  });

  it("shrinks pane4 then tree", () => {
    const result = fitPaneLayout({
      requested: { tree: 500, pane4: 1000 },
      totalWidth: 1200,
      pane4Open: true,
    });
    expect(result.pane4).toBe(PANE_WIDTH_LIMITS.pane4.min);
    expect(result.tree).toBeLessThan(500);
  });

  it("skips pane4 shrink when pane4 is closed", () => {
    const result = fitPaneLayout({
      requested: { tree: 500, pane4: 1000 },
      totalWidth: 900,
      pane4Open: false,
    });
    // pane4 閉時は 48px 固定。tree だけが縮む
    expect(result.pane4).toBe(clampPaneWidth("pane4", 1000));
    expect(result.tree).toBeLessThan(500);
  });

  it("returns all mins when viewport is below absolute minimum", () => {
    const result = fitPaneLayout({
      requested: { tree: 500, pane4: 1000 },
      totalWidth: 500,
      pane4Open: true,
    });
    expect(result.tree).toBe(PANE_WIDTH_LIMITS.tree.min);
    expect(result.pane4).toBe(PANE_WIDTH_LIMITS.pane4.min);
  });

  it("when expanding tree shrinks pane4 but not tree", () => {
    const result = fitPaneLayout({
      requested: { tree: 450, pane4: 700 },
      totalWidth: 1500,
      pane4Open: true,
      expandPane: "tree",
    });
    expect(result.tree).toBe(450);
    expect(result.pane4).toBeLessThan(700);
  });

  it("when expanding pane4 shrinks tree but not pane4", () => {
    // 必要幅 = tree 450 + pane4 700 + handle 8 + pane3 min 500 = 1658。
    // 1608 では不足 50 を tree が吸収する（450 → 400）
    const result = fitPaneLayout({
      requested: { tree: 450, pane4: 700 },
      totalWidth: 1608,
      pane4Open: true,
      expandPane: "pane4",
    });
    expect(result.pane4).toBe(700);
    expect(result.tree).toBe(400);
  });

  it("when expanding pane4 caps width once tree is at min", () => {
    const result = fitPaneLayout({
      requested: { tree: 200, pane4: 1000 },
      totalWidth: 1200,
      pane4Open: true,
      expandPane: "pane4",
    });
    expect(result.tree).toBe(PANE_WIDTH_LIMITS.tree.min);
    // pane4 は「拡大したぶんを自分で返す」形で cap される
    expect(
      computePane3Width(result, { totalWidth: 1200, pane4Open: true }),
    ).toBeGreaterThanOrEqual(PANE3_MIN_WIDTH);
  });
});
