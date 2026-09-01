import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";
import { POST } from "@/app/api/content/save-lesson-meta/route";

describe("POST /api/content/save-lesson-meta", () => {
  const roots: string[] = [];
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    cwdSpy?.mockRestore();
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  function setup(meta?: Record<string, unknown>): {
    root: string;
    metaPath: string;
    contentsPath: string;
  } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "save-lesson-meta-"));
    roots.push(root);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));
    const lessonDir = path.join(root, "contents", "Series", "Course", "Lesson");
    fs.mkdirSync(lessonDir, { recursive: true });
    const contentsPath = path.join(lessonDir, LESSON_CONTENTS_FILENAME);
    fs.writeFileSync(contentsPath, "# body\n", "utf-8");
    const metaPath = path.join(lessonDir, ".meta.json");
    if (meta) {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    }
    return { root, metaPath, contentsPath };
  }

  function post(meta: Record<string, unknown>) {
    return POST(
      new Request("http://localhost/api/content/save-lesson-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: "Series",
          course: "Course",
          lesson: "Lesson",
          meta,
        }),
      }),
    );
  }

  it("writes meta to .meta.json and keeps contents.md untouched", async () => {
    const { metaPath, contentsPath } = setup();
    const res = await post({
      status: "done",
      description: "説明",
      tags: ["git"],
      estimated_minutes: 15,
      author: "北村",
      author_en: "Kitamura",
      slug: "sample",
    });
    expect(res.status).toBe(200);

    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Record<
      string,
      unknown
    >;
    expect(meta.status).toBe("done");
    expect(meta.slug).toBe("sample");
    expect(meta.author_en).toBe("Kitamura");
    expect(fs.readFileSync(contentsPath, "utf-8")).toBe("# body\n");
  });

  it("preserves existing id and unknown-but-allowed fields", async () => {
    const { metaPath } = setup({
      id: "lsn-keep-123456",
      name_en: "Sample Lesson",
      status: "open",
    });
    const res = await post({ status: "in_progress" });
    expect(res.status).toBe(200);

    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Record<
      string,
      unknown
    >;
    expect(meta.id).toBe("lsn-keep-123456");
    expect(meta.name_en).toBe("Sample Lesson");
    expect(meta.status).toBe("in_progress");
  });

  it("clears slug / author_en with empty string", async () => {
    const { metaPath } = setup({ slug: "old", author_en: "Old" });
    const res = await post({ slug: "", author_en: "" });
    expect(res.status).toBe(200);

    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Record<
      string,
      unknown
    >;
    expect(meta).not.toHaveProperty("slug");
    expect(meta).not.toHaveProperty("author_en");
  });

  it("rejects invalid slug", async () => {
    setup();
    const res = await post({ slug: "日本語" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the lesson does not exist", async () => {
    setup();
    const res = await POST(
      new Request("http://localhost/api/content/save-lesson-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: "Series",
          course: "Course",
          lesson: "Nope",
          meta: { status: "done" },
        }),
      }),
    );
    expect(res.status).toBe(404);
  });
});
