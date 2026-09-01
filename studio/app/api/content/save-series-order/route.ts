import { z } from "zod";
import { getContentsDir, readMetaJson, writeMetaJson } from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";

const schema = z.object({
  order: z.array(z.string()),
});

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
  const meta = readMetaJson(contentsDir);
  writeMetaJson(contentsDir, { ...meta, order: parsed.data.order });

  return Response.json({ ok: true });
}
