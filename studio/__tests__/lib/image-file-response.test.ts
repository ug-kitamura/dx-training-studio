import { describe, expect, it } from "vitest";
import {
  formatImageFileEtag,
  imageFileResponse,
  matchesIfNoneMatch,
} from "@/lib/image-file-response";

describe("image-file-response", () => {
  it("formats etag from mtime and size", () => {
    expect(formatImageFileEtag(1_700_000_000_000, 42)).toBe(
      '"1700000000000-42"',
    );
  });

  it("matches If-None-Match header", () => {
    const req = new Request("http://localhost/api/images/file", {
      headers: { "If-None-Match": '"1700000000000-42"' },
    });
    expect(matchesIfNoneMatch(req, '"1700000000000-42"')).toBe(true);
    expect(matchesIfNoneMatch(req, '"other"')).toBe(false);
  });

  it("returns 304 when etag matches", () => {
    const req = new Request("http://localhost/api/images/file", {
      headers: { "If-None-Match": '"1-100"' },
    });
    const res = imageFileResponse(
      req,
      Buffer.from("data"),
      "image/png",
      '"1-100"',
      new Date(0),
    );
    expect(res.status).toBe(304);
    expect(res.headers.get("ETag")).toBe('"1-100"');
  });

  it("returns 200 with body when etag does not match", async () => {
    const req = new Request("http://localhost/api/images/file");
    const res = imageFileResponse(
      req,
      Buffer.from("png"),
      "image/png",
      '"1-100"',
      new Date(0),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe('"1-100"');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("png");
  });
});
