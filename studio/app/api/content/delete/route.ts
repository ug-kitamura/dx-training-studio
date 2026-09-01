import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
  readMetaJson,
  writeMetaJson,
  resolveLessonFilePath,
} from "@/lib/contents-loader";
import { sanitizeFilename } from "@/lib/content-filename";
import { getProjectRoot } from "@/lib/project-root";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("series"),
    name: z.string().min(1),
  }),
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    name: z.string().min(1),
  }),
  z.object({
    type: z.literal("lesson"),
    series: z.string().min(1),
    course: z.string().min(1),
    name: z.string().min(1),
  }),
]);

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

  if (parsed.data.type === "series") {
    const seriesDir = findSeriesDir(contentsDir, parsed.data.name);
    if (!seriesDir) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    fs.rmSync(seriesDir, { recursive: true, force: true });

    // contents/.meta.json の order から除去
    const meta = readMetaJson(contentsDir);
    if (Array.isArray(meta.order)) {
      meta.order = (meta.order as string[]).filter((n) => n !== parsed.data.name);
      writeMetaJson(contentsDir, meta);
    }
    return Response.json({ ok: true });
  }

  if (parsed.data.type === "course") {
    const seriesDir = findSeriesDir(contentsDir, parsed.data.series);
    if (!seriesDir) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const courseDir = findCourseDir(seriesDir, parsed.data.name);
    if (!courseDir) {
      return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
    }
    fs.rmSync(courseDir, { recursive: true, force: true });

    // series/.meta.json の order から除去
    const meta = readMetaJson(seriesDir);
    if (Array.isArray(meta.order)) {
      meta.order = (meta.order as string[]).filter((n) => n !== parsed.data.name);
      writeMetaJson(seriesDir, meta);
    }
    return Response.json({ ok: true });
  }

  // lesson
  const seriesDir = findSeriesDir(contentsDir, parsed.data.series);
  if (!seriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, parsed.data.course);
  if (!courseDir) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }

  const lessonDirName = sanitizeFilename(parsed.data.name);
  const filePath = resolveLessonFilePath(
    getProjectRoot(),
    parsed.data.series,
    parsed.data.course,
    parsed.data.name,
  );
  if (!filePath) {
    return Response.json({ error: "レッスンフォルダが見つかりません" }, { status: 404 });
  }
  const lessonDir = path.dirname(filePath);
  fs.rmSync(lessonDir, { recursive: true, force: true });

  // course/.meta.json の order から除去
  const courseMeta = readMetaJson(courseDir);
  if (Array.isArray(courseMeta.order)) {
    courseMeta.order = (courseMeta.order as string[]).filter(
      (n) => n !== parsed.data.name && n !== lessonDirName,
    );
    writeMetaJson(courseDir, courseMeta);
  }
  return Response.json({ ok: true });
}
