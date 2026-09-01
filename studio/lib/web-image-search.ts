import path from "node:path";
import { resolveUniqueWebFileName } from "@/lib/image-slug";
import { saveStagingImage, type ImageFileEntry } from "@/lib/image-store";
import type { WebImageSearchPlan, WebImageSearchQuery } from "@/lib/web-image-search-plan";

type PixabayHit = {
  id: number;
  tags: string;
  largeImageURL?: string;
  webformatURL?: string;
  previewURL?: string;
};

type PixabaySearchResponse = {
  hits?: PixabayHit[];
};

export type WebImageSearchResult = {
  file: ImageFileEntry;
  alt: string;
};

const PIXABAY_API = "https://pixabay.com/api/";

function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return ext;
  } catch {
    // ignore
  }
  return ".jpg";
}

function altFromTags(tags: string): string {
  const first = tags
    .split(",")
    .map((t) => t.trim())
    .find(Boolean);
  if (!first) return "画像";
  return first.length > 80 ? `${first.slice(0, 77)}…` : first;
}

function imageUrlFromHit(hit: PixabayHit): string | null {
  return hit.largeImageURL ?? hit.webformatURL ?? hit.previewURL ?? null;
}

export async function searchPixabay(
  apiKey: string,
  query: WebImageSearchQuery,
): Promise<PixabayHit | null> {
  const params = new URLSearchParams({
    key: apiKey,
    q: query.q,
    image_type: query.media,
    safesearch: "true",
    per_page: "5",
    lang: "en",
  });

  const res = await fetch(`${PIXABAY_API}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Pixabay API error (${res.status})`);
  }

  const data = (await res.json()) as PixabaySearchResponse;
  const hit = data.hits?.[0];
  return hit ?? null;
}

export async function downloadImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`image download failed (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function executeWebImageSearch(
  projectRoot: string,
  pixabayApiKey: string,
  plan: WebImageSearchPlan,
): Promise<WebImageSearchResult[]> {
  const results: WebImageSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of plan.queries) {
    if (results.length >= 3) break;

    const hit = await searchPixabay(pixabayApiKey, query);
    if (!hit) continue;

    const imageUrl = imageUrlFromHit(hit);
    if (!imageUrl || seenUrls.has(imageUrl)) continue;
    seenUrls.add(imageUrl);

    const ext = extFromUrl(imageUrl);
    const fileName = await resolveUniqueWebFileName(projectRoot, hit.id, ext);
    const data = await downloadImageBuffer(imageUrl);
    const file = await saveStagingImage(projectRoot, "web", fileName, data);
    results.push({ file, alt: altFromTags(hit.tags) });
  }

  return results;
}
