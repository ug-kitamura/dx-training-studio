import { dbErrorResponse } from "@/lib/context-db/resolve";
import { getContextRepository } from "@/lib/context-resolve";

export async function GET() {
  try {
    const repo = getContextRepository("database");
    await repo.checkConnection();
    return Response.json({ ok: true });
  } catch (error) {
    const dbResponse = dbErrorResponse(error);
    if (dbResponse) return dbResponse;
    return Response.json(
      { error: error instanceof Error ? error.message : "データベース確認に失敗しました" },
      { status: 500 },
    );
  }
}
