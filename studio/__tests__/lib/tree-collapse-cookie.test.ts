import { describe, expect, it, beforeEach } from "vitest";
import {
  TREE_COLLAPSE_COOKIE_NAME,
  allCollapsed,
  parseTreeCollapseCookie,
  pruneTreeCollapse,
  readTreeCollapseCookieFromDocument,
  serializeTreeCollapseCookie,
  writeTreeCollapseCookie,
} from "@/lib/tree-collapse-cookie";
import type { Series } from "@/lib/schema";

function lesson(id: string, name: string) {
  return {
    id,
    series: "S",
    course: "C",
    lesson: name,
    status: "open" as const,
    content: "",
    description: "",
    tags: [] as string[],
    estimated_minutes: 10,
    author: "",
  };
}

const series: Series[] = [
  {
    id: "srs-a",
    name: "Aシリーズ",
    courses: [
      {
        id: "crs-a1",
        name: "A1コース",
        target: "",
        cross_series_prev: [],
        cross_series_next: [],
        lessons: [lesson("lsn-a1", "A1レッスン")],
      },
    ],
  },
  {
    id: "srs-b",
    name: "Bシリーズ",
    courses: [
      {
        id: "crs-b1",
        name: "B1コース",
        target: "",
        cross_series_prev: [],
        cross_series_next: [],
        lessons: [lesson("lsn-b1", "B1レッスン")],
      },
    ],
  },
];

const NO_SELECTION = { seriesId: "", courseId: "" };

function clearCookie() {
  document.cookie = `${TREE_COLLAPSE_COOKIE_NAME}=; path=/; max-age=0`;
}

beforeEach(clearCookie);

describe("serialize / parse の往復", () => {
  it("畳んだ集合がそのまま戻る", () => {
    const value = serializeTreeCollapseCookie(
      new Set(["srs-a"]),
      new Set(["crs-a1", "crs-b1"]),
      NO_SELECTION,
    );
    expect(parseTreeCollapseCookie(value)).toEqual({
      series: ["srs-a"],
      courses: ["crs-a1", "crs-b1"],
    });
  });

  it("値は URL エンコード済み（cookie の区切り文字を含まない）", () => {
    const value = serializeTreeCollapseCookie(
      new Set(["srs-a"]),
      new Set(["crs-a1"]),
      NO_SELECTION,
    );
    expect(value).not.toMatch(/[;,\s"]/);
  });

  it("復号済みの JSON を渡しても読める（二重復号は無害）", () => {
    const raw = JSON.stringify({ series: ["srs-a"], courses: [] });
    expect(parseTreeCollapseCookie(raw)).toEqual({
      series: ["srs-a"],
      courses: [],
    });
  });
});

describe("parseTreeCollapseCookie は記憶の有無を区別する", () => {
  it("undefined / 空文字は記憶なし（null）", () => {
    expect(parseTreeCollapseCookie(undefined)).toBeNull();
    expect(parseTreeCollapseCookie("")).toBeNull();
  });

  it("JSON として読めない値は記憶なし（null）", () => {
    // 壊れた値は記憶の**喪失**であり、「すべて展開している」という記憶ではない
    expect(parseTreeCollapseCookie("%7B not json")).toBeNull();
  });

  it("畳んだ ID が0件の記憶は null ではない（すべて展開している、の意味）", () => {
    // ⚠ ここが「記憶なし」と潰れると、全部開いた状態を保存した人が
    // 次回すべて畳まれて開くことになる
    expect(
      parseTreeCollapseCookie(JSON.stringify({ series: [], courses: [] })),
    ).toEqual({ series: [], courses: [] });
  });

  it("想定の形でない中身は空配列に落とすが、記憶はあるものとして扱う", () => {
    expect(
      parseTreeCollapseCookie(JSON.stringify({ series: "srs-a", courses: 3 })),
    ).toEqual({ series: [], courses: [] });
  });

  it("文字列でない要素は捨てる", () => {
    expect(
      parseTreeCollapseCookie(
        JSON.stringify({ series: ["srs-a", 42, null], courses: [] }),
      ),
    ).toEqual({ series: ["srs-a"], courses: [] });
  });
});

describe("allCollapsed", () => {
  it("全シリーズ・全コースの ID を返す（記憶が無いときの初期状態）", () => {
    expect(allCollapsed(series)).toEqual({
      series: ["srs-a", "srs-b"],
      courses: ["crs-a1", "crs-b1"],
    });
  });

  it("空のコンテンツでは空を返す", () => {
    expect(allCollapsed([])).toEqual({ series: [], courses: [] });
  });
});

describe("pruneTreeCollapse", () => {
  it("実在しないシリーズ・コースの ID を捨てる", () => {
    expect(
      pruneTreeCollapse(
        { series: ["srs-b", "srs-gone"], courses: ["crs-a1", "crs-gone"] },
        series,
      ),
    ).toEqual({ series: ["srs-b"], courses: ["crs-a1"] });
  });
});

describe("serializeTreeCollapseCookie は選択の祖先を除く", () => {
  it("選択中のシリーズ・コースは書かれない", () => {
    const value = serializeTreeCollapseCookie(
      new Set(["srs-a", "srs-b"]),
      new Set(["crs-a1", "crs-b1"]),
      { seriesId: "srs-a", courseId: "crs-a1" },
    );
    expect(parseTreeCollapseCookie(value)).toEqual({
      series: ["srs-b"],
      courses: ["crs-b1"],
    });
  });

  it("選択が無ければ全部書かれる", () => {
    const value = serializeTreeCollapseCookie(
      new Set(["srs-a"]),
      new Set(["crs-a1"]),
      NO_SELECTION,
    );
    expect(parseTreeCollapseCookie(value)).toEqual({
      series: ["srs-a"],
      courses: ["crs-a1"],
    });
  });
});

describe("4KB の保険", () => {
  it("上限を超えたら courses を捨てて series だけ書く", () => {
    const manyCourses = new Set(
      Array.from({ length: 400 }, (_, i) => `crs-${String(i).padStart(6, "0")}`),
    );
    const value = serializeTreeCollapseCookie(
      new Set(["srs-a"]),
      manyCourses,
      NO_SELECTION,
    );
    expect(value.length).toBeLessThan(4000);
    expect(parseTreeCollapseCookie(value)).toEqual({
      series: ["srs-a"],
      courses: [],
    });
  });
});

describe("writeTreeCollapseCookie", () => {
  it("document.cookie に書き、読み戻せる", () => {
    const value = serializeTreeCollapseCookie(
      new Set(["srs-b"]),
      new Set(),
      NO_SELECTION,
    );
    writeTreeCollapseCookie(value);
    expect(readTreeCollapseCookieFromDocument()).toBe(value);
    expect(parseTreeCollapseCookie(readTreeCollapseCookieFromDocument())).toEqual(
      { series: ["srs-b"], courses: [] },
    );
  });
});
