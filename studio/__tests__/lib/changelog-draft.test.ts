import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  baselineMsFromDate,
  buildDraftUserPrompt,
  collectUpdatedLessons,
  DRAFT_MAX_LESSONS,
  listLessons,
  parseDraftResponse,
  todayDateJst,
} from "@/lib/changelog-draft";

// projectRoot を引数で受けるためテストでは cwd 偽装が不要（実 contents を触らない）
const roots: string[] = [];

afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

function makeProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-draft-"));
  roots.push(root);
  return root;
}

function addLesson(
  root: string,
  series: string,
  course: string,
  lesson: string,
  body = "# 本文\n",
  mtime?: Date,
): string {
  const dir = path.join(root, "contents", series, course, lesson);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "contents.md");
  fs.writeFileSync(file, body, "utf-8");
  if (mtime) fs.utimesSync(file, mtime, mtime);
  return file;
}

describe("listLessons", () => {
  it("contents.md を持つフォルダだけを列挙し、_/. 始まりは無視する", () => {
    const root = makeProject();
    addLesson(root, "S1", "C1", "L1");
    addLesson(root, "S1", "C1", "L2");
    fs.mkdirSync(path.join(root, "contents", "S1", "C1", "empty"), {
      recursive: true,
    });
    addLesson(root, "_trash", "C", "L");
    const lessons = listLessons(root);
    expect(lessons.map((l) => l.lesson)).toEqual(["L1", "L2"]);
  });
});

describe("collectUpdatedLessons", () => {
  it("基準日以降に更新されたレッスンだけを新しい順に返す", () => {
    const root = makeProject();
    addLesson(root, "S", "C", "old", "古い\n", new Date("2026-08-01T00:00:00Z"));
    addLesson(root, "S", "C", "new", "新しい\n", new Date("2026-08-20T00:00:00Z"));
    const baseline = baselineMsFromDate("2026-08-10");
    const { lessons, truncated } = collectUpdatedLessons(root, baseline);
    expect(lessons.map((l) => l.lesson)).toEqual(["new"]);
    expect(lessons[0].body).toBe("新しい\n");
    expect(truncated).toBe(false);
  });

  it("基準日が読めなければ全件が候補になる", () => {
    const root = makeProject();
    addLesson(root, "S", "C", "a", "A\n", new Date("2026-01-01T00:00:00Z"));
    const { lessons } = collectUpdatedLessons(root, baselineMsFromDate(null));
    expect(lessons).toHaveLength(1);
  });

  it("上限を超えたら新しい順に切って truncated を立てる", () => {
    const root = makeProject();
    for (let i = 0; i < DRAFT_MAX_LESSONS + 3; i += 1) {
      addLesson(
        root,
        "S",
        "C",
        `l${String(i).padStart(2, "0")}`,
        "x\n",
        new Date(Date.UTC(2026, 7, 1 + (i % 20), i % 24)),
      );
    }
    const { lessons, truncated } = collectUpdatedLessons(root, null);
    expect(lessons).toHaveLength(DRAFT_MAX_LESSONS);
    expect(truncated).toBe(true);
  });
});

describe("baselineMsFromDate", () => {
  it("JST の 0 時として解釈する", () => {
    expect(baselineMsFromDate("2026-08-21")).toBe(
      Date.parse("2026-08-21T00:00:00+09:00"),
    );
  });

  it("不正・null は null", () => {
    expect(baselineMsFromDate(null)).toBeNull();
    expect(baselineMsFromDate("2026/08/21")).toBeNull();
  });
});

describe("parseDraftResponse", () => {
  it("素の JSON を読む", () => {
    const result = parseDraftResponse(
      '{"entry": "## 2026-08-21\\n\\n- 追加", "notes": ["指摘"]}',
    );
    expect(result?.entry).toContain("## 2026-08-21");
    expect(result?.notes).toEqual(["指摘"]);
  });

  it("コードフェンス付きでも読む", () => {
    const result = parseDraftResponse(
      '```json\n{"entry": "## x", "notes": []}\n```',
    );
    expect(result?.entry).toBe("## x");
  });

  it("entry が無い・空・壊れた JSON は null", () => {
    expect(parseDraftResponse('{"notes": []}')).toBeNull();
    expect(parseDraftResponse('{"entry": "  ", "notes": []}')).toBeNull();
    expect(parseDraftResponse("これは JSON ではない")).toBeNull();
  });
});

describe("buildDraftUserPrompt", () => {
  it("材料3点（ツリー・既存履歴・更新レッスン本文）を含む", () => {
    const prompt = buildDraftUserPrompt({
      todayDate: "2026-08-21",
      changelogContent: "# 変更履歴\n\n## 2026-08-14\n\n- 既存\n",
      treeText: "- S / C / L",
      lessons: [
        {
          series: "S",
          course: "C",
          lesson: "L",
          filePath: "/x",
          mtimeMs: 0,
          body: "# レッスン本文",
        },
      ],
      truncated: false,
    });
    expect(prompt).toContain("今日の日付: 2026-08-21");
    expect(prompt).toContain("- S / C / L");
    expect(prompt).toContain("- 既存");
    expect(prompt).toContain("# レッスン本文");
  });
});

describe("todayDateJst", () => {
  it("JST の日付を YYYY-MM-DD で返す（UTC 環境でも前日にならない）", () => {
    // UTC 20日 23:00 = JST 21日 08:00
    expect(todayDateJst(new Date("2026-08-20T23:00:00Z"))).toBe("2026-08-21");
  });
});
