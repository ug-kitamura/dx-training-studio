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
import { generateCourseId, generateSeriesId, readStoredId } from "@/lib/content-ids";
import { defaultLessonBody } from "@/lib/lesson-meta";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";
import { getProjectRoot } from "@/lib/project-root";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("series"),
    name: z.string().min(1),
    id: z.string().optional(),
  }),
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    name: z.string().min(1),
    id: z.string().optional(),
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
    fs.mkdirSync(contentsDir, { recursive: true });
    const dirName = sanitizeFilename(parsed.data.name);
    fs.mkdirSync(path.join(contentsDir, dirName), { recursive: true });

    const seriesId = parsed.data.id ?? generateSeriesId(dirName);
    writeMetaJson(path.join(contentsDir, dirName), { id: seriesId, order: [] });

    // contents/.meta.json の order 末尾に追記
    const meta = readMetaJson(contentsDir);
    const order = Array.isArray(meta.order) ? (meta.order as string[]) : [];
    writeMetaJson(contentsDir, { ...meta, order: [...order, dirName] });

    return Response.json({ ok: true, dirName, id: seriesId });
  }

  if (parsed.data.type === "course") {
    const seriesDir = findSeriesDir(contentsDir, parsed.data.series);
    if (!seriesDir) {
      return Response.json({ error: `シリーズフォルダが見つかりません` }, { status: 404 });
    }
    const courseDirName = sanitizeFilename(parsed.data.name);
    const courseDir = path.join(seriesDir, courseDirName);
    fs.mkdirSync(courseDir, { recursive: true });
    const courseId = parsed.data.id ?? generateCourseId(courseDirName);
    writeMetaJson(courseDir, {
      id: courseId,
      order: [],
      target: "",
      cross_series_prev: [],
      cross_series_next: [],
    });

    const seriesMeta = readMetaJson(seriesDir);
    const courseOrder = Array.isArray(seriesMeta.order) ? (seriesMeta.order as string[]) : [];
    writeMetaJson(seriesDir, {
      ...seriesMeta,
      id: readStoredId(seriesMeta) ?? generateSeriesId(parsed.data.series),
      order: [...courseOrder, courseDirName],
    });

    return Response.json({ ok: true, dirName: courseDirName, id: courseId });
  }

  // lesson
  const seriesDir = findSeriesDir(contentsDir, parsed.data.series);
  if (!seriesDir) {
    return Response.json({ error: `シリーズフォルダが見つかりません` }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, parsed.data.course);
  if (!courseDir) {
    return Response.json({ error: `コースフォルダが見つかりません` }, { status: 404 });
  }

  const lessonDirName = sanitizeFilename(parsed.data.name);
  const lessonDir = path.join(courseDir, lessonDirName);
  fs.mkdirSync(lessonDir, { recursive: true });
  // 本文は frontmatter なしのテンプレート。`.meta.json` はローダーの自己修復
  //（既定値＋id 採番）に委ねる
  fs.writeFileSync(
    path.join(lessonDir, LESSON_CONTENTS_FILENAME),
    defaultLessonBody(parsed.data.name),
    "utf-8",
  );

  // course/.meta.json の order 末尾に追記
  const courseMeta = readMetaJson(courseDir);
  const lessonOrder = Array.isArray(courseMeta.order) ? (courseMeta.order as string[]) : [];
  writeMetaJson(courseDir, { ...courseMeta, order: [...lessonOrder, lessonDirName] });

  return Response.json({ ok: true, dirName: lessonDirName });
}
