import { z } from "zod";
import { resolveToolConfirmDecision } from "@/lib/agent/tools/tool-confirm-registry";

const bodySchema = z.object({
  toolUseId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  /** web-search-manual の承認時にユーザーが貼り付けた検索結果＋ソース URL */
  manualSearchText: z.string().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const resolved = resolveToolConfirmDecision(
    parsed.data.toolUseId,
    parsed.data.decision,
    parsed.data.manualSearchText,
  );
  if (!resolved) {
    return Response.json(
      {
        error:
          "対象の確認要求が見つかりません（タイムアウト済みの可能性があります）",
      },
      { status: 404 },
    );
  }

  return Response.json({ ok: true });
}
