/**
 * `public/` 配下のアセットへのパス。
 *
 * `next/image` や MDX の静的 import と違い、生の `<img src="/...">` には
 * basePath が自動で付かない。サブパス配信（GitHub Pages）で 404 にしないため、
 * ここで明示的に前置する。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function assetPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalized}`;
}
