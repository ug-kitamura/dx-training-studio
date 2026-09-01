import { z } from "zod";
import { contextTagsSchema } from "@/lib/context-tags-schema";
import { dbErrorResponse } from "@/lib/context-db/resolve";
import {
  getContextRepository,
  parseContextModeFromRequest,
} from "@/lib/context-resolve";

const updateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    body: z.string().trim().min(1).optional(),
    tags: contextTagsSchema.optional(),
    source_url: z.string().trim().min(1).optional(),
    source_last_updated_at: z.string().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "更新フィールドがありません",
  });

function parseId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (id === null) {
      return Response.json({ error: "ID が不正です" }, { status: 400 });
    }

    const repo = getContextRepository(parseContextModeFromRequest(_req));
    const item = await repo.getItem(id);
    if (!item) {
      return Response.json({ error: "アイテムが見つかりません" }, { status: 404 });
    }
    return Response.json({ item });
  } catch (error) {
    const dbResponse = dbErrorResponse(error);
    if (dbResponse) return dbResponse;
    return Response.json(
      { error: error instanceof Error ? error.message : "取得に失敗しました" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (id === null) {
      return Response.json({ error: "ID が不正です" }, { status: 400 });
    }

    let parsed: z.infer<typeof updateSchema>;
    try {
      const json: unknown = await req.json();
      parsed = updateSchema.parse(json);
    } catch {
      return Response.json({ error: "リクエストが不正です" }, { status: 400 });
    }

    const repo = getContextRepository(parseContextModeFromRequest(req));
    const item = await repo.updateItem(id, parsed);
    if (!item) {
      return Response.json({ error: "アイテムが見つかりません" }, { status: 404 });
    }
    return Response.json({ item });
  } catch (error) {
    const dbResponse = dbErrorResponse(error);
    if (dbResponse) return dbResponse;
    return Response.json(
      { error: error instanceof Error ? error.message : "更新に失敗しました" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (id === null) {
      return Response.json({ error: "ID が不正です" }, { status: 400 });
    }

    const repo = getContextRepository(parseContextModeFromRequest(_req));
    const deleted = await repo.deleteItem(id);
    if (!deleted) {
      return Response.json({ error: "アイテムが見つかりません" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    const dbResponse = dbErrorResponse(error);
    if (dbResponse) return dbResponse;
    return Response.json(
      { error: error instanceof Error ? error.message : "削除に失敗しました" },
      { status: 500 },
    );
  }
}
