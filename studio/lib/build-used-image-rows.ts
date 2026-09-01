import type { ImageFileEntry } from "@/lib/image-store";
import { normalizeImageLogicalPath } from "@/lib/image-path";

export type UsedImageRow = {
  path: string;
  name: string;
  source: ImageFileEntry["source"];
  referenceCount: number;
  missing: boolean;
  uploadedAt?: string;
};

/** promote 済み一覧と参照 scan 結果から Used タブ行を構築 */
export function buildUsedImageRows(
  promoted: ImageFileEntry[],
  refCounts: Map<string, number>,
): UsedImageRow[] {
  const promotedPaths = new Set(promoted.map((f) => normalizeImageLogicalPath(f.path)));
  const rows: UsedImageRow[] = promoted.map((file) => {
    const path = normalizeImageLogicalPath(file.path);
    return {
      path,
      name: file.name,
      source: file.source,
      referenceCount: refCounts.get(path) ?? 0,
      missing: false,
      uploadedAt: file.uploadedAt,
    };
  });

  for (const [refPath, count] of refCounts) {
    const path = normalizeImageLogicalPath(refPath);
    if (promotedPaths.has(path)) continue;
    rows.push({
      path,
      name: path.split("/").pop() ?? path,
      source: inferSourceFromPath(path),
      referenceCount: count,
      missing: true,
    });
  }

  return rows.sort((a, b) => {
    if (a.missing !== b.missing) return a.missing ? 1 : -1;
    return a.path.localeCompare(b.path, "ja");
  });
}

function inferSourceFromPath(path: string): UsedImageRow["source"] {
  if (path.startsWith("images/ai/")) return "ai";
  if (path.startsWith("images/web/")) return "web";
  if (path.startsWith("images/uploaded/")) return "uploaded";
  return "uploaded";
}
