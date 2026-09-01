import { z } from "zod";
import { resolveLessonDirPath } from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";
import { parseEnBody } from "@/lib/translation/freshness";
import { readLessonBodies } from "@/lib/translation/units";

const querySchema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  lesson: z.string().min(1),
});

/**
 * 英語版本文（`contents.en.md`）の読み取り（studio-translation spec）。
 *
 * エディタには原文ハッシュ行を見せない——`body` はハッシュ行除去済み。
 * ハッシュは `sourceHash` として別に返す（保存経路が保持に使う）。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    series: url.searchParams.get("series"),
    course: url.searchParams.get("course"),
    lesson: url.searchParams.get("lesson"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: "series / course / lesson を指定してください" },
      { status: 400 },
    );
  }

  const { series, course, lesson } = parsed.data;
  const lessonDir = resolveLessonDirPath(getProjectRoot(), series, course, lesson);
  if (!lessonDir) {
    return Response.json(
      { error: `レッスンが見つかりません: ${series}/${course}/${lesson}` },
      { status: 404 },
    );
  }

  const { enRaw } = readLessonBodies(lessonDir);
  if (enRaw === null) {
    return Response.json({ exists: false, body: "", sourceHash: null });
  }
  const { sourceHash, body } = parseEnBody(enRaw);
  return Response.json({ exists: true, body, sourceHash });
}
