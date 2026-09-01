import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";
import { POST } from "@/app/api/content/save-lesson/route";

describe("POST /api/content/save-lesson", () => {
  const roots: string[] = [];
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    cwdSpy?.mockRestore();
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  function setupLesson(root: string, content = "# body\n"): string {
    const rel = path.join(
      "contents",
      "Series",
      "Course",
      "Lesson",
      LESSON_CONTENTS_FILENAME,
    );
    const absolute = path.join(root, rel);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, "utf-8");
    return absolute;
  }

  it("updates an existing lesson file", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "save-lesson-"));
    roots.push(root);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));
    const file = setupLesson(root, "# before\n");

    const res = await POST(
      new Request("http://localhost/api/content/save-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: "Series",
          course: "Course",
          lesson: "Lesson",
          content: "# after\n",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(fs.readFileSync(file, "utf-8")).toBe("# after\n");
  });

  it("returns 404 when the lesson folder does not exist", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "save-lesson-"));
    roots.push(root);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));
    fs.mkdirSync(path.join(root, "contents"), { recursive: true });

    const res = await POST(
      new Request("http://localhost/api/content/save-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: "Series",
          course: "Course",
          lesson: "Missing",
          content: "# ghost\n",
        }),
      }),
    );

    expect(res.status).toBe(404);
    expect(fs.existsSync(path.join(root, "contents", "Series"))).toBe(false);
  });
});
