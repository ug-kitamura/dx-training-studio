import { describe, expect, it } from "vitest";
import {
  applyLessonMetaPatch,
  estimateDraftMinutes,
  inferDraftTagsFromText,
  lessonMetaToFile,
  migrateLegacyStatus,
  normalizeDraftForLesson,
  parseLessonMetaFile,
  resolveDraftTags,
} from "@/lib/lesson-meta";
import type { Lesson } from "@/lib/schema";

const baseLesson: Lesson = {
  id: "lesson-S-C-最初のコミット",
  series: "Git完全マスターシリーズ",
  course: "Git環境構築コース",
  lesson: "最初のコミット",
  status: "open",
  description: "説明",
  tags: [],
  estimated_minutes: 0,
  author: "",
  content: "# 最初のコミット\n",
};

describe("normalizeDraftForLesson", () => {
  it("returns the draft body untouched and keeps status/description out of the patch", () => {
    const draft = "# タイトル\n\n本文です。\n";
    const { body, metaPatch } = normalizeDraftForLesson(draft, baseLesson, {
      availableTags: [],
    });
    expect(body).toBe(draft);
    expect(metaPatch.status).toBeUndefined();
    expect(metaPatch.description).toBeUndefined();
  });

  it("infers tags when lesson tags are empty", () => {
    const draft = "# 最初のコミット\n\ngit add と git commit の流れを学びます。\n";
    const { metaPatch } = normalizeDraftForLesson(draft, baseLesson, {
      availableTags: ["git", "setup", "python"],
      contextItemTags: ["branch-strategy"],
    });
    expect(metaPatch.tags).toEqual(["git"]);
  });

  it("keeps existing tags (no patch)", () => {
    const lesson = { ...baseLesson, tags: ["setup"] };
    const { metaPatch } = normalizeDraftForLesson("# t\n\ngit\n", lesson, {
      availableTags: ["git"],
    });
    expect(metaPatch.tags).toBeUndefined();
  });

  it("estimates minutes when lesson meta is zero", () => {
    const body = `# 最初のコミット\n\n${"手順\n".repeat(40)}`;
    const { metaPatch } = normalizeDraftForLesson(body, baseLesson, {});
    expect(metaPatch.estimated_minutes).toBeGreaterThan(0);
  });

  it("keeps existing minutes (no patch)", () => {
    const lesson = { ...baseLesson, estimated_minutes: 25 };
    const { metaPatch } = normalizeDraftForLesson("# t\n\n本文\n", lesson, {});
    expect(metaPatch.estimated_minutes).toBeUndefined();
  });
});

describe("applyLessonMetaPatch", () => {
  it("updates meta fields without touching content", () => {
    const updated = applyLessonMetaPatch(baseLesson, {
      status: "done",
      description: "新説明",
      tags: ["git"],
    });
    expect(updated.status).toBe("done");
    expect(updated.description).toBe("新説明");
    expect(updated.tags).toEqual(["git"]);
    expect(updated.content).toBe(baseLesson.content);
    expect(updated.series).toBe(baseLesson.series);
  });

  it("clears slug with empty string", () => {
    const withSlug = { ...baseLesson, slug: "first-commit" };
    const updated = applyLessonMetaPatch(withSlug, { slug: "" });
    expect(updated.slug).toBeUndefined();
  });
});

describe("migrateLegacyStatus", () => {
  it("maps draft to open", () => {
    expect(migrateLegacyStatus("draft")).toBe("open");
  });

  it("keeps valid statuses and defaults unknown to open", () => {
    expect(migrateLegacyStatus("done")).toBe("done");
    expect(migrateLegacyStatus("unknown")).toBe("open");
  });
});

describe("parseLessonMetaFile / lessonMetaToFile", () => {
  it("reads lesson meta from raw json", () => {
    const meta = parseLessonMetaFile(
      {
        id: "lsn-a-b",
        slug: "a",
        status: "in_progress",
        description: "d",
        tags: ["git"],
        estimated_minutes: 15,
        author: "北村",
        author_en: "Kitamura",
      },
      "レッスンA",
    );
    expect(meta.lesson).toBe("レッスンA");
    expect(meta.id).toBe("lsn-a-b");
    expect(meta.author_en).toBe("Kitamura");
  });

  it("does not serialize name fields nor empty optionals", () => {
    const file = lessonMetaToFile(
      parseLessonMetaFile({ status: "open" }, "レッスンA"),
    );
    expect(file).not.toHaveProperty("lesson");
    expect(file).not.toHaveProperty("series");
    expect(file).not.toHaveProperty("course");
    expect(file).not.toHaveProperty("slug");
    expect(file).not.toHaveProperty("id");
    expect(file).not.toHaveProperty("author_en");
    expect(file).toHaveProperty("status", "open");
  });
});

describe("resolveDraftTags", () => {
  it("prefers valid parsed tags", () => {
    expect(
      resolveDraftTags({
        parsedTags: ["git", "commit"],
        fallbackTags: [],
        availableTags: [],
        contextItemTags: [],
        bodyText: "",
      }),
    ).toEqual(["git", "commit"]);
  });

  it("uses context item tags when parsed tags are empty", () => {
    expect(
      resolveDraftTags({
        parsedTags: [],
        fallbackTags: [],
        availableTags: ["git"],
        contextItemTags: ["branch-strategy", "git"],
        bodyText: "",
      }),
    ).toEqual(["branch-strategy", "git"]);
  });
});

describe("inferDraftTagsFromText", () => {
  it("matches available tags in body text", () => {
    expect(
      inferDraftTagsFromText("git commit の手順", ["git", "python"]),
    ).toEqual(["git"]);
  });
});

describe("estimateDraftMinutes", () => {
  it("returns 5 for minimal body (workspace minimum lesson length)", () => {
    expect(estimateDraftMinutes("# Title\n\nSome content.")).toBe(5);
  });

  it("scales up for longer structured content", () => {
    const body = [
      "# Title",
      "",
      ...Array.from({ length: 20 }, (_, i) => `- Step ${i + 1}`),
      "",
      "```bash",
      "git status",
      "```",
    ].join("\n");
    expect(estimateDraftMinutes(body)).toBeGreaterThanOrEqual(10);
  });
});
