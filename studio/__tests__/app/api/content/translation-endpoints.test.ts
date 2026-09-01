import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getLessonEn } from "@/app/api/content/lesson-en/route";
import { POST as saveLesson } from "@/app/api/content/save-lesson/route";
import { GET as getStatus } from "@/app/api/content/translation-status/route";
import { POST as saveCourse } from "@/app/api/content/save-course/route";
import {
  computeBodySourceHash,
  computeMetaSourceHash,
  formatSourceHashComment,
} from "@/lib/translation/freshness";

describe("翻訳まわりのコンテンツ API", () => {
  const roots: string[] = [];
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    cwdSpy?.mockRestore();
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
    roots.length = 0;
  });

  // ⚠ cwd 偽装を忘れると実 contents/ を汚染する。すべてのテストで最初に setup() を呼ぶこと
  function setup(): { root: string; lessonDir: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "translation-ep-"));
    roots.push(root);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));
    const lessonDir = path.join(root, "contents", "S", "C", "L");
    fs.mkdirSync(lessonDir, { recursive: true });
    fs.writeFileSync(path.join(lessonDir, "contents.md"), "# 見出し\n", "utf-8");
    fs.writeFileSync(
      path.join(lessonDir, ".meta.json"),
      JSON.stringify({ description: "説明" }),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(root, "contents", "S", "C", ".meta.json"),
      JSON.stringify({ target: "初心者" }),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(root, "contents", ".meta.json"),
      JSON.stringify({ name: "サイト名" }),
      "utf-8",
    );
    return { root, lessonDir };
  }

  function jsonRequest(url: string, method: string, body: unknown): Request {
    return new Request(`http://localhost${url}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const lessonQuery = "series=S&course=C&lesson=L";

  it("lesson-en: 不在は exists=false、ハッシュ行は body から剥がされる", async () => {
    const { lessonDir } = setup();
    const res1 = await getLessonEn(
      new Request(`http://localhost/api/content/lesson-en?${lessonQuery}`),
    );
    expect(await res1.json()).toEqual({ exists: false, body: "", sourceHash: null });

    const hash = computeBodySourceHash("# 見出し\n");
    fs.writeFileSync(
      path.join(lessonDir, "contents.en.md"),
      `${formatSourceHashComment(hash)}\n\n# Heading\n`,
      "utf-8",
    );
    const res2 = await getLessonEn(
      new Request(`http://localhost/api/content/lesson-en?${lessonQuery}`),
    );
    expect(await res2.json()).toEqual({
      exists: true,
      body: "# Heading\n",
      sourceHash: hash,
    });
  });

  it("save-lesson(en): 手動保存は既存ハッシュ行を保持する", async () => {
    const { lessonDir } = setup();
    const hash = computeBodySourceHash("# 見出し\n");
    const enPath = path.join(lessonDir, "contents.en.md");
    fs.writeFileSync(
      enPath,
      `${formatSourceHashComment(hash)}\n\n# Old\n`,
      "utf-8",
    );
    const res = await saveLesson(
      jsonRequest("/api/content/save-lesson", "POST", {
        series: "S",
        course: "C",
        lesson: "L",
        content: "# Edited\n",
        language: "en",
      }),
    );
    expect(res.status).toBe(200);
    expect(fs.readFileSync(enPath, "utf-8")).toBe(
      `${formatSourceHashComment(hash)}\n\n# Edited\n`,
    );
  });

  it("save-lesson(en): 不在＋空は作らない・不在＋非空はハッシュ行なしで作る", async () => {
    const { lessonDir } = setup();
    const enPath = path.join(lessonDir, "contents.en.md");
    await saveLesson(
      jsonRequest("/api/content/save-lesson", "POST", {
        series: "S",
        course: "C",
        lesson: "L",
        content: "   \n",
        language: "en",
      }),
    );
    expect(fs.existsSync(enPath)).toBe(false);

    await saveLesson(
      jsonRequest("/api/content/save-lesson", "POST", {
        series: "S",
        course: "C",
        lesson: "L",
        content: "# Manual translation\n",
        language: "en",
      }),
    );
    expect(fs.readFileSync(enPath, "utf-8")).toBe("# Manual translation\n");
  });

  it("save-lesson(en): sourceHash 付き（翻訳の適用）はハッシュ行を書く", async () => {
    const { lessonDir } = setup();
    const hash = computeBodySourceHash("# 見出し\n");
    const res = await saveLesson(
      jsonRequest("/api/content/save-lesson", "POST", {
        series: "S",
        course: "C",
        lesson: "L",
        content: "# Heading\n",
        language: "en",
        sourceHash: hash,
      }),
    );
    expect(res.status).toBe(200);
    expect(
      fs.readFileSync(path.join(lessonDir, "contents.en.md"), "utf-8"),
    ).toBe(`${formatSourceHashComment(hash)}\n\n# Heading\n`);
  });

  it("save-lesson(ja): 従来経路は language 無しで contents.md へ", async () => {
    const { lessonDir } = setup();
    await saveLesson(
      jsonRequest("/api/content/save-lesson", "POST", {
        series: "S",
        course: "C",
        lesson: "L",
        content: "# 更新\n",
      }),
    );
    expect(fs.readFileSync(path.join(lessonDir, "contents.md"), "utf-8")).toBe(
      "# 更新\n",
    );
    expect(fs.existsSync(path.join(lessonDir, "contents.en.md"))).toBe(false);
  });

  it("translation-status: 3状態と changelog を返す（書込副作用なし)", async () => {
    const { root, lessonDir } = setup();
    fs.writeFileSync(
      path.join(root, "contents", "changelog.md"),
      "# 変更履歴\n\n## 2026-08-21\n\n- x\n",
      "utf-8",
    );
    const before = fs.readFileSync(path.join(lessonDir, ".meta.json"), "utf-8");
    const res = await getStatus(
      new Request(`http://localhost/api/content/translation-status?${lessonQuery}`),
    );
    const data = await res.json();
    expect(data.statuses.lesson).toEqual({
      meta: "untranslated",
      // フォルダ名（name）と description は原文があるので欠落。author は原文が空
      metaMissing: ["name_en", "description_en"],
      body: "untranslated",
      bodyMissing: true,
    });
    expect(data.statuses.course.meta).toBe("untranslated");
    expect(data.statuses.root.meta).toBe("untranslated");
    expect(data.changelog).toBe("untranslated");
    expect(data.changelogMissing).toBe(true);
    // 副作用なし（ローダーの id 書き戻しが走っていない）
    expect(fs.readFileSync(path.join(lessonDir, ".meta.json"), "utf-8")).toBe(before);
  });

  it("translation-status: ハッシュ一致で fresh・原文更新で stale", async () => {
    const { lessonDir } = setup();
    const hash = computeBodySourceHash("# 見出し\n");
    fs.writeFileSync(
      path.join(lessonDir, "contents.en.md"),
      `${formatSourceHashComment(hash)}\n\n# Heading\n`,
      "utf-8",
    );
    const res = await getStatus(
      new Request(`http://localhost/api/content/translation-status?${lessonQuery}`),
    );
    expect((await res.json()).statuses.lesson.body).toBe("fresh");

    fs.writeFileSync(path.join(lessonDir, "contents.md"), "# 進んだ原文\n", "utf-8");
    const res2 = await getStatus(
      new Request(`http://localhost/api/content/translation-status?${lessonQuery}`),
    );
    expect((await res2.json()).statuses.lesson.body).toBe("stale");
  });

  it("save-course: _en フィールドと en_source_hash が保存・削除できる", async () => {
    const { root } = setup();
    const metaPath = path.join(root, "contents", "S", "C", ".meta.json");
    const hash = computeMetaSourceHash({
      level: "course",
      name: "C",
      catch: "",
      description: "",
      target: "初心者",
    });
    const res = await saveCourse(
      jsonRequest("/api/content/save-course", "POST", {
        series: "S",
        course: "C",
        target: "初心者",
        name_en: "Course C",
        target_en: "Beginners",
        en_source_hash: hash,
      }),
    );
    expect(res.status).toBe(200);
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    expect(meta.name_en).toBe("Course C");
    expect(meta.target_en).toBe("Beginners");
    expect(meta.en_source_hash).toBe(hash);

    // 省略＝保全
    await saveCourse(
      jsonRequest("/api/content/save-course", "POST", {
        series: "S",
        course: "C",
        target: "初心者",
      }),
    );
    const kept = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    expect(kept.name_en).toBe("Course C");
    expect(kept.en_source_hash).toBe(hash);

    // 空文字＝削除
    await saveCourse(
      jsonRequest("/api/content/save-course", "POST", {
        series: "S",
        course: "C",
        target: "初心者",
        target_en: "",
      }),
    );
    const deleted = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    expect(deleted).not.toHaveProperty("target_en");
    expect(deleted.name_en).toBe("Course C");
  });
});
