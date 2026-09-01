import fs from "node:fs/promises";
import { getImagesRoot } from "@/lib/image-store";
import type { CanonicalBackend, CanonicalFileEntry } from "@/lib/image-storage/types";
import type { ImageStorageMode } from "@/lib/schema";

/**
 * 正本一覧のプロセス内キャッシュ。
 *
 * Vercel Blob の課金は `list()` が **Advanced Operation**、`head()` が Simple
 * Operation として数えられる。素直に実装すると画面マウントごとに `list()`、
 * 画像 1 枚ごとに `head()` を撃つことになり、Hobby 枠（Advanced 2k / 月）は
 * すぐ枯れる——実際に枯れて store がブロックされた。ここで一覧を持ち回り、
 * ETag の材料もこのキャッシュから取ることで、操作数を TTL 窓あたり高々 1 に抑える。
 *
 * 鮮度の見方はバックエンドで違う:
 * - blob: TTL ＋ promote / delete での明示無効化。正本の変更は必ず同一プロセスの
 *   API を通るので、TTL は「ダッシュボード等での外部変更」に対する保険でしかない
 * - local: `images/` の mtime 比較。`stat` は無料なので毎回検証でき、ユーザーが
 *   fs へ直接ファイルを置く運用（実績あり）を即時反映できる
 */

/** blob キャッシュの寿命。外部変更に対する保険なので長すぎず短すぎず */
const BLOB_TTL_MS = 45_000;

type CacheEntry = {
  entries: CanonicalFileEntry[];
  /** blob: 取得時刻（TTL 判定用） */
  fetchedAt: number;
  /** local: 取得時点の `images/` ディレクトリ mtime */
  imagesDirMtimeMs?: number;
};

const cache = new Map<ImageStorageMode, CacheEntry>();

/** テスト用: キャッシュを空にする */
export function resetCanonicalCache(): void {
  cache.clear();
}

/** promote / 正本削除の成功時に呼ぶ。次回取得で必ず読み直す */
export function invalidateCanonicalCache(storageMode?: ImageStorageMode): void {
  if (storageMode) cache.delete(storageMode);
  else cache.clear();
}

async function imagesDirMtimeMs(projectRoot: string): Promise<number | undefined> {
  try {
    const stat = await fs.stat(getImagesRoot(projectRoot));
    return stat.mtimeMs;
  } catch {
    return undefined;
  }
}

function isFresh(
  entry: CacheEntry,
  storageMode: ImageStorageMode,
  currentMtimeMs: number | undefined,
): boolean {
  if (storageMode === "local") {
    // mtime が取れない（images/ が無い）ときは毎回読み直す
    if (currentMtimeMs === undefined) return false;
    return entry.imagesDirMtimeMs === currentMtimeMs;
  }
  return Date.now() - entry.fetchedAt < BLOB_TTL_MS;
}

/**
 * 正本一覧を取得する。鮮度が保たれていればバックエンドへ問い合わせない。
 */
export async function getCanonicalList(
  projectRoot: string,
  storageMode: ImageStorageMode,
  backend: CanonicalBackend,
): Promise<CanonicalFileEntry[]> {
  const currentMtimeMs =
    storageMode === "local" ? await imagesDirMtimeMs(projectRoot) : undefined;

  const cached = cache.get(storageMode);
  if (cached && isFresh(cached, storageMode, currentMtimeMs)) {
    return cached.entries;
  }

  const entries = await backend.listCanonical();
  cache.set(storageMode, {
    entries,
    fetchedAt: Date.now(),
    imagesDirMtimeMs: currentMtimeMs,
  });
  return entries;
}

/**
 * 一覧キャッシュから 1 件のメタデータを引く。ETag の材料に使う。
 * キャッシュに無ければ `undefined`（呼び出し側が `head()` にフォールバックする）。
 */
export async function getCanonicalEntry(
  projectRoot: string,
  storageMode: ImageStorageMode,
  backend: CanonicalBackend,
  logicalPath: string,
): Promise<CanonicalFileEntry | undefined> {
  const entries = await getCanonicalList(projectRoot, storageMode, backend);
  return entries.find((entry) => entry.path === logicalPath);
}
