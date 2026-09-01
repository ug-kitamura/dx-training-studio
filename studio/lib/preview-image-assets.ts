import { normalizeImageLogicalPath } from "@/lib/image-path";
import { usedImageListUrl } from "@/lib/image-api-client";

/** 正本 + staging の論理パス一覧（プレビュー可用性判定用） */
export async function fetchAvailableImagePaths(): Promise<Set<string>> {
  const responses = await Promise.all([
    fetch(usedImageListUrl()),
    fetch("/api/images/list?scope=staging&source=uploaded"),
    fetch("/api/images/list?scope=staging&source=ai"),
    fetch("/api/images/list?scope=staging&source=web"),
  ]);

  const paths = new Set<string>();
  for (const res of responses) {
    if (!res.ok) continue;
    const data = (await res.json()) as { files?: Array<{ path: string }> };
    for (const file of data.files ?? []) {
      paths.add(normalizeImageLogicalPath(file.path));
    }
  }
  return paths;
}
