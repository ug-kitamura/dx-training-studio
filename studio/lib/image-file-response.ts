export function formatImageFileEtag(mtimeMs: number, size: number): string {
  return `"${mtimeMs}-${size}"`;
}

export function matchesIfNoneMatch(req: Request, etag: string): boolean {
  const header = req.headers.get("if-none-match");
  if (!header) return false;
  return header
    .split(",")
    .map((value) => value.trim())
    .includes(etag);
}

const CACHE_CONTROL = "private, no-cache, must-revalidate";

export function imageFileNotModifiedResponse(
  etag: string,
  lastModified: Date,
): Response {
  return new Response(null, {
    status: 304,
    headers: {
      ETag: etag,
      "Last-Modified": lastModified.toUTCString(),
      "Cache-Control": CACHE_CONTROL,
    },
  });
}

export function imageFileDataResponse(
  data: Buffer,
  contentType: string,
  etag: string,
  lastModified: Date,
): Response {
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      ETag: etag,
      "Last-Modified": lastModified.toUTCString(),
      "Cache-Control": CACHE_CONTROL,
    },
  });
}

export function imageFileResponse(
  req: Request,
  data: Buffer,
  contentType: string,
  etag: string,
  lastModified: Date,
): Response {
  if (matchesIfNoneMatch(req, etag)) {
    return imageFileNotModifiedResponse(etag, lastModified);
  }
  return imageFileDataResponse(data, contentType, etag, lastModified);
}
