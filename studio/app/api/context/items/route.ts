import { z } from "zod";
import { contextTagsSchema } from "@/lib/context-tags-schema";
import { dbErrorResponse } from "@/lib/context-db/resolve";
import {
  getContextRepository,
  parseContextModeFromRequest,
} from "@/lib/context-resolve";

const createSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  tags: contextTagsSchema,
  source_url: z.string().trim().min(1),
  source_last_updated_at: z.string().nullable().optional(),
});

function parseTagsParam(raw: string | null): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const tags = raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tags = parseTagsParam(searchParams.get("tags"));
    const contextMode = parseContextModeFromRequest(req);
    const repo = getContextRepository(contextMode);
    const items = await repo.listItems(tags);
    return Response.json({ items });
  } catch (error) {
    const dbResponse = dbErrorResponse(error);
    if (dbResponse) return dbResponse;
    return Response.json(
      { error: error instanceof Error ? error.message : "一覧取得に失敗しました" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    let parsed: z.infer<typeof createSchema>;
    try {
      const json: unknown = await req.json();
      parsed = createSchema.parse(json);
    } catch {
      return Response.json({ error: "リクエストが不正です" }, { status: 400 });
    }

    const repo = getContextRepository(parseContextModeFromRequest(req));
    const item = await repo.createItem(parsed);
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    const dbResponse = dbErrorResponse(error);
    if (dbResponse) return dbResponse;
    return Response.json(
      { error: error instanceof Error ? error.message : "作成に失敗しました" },
      { status: 500 },
    );
  }
}
