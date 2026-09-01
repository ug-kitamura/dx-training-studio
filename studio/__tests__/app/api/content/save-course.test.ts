import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/content/save-course/route";

describe("POST /api/content/save-course", () => {
  const roots: string[] = [];
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    cwdSpy?.mockRestore();
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  /** contents/Series/Course/.meta.json を用意して、そのパスを返す */
  function setupCourse(meta: Record<string, unknown>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "save-course-"));
    roots.push(root);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));
    const courseDir = path.join(root, "contents", "Series", "Course");
    fs.mkdirSync(courseDir, { recursive: true });
    const metaPath = path.join(courseDir, ".meta.json");
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    return metaPath;
  }

  async function post(body: Record<string, unknown>) {
    return POST(
      new Request("http://localhost/api/content/save-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series: "Series", course: "Course", ...body }),
      }),
    );
  }

  function readMeta(metaPath: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Record<
      string,
      unknown
    >;
  }

  it("style を書き込む", async () => {
    const metaPath = setupCourse({ order: ["L"] });

    const res = await post({ target: "初心者", style: "hands-on" });

    expect(res.status).toBe(200);
    expect(readMeta(metaPath).style).toBe("hands-on");
  });

  it("style が空文字なら既存キーを除去する", async () => {
    const metaPath = setupCourse({ order: ["L"], style: "lecture" });

    const res = await post({ target: "初心者", style: "" });

    expect(res.status).toBe(200);
    expect(readMeta(metaPath)).not.toHaveProperty("style");
  });

  it("style を省略しても既存キーを除去する", async () => {
    const metaPath = setupCourse({ order: ["L"], style: "lecture" });

    const res = await post({ target: "初心者" });

    expect(res.status).toBe(200);
    expect(readMeta(metaPath)).not.toHaveProperty("style");
  });

  it("slug / catch / description を書き込み、省略時は保全する", async () => {
    const metaPath = setupCourse({ order: ["L"], slug: "keep-me" });

    // 省略 → 保全
    const res1 = await post({ target: "初心者" });
    expect(res1.status).toBe(200);
    expect(readMeta(metaPath).slug).toBe("keep-me");

    // 値 → 設定
    const res2 = await post({
      target: "初心者",
      slug: "intro",
      catch: "地図を手に入れる",
      description: "説明",
    });
    expect(res2.status).toBe(200);
    const meta = readMeta(metaPath);
    expect(meta.slug).toBe("intro");
    expect(meta.catch).toBe("地図を手に入れる");
    expect(meta.description).toBe("説明");

    // 空文字 → 削除
    const res3 = await post({ target: "初心者", slug: "", catch: "" });
    expect(res3.status).toBe(200);
    const meta3 = readMeta(metaPath);
    expect(meta3).not.toHaveProperty("slug");
    expect(meta3).not.toHaveProperty("catch");
    expect(meta3.description).toBe("説明");
  });

  it("不正な slug は 400 で拒否する", async () => {
    const metaPath = setupCourse({ order: ["L"], slug: "old" });
    const res = await post({ target: "初心者", slug: "Git基礎" });
    expect(res.status).toBe(400);
    expect(readMeta(metaPath).slug).toBe("old");
  });

  it("語彙外の style は 400 で拒否する", async () => {
    const metaPath = setupCourse({ order: ["L"], style: "lecture" });

    const res = await post({ target: "初心者", style: "seminar" });

    expect(res.status).toBe(400);
    // 既存の値は書き換わらない
    expect(readMeta(metaPath).style).toBe("lecture");
  });

  it("既存の他フィールドは保つ", async () => {
    const metaPath = setupCourse({
      id: "crs-x",
      order: ["L"],
      slug: "course-x",
      style: "self-study",
    });

    const res = await post({ target: "初心者", style: "self-study" });

    expect(res.status).toBe(200);
    const meta = readMeta(metaPath);
    expect(meta.id).toBe("crs-x");
    expect(meta.slug).toBe("course-x");
    expect(meta.order).toEqual(["L"]);
    expect(meta.style).toBe("self-study");
  });
});
