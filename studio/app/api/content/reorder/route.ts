import { z } from "zod";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
  readMetaJson,
  writeMetaJson,
} from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    /** 新しい順序のコース表示名リスト */
    newOrder: z.array(z.string()),
  }),
  z.object({
    type: z.literal("lesson"),
    series: z.string().min(1),
    course: z.string().min(1),
    /** 新しい順序のレッスン表示名リスト */
    newOrder: z.array(z.string()),
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

  if (parsed.data.type === "course") {
    const seriesDir = findSeriesDir(contentsDir, parsed.data.series);
    if (!seriesDir) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const meta = readMetaJson(seriesDir);
    writeMetaJson(seriesDir, { ...meta, order: parsed.data.newOrder });
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
  const meta = readMetaJson(courseDir);
  writeMetaJson(courseDir, { ...meta, order: parsed.data.newOrder });

  return Response.json({ ok: true });
}
