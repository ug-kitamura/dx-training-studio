import {
  resolveCanonicalBackend,
  storageErrorResponse,
} from "@/lib/image-storage/resolve";
import { getCanonicalList } from "@/lib/image-storage/canonical-cache";
import { getProjectRoot } from "@/lib/project-root";

export async function GET() {
  try {
    const projectRoot = getProjectRoot();
    const backend = resolveCanonicalBackend(projectRoot, "storage");
    // キャッシュが有効ならバックエンド操作なしで確認が済む
    const files = await getCanonicalList(projectRoot, "storage", backend);

    // 一覧（コントロールプレーン）はストアがブロックされていても通る。
    // 「接続 OK」と言うには実際に読めることまで確かめる必要がある。
    const first = files[0];
    if (first) await backend.readCanonical(first.path);

    return Response.json({ ok: true });
  } catch (error) {
    const storageResponse = storageErrorResponse(error);
    if (storageResponse) return storageResponse;
    return Response.json(
      { error: error instanceof Error ? error.message : "ストレージ確認に失敗しました" },
      { status: 500 },
    );
  }
}
