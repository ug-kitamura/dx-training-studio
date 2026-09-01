import { describe, expect, it } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { HeroTitle } from "@/components/pages/HeroTitle";
import { TitleWithCatch } from "@/components/pages/TitleWithCatch";

type Rendered = ReactElement<{ className?: string; children?: ReactNode }>;

/**
 * 関数コンポーネントの要素を1段だけ実体化する。
 * `HeroTitle` は `TitleWithCatch` の要素を返すだけなので、これを挟まないと
 * ツリーを降りても中身（記法もクラスも）に届かない。
 * ⚠ `react-dom/server` を使わないのは、mandala が `@types/react-dom` を持たず
 *   `tsc --noEmit` が汚れるため（サイト側は 0 件を保つ約束）。対象は hooks を
 *   持たない純関数なので、直接呼べば足りる。
 */
function render(node: ReactNode): ReactNode {
  if (node === null || typeof node !== "object" || !("type" in node)) {
    return node;
  }
  const element = node as ReactElement<Record<string, unknown>>;
  if (typeof element.type !== "function") return node;
  const component = element.type as (props: unknown) => ReactNode;
  return render(component(element.props));
}

/** React 要素ツリーからテキストだけを拾う */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  const rendered = render(node);
  if (rendered !== node) return textOf(rendered);
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return textOf(props?.children);
  }
  return "";
}

/** 要素ツリーから、指定クラスを持つ最初の要素を探す */
function findByClass(node: ReactNode, className: string): Rendered | null {
  if (node === null || node === undefined || typeof node !== "object") {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findByClass(child, className);
      if (hit) return hit;
    }
    return null;
  }
  const rendered = render(node);
  if (rendered !== node) return findByClass(rendered, className);
  if (!("props" in node)) return null;
  const element = node as Rendered;
  if (element.props?.className === className) return element;
  return findByClass(element.props?.children, className);
}

/**
 * 記法の正本は `TitleWithCatch` 1箇所。ヒーロー見出しと一覧カードが同じ型で
 * 出ることを、両方の経路から確かめる。
 * ⚠ 全角スペースはソースを目で見ても半角と区別しにくいので、テストで縛る
 *   （2026-08-20 に全角 → 半角へ変更）。
 */
const CARD = "dxm-card-catch";
const HERO = "dxm-hero-catch";

function catchText(props: { title: string; catchCopy?: string }): string {
  return textOf(TitleWithCatch({ ...props, catchClassName: CARD }));
}

describe("TitleWithCatch", () => {
  it("キャッチの前は半角スペース1つとダッシュ", () => {
    expect(
      catchText({ title: "DX入門コース", catchCopy: "地図を手に入れる" }),
    ).toBe("DX入門コース ——地図を手に入れる");
  });

  it("全角スペースを含まない", () => {
    expect(
      catchText({ title: "DX入門コース", catchCopy: "地図を手に入れる" }),
    ).not.toContain("　");
  });

  it("catch が無ければタイトルだけ", () => {
    const text = catchText({ title: "はじめにシリーズ" });

    expect(text).toBe("はじめにシリーズ");
    expect(text).not.toContain("——");
  });

  it("キャッチのスタイルは呼び出し側のクラスで決まる", () => {
    const tree = TitleWithCatch({
      title: "DX入門コース",
      catchCopy: "地図を手に入れる",
      catchClassName: CARD,
    });

    expect(findByClass(tree, CARD)).not.toBeNull();
    expect(findByClass(tree, HERO)).toBeNull();
  });

  it("返すのは単一の要素（`.dxm-card-title` から見て flex アイテム1つ）", () => {
    const tree = TitleWithCatch({
      title: "DX入門コース",
      catchCopy: "地図を手に入れる",
      catchClassName: CARD,
    });

    expect(Array.isArray(tree)).toBe(false);
    expect(tree.props.className).toBe("dxm-title-line");
  });
});

describe("HeroTitle", () => {
  it("カードと同じ記法で組み立てる", () => {
    const props = { title: "DX入門コース", catchCopy: "地図を手に入れる" };

    expect(textOf(HeroTitle(props))).toBe(catchText(props));
  });

  it("キャッチにはヒーロー用のクラスを当てる", () => {
    const tree = HeroTitle({
      title: "DX入門コース",
      catchCopy: "地図を手に入れる",
    });

    expect(findByClass(tree, HERO)).not.toBeNull();
    expect(findByClass(tree, CARD)).toBeNull();
  });

  it("catch が無ければタイトルだけ", () => {
    expect(textOf(HeroTitle({ title: "はじめにシリーズ" }))).toBe(
      "はじめにシリーズ",
    );
  });
});
