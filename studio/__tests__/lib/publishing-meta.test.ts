import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadContentsFolder,
  loadContentsMeta,
  readMetaJson,
} from "@/lib/contents-loader";
import {
  courseMetaSchema,
  seriesMetaSchema,
  contentsMetaSchema,
  lessonMetaFileSchema,
  slugSchema,
} from "@/lib/schema";
import { applyLessonMetaPatch } from "@/lib/lesson-meta";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

function writeJson(filePath: string, data: unknown) {
  writeFile(filePath, JSON.stringify(data, null, 2));
}

const LESSON_META_WITH_PUBLISHING = {
  id: "lsn-lesson-c-a1b2c3",
  slug: "lesson-c",
  status: "done",
  description: "概要",
  tags: ["git"],
  estimated_minutes: 15,
  author: "Kitamura",
};

describe("slug スキーマ", () => {
  it("小文字英数とハイフンの slug を受理する", () => {
    expect(slugSchema.safeParse("git-basics").success).toBe(true);
    expect(slugSchema.safeParse("l01").success).toBe(true);
  });

  it("ASCII 外・大文字・記号を含む slug を拒否する", () => {
    expect(slugSchema.safeParse("Git基礎").success).toBe(false);
    expect(slugSchema.safeParse("Git-Basics").success).toBe(false);
    expect(slugSchema.safeParse("git_basics").success).toBe(false);
    expect(slugSchema.safeParse("-git").success).toBe(false);
  });
});

describe(".meta.json スキーマの公開サイト向けフィールド", () => {
  it("シリーズは slug / description / catch / cover / _en を受理する", () => {
    const parsed = seriesMetaSchema.parse({
      id: "srs-git-klejoi",
      order: ["コースA"],
      slug: "git-basics",
      description: "説明",
      catch: "キャッチ",
      cover: "cover-git-basics.png",
      name_en: "Git Basics",
      description_en: "Description",
      catch_en: "Catch",
    });
    expect(parsed.slug).toBe("git-basics");
    expect(parsed.cover).toBe("cover-git-basics.png");
    expect(parsed.name_en).toBe("Git Basics");
  });

  it("コースは cover を持たない", () => {
    const parsed = courseMetaSchema.parse({
      order: [],
      slug: "git-concepts",
      catch: "キャッチ",
      cover: "cover.png",
    });
    expect(parsed).not.toHaveProperty("cover");
  });

  it("全体メタは description / description_en を受理する", () => {
    const parsed = contentsMetaSchema.parse({
      order: ["シリーズA"],
      description: "全体の説明",
    });
    expect(parsed.description).toBe("全体の説明");
  });

  it("公開サイト向けフィールドが無い既存メタをそのまま受理する", () => {
    expect(
      seriesMetaSchema.parse({ id: "srs-x", order: [] }).slug,
    ).toBeUndefined();
    expect(
      courseMetaSchema.parse({ order: [], target: "全員" }).catch,
    ).toBeUndefined();
    expect(contentsMetaSchema.parse({ order: [] }).description).toBeUndefined();
  });

  it("不正な slug を持つメタを拒否する", () => {
    expect(
      seriesMetaSchema.safeParse({ order: [], slug: "Git基礎" }).success,
    ).toBe(false);
  });
});

describe("レッスン .meta.json スキーマ", () => {
  it("slug / id / author_en を受理する", () => {
    const parsed = lessonMetaFileSchema.parse({
      ...LESSON_META_WITH_PUBLISHING,
      author_en: "Kitamura",
    });
    expect(parsed.slug).toBe("lesson-c");
    expect(parsed.id).toBe("lsn-lesson-c-a1b2c3");
    expect(parsed.author_en).toBe("Kitamura");
  });

  it("名前フィールド（series / course / lesson）を拒否する", () => {
    expect(
      lessonMetaFileSchema.safeParse({ lesson: "レッスンC" }).success,
    ).toBe(false);
    expect(lessonMetaFileSchema.safeParse({ series: "S" }).success).toBe(false);
  });

  it("未知キー（order 等）を拒否する", () => {
    expect(lessonMetaFileSchema.safeParse({ order: [] }).success).toBe(false);
  });

  it("空オブジェクトを受理する（全フィールド任意）", () => {
    expect(lessonMetaFileSchema.safeParse({}).success).toBe(true);
  });
});

describe("レッスン編集経路で slug / id が消えない", () => {
  const baseLesson = {
    id: "lesson-シリーズA-コースB-レッスンC",
    stableId: "lsn-lesson-c-a1b2c3",
    slug: "lesson-c",
    series: "シリーズA",
    course: "コースB",
    lesson: "レッスンC",
    status: "done" as const,
    description: "概要",
    tags: ["git"],
    estimated_minutes: 15,
    author: "Kitamura",
    content: "# レッスンC\n",
  };

  it("メタ編集（applyLessonMetaPatch）で保持される", () => {
    const patched = applyLessonMetaPatch(baseLesson, { status: "in_progress" });
    expect(patched.slug).toBe("lesson-c");
    expect(patched.stableId).toBe("lsn-lesson-c-a1b2c3");
    expect(patched.content).toBe("# レッスンC\n");
  });
});

describe("loadContentsFolder の公開サイト向けフィールド", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "publishing-meta-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function setupContents(lessonMeta: Record<string, unknown> | null) {
    const contentsDir = path.join(tmpDir, "contents");
    writeJson(path.join(contentsDir, ".meta.json"), {
      order: ["シリーズA"],
      description: "全体の説明",
    });
    writeJson(path.join(contentsDir, "シリーズA", ".meta.json"), {
      id: "srs-a-111111",
      order: ["コースB"],
      slug: "series-a",
      description: "シリーズの説明",
      catch: "シリーズのキャッチ",
      cover: "cover-a.png",
    });
    writeJson(path.join(contentsDir, "シリーズA", "コースB", ".meta.json"), {
      id: "crs-b-222222",
      order: ["レッスンC"],
      target: "全員",
      slug: "course-b",
      description: "コースの説明",
      catch: "コースのキャッチ",
    });
    writeFile(
      path.join(
        contentsDir,
        "シリーズA",
        "コースB",
        "レッスンC",
        LESSON_CONTENTS_FILENAME,
      ),
      "# レッスンC\n",
    );
    if (lessonMeta) {
      writeJson(
        path.join(contentsDir, "シリーズA", "コースB", "レッスンC", ".meta.json"),
        lessonMeta,
      );
    }
    return contentsDir;
  }

  it("シリーズ・コース・レッスンのフィールドを読み込む", () => {
    setupContents(LESSON_META_WITH_PUBLISHING);
    const [series] = loadContentsFolder(tmpDir);

    expect(series.slug).toBe("series-a");
    expect(series.description).toBe("シリーズの説明");
    expect(series.catch).toBe("シリーズのキャッチ");
    expect(series.cover).toBe("cover-a.png");

    const course = series.courses[0];
    expect(course.slug).toBe("course-b");
    expect(course.catch).toBe("コースのキャッチ");
    expect(course).not.toHaveProperty("cover");

    const lesson = course.lessons[0];
    expect(lesson.slug).toBe("lesson-c");
    expect(lesson.stableId).toBe("lsn-lesson-c-a1b2c3");
    // 実行時キーはパス由来のまま（既存の参照が壊れない）
    expect(lesson.id).toBe("lesson-シリーズA-コースB-レッスンC");
  });

  it("全体メタの description を読み込む", () => {
    setupContents(LESSON_META_WITH_PUBLISHING);
    expect(loadContentsMeta(tmpDir).description).toBe("全体の説明");
  });

  it("id 自動採番の書き戻しでレッスンの公開サイト向けフィールドが消えない", () => {
    const contentsDir = setupContents({
      slug: "lesson-c",
      status: "done",
      description: "概要",
      tags: ["git"],
      estimated_minutes: 15,
      author: "Kitamura",
    });

    const lesson = loadContentsFolder(tmpDir)[0].courses[0].lessons[0];
    expect(lesson.stableId).toMatch(/^lsn-/);

    const meta = readMetaJson(
      path.join(contentsDir, "シリーズA", "コースB", "レッスンC"),
    );
    expect(meta.id).toBe(lesson.stableId);
    expect(meta.slug).toBe("lesson-c");
    expect(meta.description).toBe("概要");
    expect(meta.author).toBe("Kitamura");
  });

  it("id 自動採番の書き戻しでシリーズの公開サイト向けフィールドが消えない", () => {
    const contentsDir = setupContents(LESSON_META_WITH_PUBLISHING);
    // id を持たないシリーズ meta にして loader の自動採番を通す
    writeJson(path.join(contentsDir, "シリーズA", ".meta.json"), {
      order: ["コースB"],
      slug: "series-a",
      catch: "シリーズのキャッチ",
      cover: "cover-a.png",
    });

    loadContentsFolder(tmpDir);

    const meta = readMetaJson(path.join(contentsDir, "シリーズA"));
    expect(meta.id).toMatch(/^srs-/);
    expect(meta.slug).toBe("series-a");
    expect(meta.catch).toBe("シリーズのキャッチ");
    expect(meta.cover).toBe("cover-a.png");
  });
});
