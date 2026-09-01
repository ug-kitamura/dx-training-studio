import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
} from "@/lib/contents-loader";
import { sanitizeFilename } from "@/lib/content-filename";
import { getProjectRoot } from "@/lib/project-root";

const schema = z.object({
  series: z.string().min(1).optional(),
  course: z.string().min(1).optional(),
  lesson: z.string().min(1).optional(),
});

/** 対象フォルダを OS のファイルマネージャで開く */
function openInOs(dirPath: string) {
  if (process.platform === "win32") {
    // explorer はパスをそのまま引数に取る
    execFile("explorer", [dirPath]);
  } else if (process.platform === "darwin") {
    execFile("open", [dirPath]);
  } else {
    execFile("xdg-open", [dirPath]);
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
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const contentsDir = getContentsDir(getProjectRoot());
  const { series, course, lesson } = parsed.data;

  let target = contentsDir;
  if (series) {
    const seriesDir = findSeriesDir(contentsDir, series);
    if (!seriesDir) {
      return Response.json({ error: "シリーズが見つかりません" }, { status: 404 });
    }
    target = seriesDir;
    if (course) {
      const courseDir = findCourseDir(seriesDir, course);
      if (!courseDir) {
        return Response.json({ error: "コースが見つかりません" }, { status: 404 });
      }
      target = courseDir;
      if (lesson) {
        const lessonDir = path.join(courseDir, sanitizeFilename(lesson));
        if (!fs.existsSync(lessonDir)) {
          return Response.json(
            { error: "レッスンが見つかりません" },
            { status: 404 },
          );
        }
        target = lessonDir;
      }
    }
  }

  openInOs(target);
  return Response.json({ ok: true });
}
