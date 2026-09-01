import fs from "node:fs/promises";
import path from "node:path";
import { IMAGE_SOURCES } from "@/lib/image-path";
import { getImagesRoot } from "@/lib/image-store";

const MAX_SLUG_LEN = 48;

/** Claude 提案スラッグをファイル名用に正規化（拡張子なし） */
export function sanitizeImageSlug(raw: string): string {
  const base = raw
    .trim()
    .toLowerCase()
    .replace(/\.png$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LEN);
  return base.length > 0 ? base : "diagram";
}

/** `images/` 直下および staging 配下の既存ファイル名（小文字）を収集 */
export async function collectExistingImageBaseNames(
  projectRoot: string,
): Promise<Set<string>> {
  const names = new Set<string>();
  const root = getImagesRoot(projectRoot);

  async function addFromDir(dir: string) {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      const absolute = path.join(dir, name);
      const stat = await fs.stat(absolute);
      if (stat.isFile()) {
        names.add(name.toLowerCase());
      }
    }
  }

  await addFromDir(root);
  for (const source of IMAGE_SOURCES) {
    await addFromDir(path.join(root, source));
  }
  return names;
}

/** `{slug}.png` が空きならそれ、なければ `{slug}-2.png` … を返す */
export async function resolveUniquePngFileName(
  projectRoot: string,
  slug: string,
): Promise<string> {
  return resolveUniqueImageFileName(projectRoot, sanitizeImageSlug(slug), ".png");
}

const ALLOWED_WEB_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/** Pixabay 取得画像用。`web-{id}{ext}` が衝突したら連番付与 */
export async function resolveUniqueWebFileName(
  projectRoot: string,
  pixabayId: number,
  ext: string,
): Promise<string> {
  const normalized = ext.startsWith(".")
    ? ext.toLowerCase()
    : `.${ext.toLowerCase()}`;
  const safeExt = ALLOWED_WEB_EXT.has(normalized) ? normalized : ".jpg";
  return resolveUniqueImageFileName(projectRoot, `web-${pixabayId}`, safeExt);
}

/**
 * `{base}{ext}` が空きならそれ、なければ `{base}-2{ext}` … を返す（欠番埋め）。
 * ⚠ lib/workspace-unique-name.ts の resolveUniqueFileName（max+1）とは別セマンティクス。
 */
export async function resolveUniqueImageFileName(
  projectRoot: string,
  base: string,
  ext: string,
): Promise<string> {
  const safeExt = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  const existing = await collectExistingImageBaseNames(projectRoot);
  let candidate = `${base}${safeExt}`;
  if (!existing.has(candidate.toLowerCase())) return candidate;

  for (let n = 2; n < 10_000; n++) {
    candidate = `${base}-${n}${safeExt}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return `${base}-${Date.now()}${safeExt}`;
}
