import { z } from "zod";
import { promoteStagingToCanonical } from "@/lib/image-store";
import { invalidateCanonicalCache } from "@/lib/image-storage/canonical-cache";
import {
  parseImageStorageMode,
  resolveCanonicalBackend,
  storageErrorResponse,
} from "@/lib/image-storage/resolve";
import { imageStorageModeSchema } from "@/lib/schema";
import { getProjectRoot } from "@/lib/project-root";

const requestSchema = z.object({
  stagingPath: z.string().min(1),
  storageMode: imageStorageModeSchema.default("storage"),
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

  try {
    const storageMode = parseImageStorageMode(parsed.data.storageMode);
    const backend = resolveCanonicalBackend(getProjectRoot(), storageMode);
    const file = await promoteStagingToCanonical(
      getProjectRoot(),
      parsed.data.stagingPath,
      backend,
    );
    // 一覧キャッシュの TTL 残に関わらず、promote 直後の一覧に必ず現れるようにする
    invalidateCanonicalCache(storageMode);
    return Response.json({ file });
  } catch (error) {
    const storageResponse = storageErrorResponse(error);
    if (storageResponse) return storageResponse;

    const message = error instanceof Error ? error.message : "promote に失敗しました";
    const status = message.includes("not found") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
