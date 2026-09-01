import { z } from "zod";
import { resolveLessonGitDiff } from "@/lib/lesson-git-diff";
import { getProjectRoot } from "@/lib/project-root";

const requestSchema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  lesson: z.string().min(1),
  /** 差分の対象。省略は日本語正本（後方互換） */
  language: z.enum(["ja", "en"]).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const { series, course, lesson, language } = parsed.data;
  const result = resolveLessonGitDiff(
    getProjectRoot(),
    series,
    course,
    lesson,
    language ?? "ja",
  );

  if ("error" in result) {
    return Response.json(
      {
        error: result.error,
        diff: "",
        headSource: "empty" as const,
        path: "",
      },
      { status: 503 },
    );
  }

  return Response.json({
    diff: result.diff,
    headSource: result.headSource,
    path: result.path,
  });
}
