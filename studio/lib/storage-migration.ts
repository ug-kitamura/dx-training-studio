import { LOCAL_STORAGE_MIGRATION_PAIRS } from "@/lib/storage-keys";

/**
 * 旧 `dx-training-studio-*` キーを新 `dx-training-studio-*` へ 1 回限りコピーする。
 * 新キーが既にある場合は上書きしない。旧キーは削除しない。
 */
export function migrateLocalStorageIfNeeded(): void {
  if (typeof window === "undefined") return;

  for (const [legacyKey, newKey] of LOCAL_STORAGE_MIGRATION_PAIRS) {
    if (localStorage.getItem(newKey) !== null) continue;
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue === null) continue;
    try {
      localStorage.setItem(newKey, legacyValue);
    } catch {
      // ignore quota
    }
  }
}
