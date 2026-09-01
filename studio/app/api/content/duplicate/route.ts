import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
  readMetaJson,
  writeMetaJson,
} from "@/lib/contents-loader";
import { sanitizeFilename } from "@/lib/content-filename";
import { getProjectRoot } from "@/lib/project-root";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("series"),
    series: z.string().min(1),
  }),
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    course: z.string().min(1),
    targetSeries: z.string().min(1),
  }),
  z.object({
    type: z.literal("lesson"),
    series: z.string().min(1),
    course: z.string().min(1),
    lesson: z.string().min(1),
    targetSeries: z.string().min(1),
    targetCourse: z.string().min(1),
  }),
]);

/** 「元の名前（コピー）」「（コピー2）」…の順で衝突しない名前を返す */
function dedupeCopyName(parentDir: string, baseName: string): string {
  for (let n = 1; n < 100; n++) {
    const candidate =
      n === 1 ? `${baseName}（コピー）` : `${baseName}（コピー${n}）`;
    if (!fs.existsSync(path.join(parentDir, sanitizeFilename(candidate)))) {
      return candidate;
    }
  }
  throw new Error("コピー名を確保できませんでした");
}

/** メタから id / slug を除去して書き戻す（他フィールドは保持） */
function stripIdAndSlug(dir: string) {
  const meta = readMetaJson(dir);
  if (!("id" in meta) && !("slug" in meta)) return;
  delete meta.id;
  delete meta.slug;
  writeMetaJson(dir, meta);
}

/**
 * 再帰コピー。⚠ `fs.cpSync` を使わないこと——Node v24.14 では宛先パスに
 * 全角文字（「（コピー）」等）が含まれると try/catch も効かずプロセスごと
 * クラッシュする（exit 127）。readdir + copyFileSync の手書き再帰なら安全。
 */
function copyDirRecursive(src: string, dest: string) {
  if (fs.existsSync(dest)) {
    throw new Error(`コピー先が既に存在します: ${dest}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

/** 受け入れ先 .meta.json の order 末尾に名前を追加する */
function appendToOrder(parentDir: string, name: string) {
  const meta = readMetaJson(parentDir);
  const order = Array.isArray(meta.order) ? (meta.order as string[]) : [];
  if (!order.includes(name)) {
    meta.order = [...order, name];
    writeMetaJson(parentDir, meta);
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const contentsDir = getContentsDir(getProjectRoot());
  const data = parsed.data;

  try {
    if (data.type === "series") {
      const srcDir = findSeriesDir(contentsDir, data.series);
      if (!srcDir) {
        return Response.json({ error: "シリーズが見つかりません" }, { status: 404 });
      }
      const copyName = dedupeCopyName(contentsDir, data.series);
      const destDir = path.join(contentsDir, sanitizeFilename(copyName));
      copyDirRecursive(srcDir, destDir);
      stripIdAndSlug(destDir);
      for (const courseEntry of fs.readdirSync(destDir, { withFileTypes: true })) {
        if (!courseEntry.isDirectory()) continue;
        const courseDir = path.join(destDir, courseEntry.name);
        stripIdAndSlug(courseDir);
        for (const lessonEntry of fs.readdirSync(courseDir, {
          withFileTypes: true,
        })) {
          if (!lessonEntry.isDirectory()) continue;
          stripIdAndSlug(path.join(courseDir, lessonEntry.name));
        }
      }
      appendToOrder(contentsDir, copyName);
      return Response.json({ ok: true, name: copyName });
    }

    if (data.type === "course") {
      const srcSeriesDir = findSeriesDir(contentsDir, data.series);
      const srcDir = srcSeriesDir && findCourseDir(srcSeriesDir, data.course);
      const targetSeriesDir = findSeriesDir(contentsDir, data.targetSeries);
      if (!srcDir || !targetSeriesDir) {
        return Response.json({ error: "コースが見つかりません" }, { status: 404 });
      }
      const copyName = dedupeCopyName(targetSeriesDir, data.course);
      const destDir = path.join(targetSeriesDir, sanitizeFilename(copyName));
      copyDirRecursive(srcDir, destDir);
      stripIdAndSlug(destDir);
      for (const lessonEntry of fs.readdirSync(destDir, { withFileTypes: true })) {
        if (!lessonEntry.isDirectory()) continue;
        stripIdAndSlug(path.join(destDir, lessonEntry.name));
      }
      appendToOrder(targetSeriesDir, copyName);
      return Response.json({ ok: true, name: copyName });
    }

    const srcSeriesDir = findSeriesDir(contentsDir, data.series);
    const srcCourseDir = srcSeriesDir && findCourseDir(srcSeriesDir, data.course);
    const srcDir =
      srcCourseDir && path.join(srcCourseDir, sanitizeFilename(data.lesson));
    const targetSeriesDir = findSeriesDir(contentsDir, data.targetSeries);
    const targetCourseDir =
      targetSeriesDir && findCourseDir(targetSeriesDir, data.targetCourse);
    if (!srcDir || !fs.existsSync(srcDir) || !targetCourseDir) {
      return Response.json({ error: "レッスンが見つかりません" }, { status: 404 });
    }
    const copyName = dedupeCopyName(targetCourseDir, data.lesson);
    const destDir = path.join(targetCourseDir, sanitizeFilename(copyName));
    copyDirRecursive(srcDir, destDir);
    stripIdAndSlug(destDir);
    appendToOrder(targetCourseDir, copyName);
    return Response.json({ ok: true, name: copyName });
  } catch (err) {
    return Response.json(
      { error: `複製に失敗しました: ${String(err)}` },
      { status: 500 },
    );
  }
}
