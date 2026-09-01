import { dbErrorResponse } from "@/lib/context-db/resolve";
import {
  getContextRepository,
  parseContextModeFromRequest,
} from "@/lib/context-resolve";

export async function GET(req: Request) {
  try {
    const repo = getContextRepository(parseContextModeFromRequest(req));
    const tags = await repo.listDistinctTags();
    return Response.json({ tags });
  } catch (error) {
    const dbResponse = dbErrorResponse(error);
    if (dbResponse) return dbResponse;
    return Response.json(
      { error: error instanceof Error ? error.message : "タグ一覧取得に失敗しました" },
      { status: 500 },
    );
  }
}
