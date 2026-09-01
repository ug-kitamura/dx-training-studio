import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IMAGE_ERROR_MESSAGE,
  probeImageError,
  resetImageErrorProbe,
} from "@/lib/image-error";
import {
  StorageBlockedError,
  StorageConnectionError,
  StorageReadError,
} from "@/lib/image-storage/types";
import { storageErrorKind, storageErrorResponse } from "@/lib/image-storage/resolve";

describe("storageErrorResponse の分類", () => {
  it("上限ブロックは 503 と blocked を返す", async () => {
    const res = storageErrorResponse(new StorageBlockedError())!;
    expect(res.status).toBe(503);
    const json = (await res.json()) as { kind: string; error: string };
    expect(json.kind).toBe("blocked");
    expect(json.error).toContain("ブロック");
  });

  it("読み出し失敗は 502 と read-failed を返す", async () => {
    const res = storageErrorResponse(new StorageReadError())!;
    expect(res.status).toBe(502);
    expect(((await res.json()) as { kind: string }).kind).toBe("read-failed");
  });

  it("未接続は 503 と not-connected を返す", async () => {
    const res = storageErrorResponse(new StorageConnectionError())!;
    expect(res.status).toBe(503);
    expect(((await res.json()) as { kind: string }).kind).toBe("not-connected");
  });

  it("ストレージ由来でない例外は拾わない", () => {
    expect(storageErrorResponse(new Error("boom"))).toBeNull();
    expect(storageErrorKind(new Error("boom"))).toBeUndefined();
  });
});

describe("IMAGE_ERROR_MESSAGE", () => {
  it("missing だけが「存在しません」を名乗る", () => {
    expect(IMAGE_ERROR_MESSAGE.missing).toBe("画像が存在しません");
    expect(IMAGE_ERROR_MESSAGE.blocked).not.toContain("存在しません");
    expect(IMAGE_ERROR_MESSAGE["read-failed"]).not.toContain("存在しません");
    expect(IMAGE_ERROR_MESSAGE["not-connected"]).not.toContain("存在しません");
  });
});

describe("probeImageError", () => {
  const originalFetch = global.fetch;

  beforeEach(() => resetImageErrorProbe());
  afterEach(() => {
    global.fetch = originalFetch;
    resetImageErrorProbe();
  });

  it("404 は missing のまま", async () => {
    global.fetch = vi.fn(async () => new Response("{}", { status: 404 })) as never;
    expect(await probeImageError("/api/images/file?path=images/x.png")).toBe("missing");
  });

  it("503 blocked を読み取る", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ kind: "blocked" }), { status: 503 }),
    ) as never;
    expect(await probeImageError("/api/images/file?path=images/x.png")).toBe("blocked");
  });

  it("判別できない応答は missing へ落ちる（フェイルセーフ）", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: "?" }), { status: 500 }),
    ) as never;
    expect(await probeImageError("/api/images/file?path=images/x.png")).toBe("missing");
  });

  it("ネットワーク例外でも落ちない", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network");
    }) as never;
    expect(await probeImageError("/api/images/file?path=images/x.png")).toBe("missing");
  });

  it("同時に失敗した分もプローブは 1 回に収まる（in-flight を共有する）", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ kind: "blocked" }), { status: 503 }),
    );
    global.fetch = fetchMock as never;

    // 1 画面のサムネイルは同時に失敗する。結果を待たずに並ぶケース
    const kinds = await Promise.all(
      Array.from({ length: 22 }, (_, i) =>
        probeImageError(`/api/images/file?path=images/${i}.png`),
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Set(kinds)).toEqual(new Set(["blocked"]));
  });

  it("連続失敗ではプローブを 1 回に抑える", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ kind: "blocked" }), { status: 503 }),
    );
    global.fetch = fetchMock as never;

    for (let i = 0; i < 20; i += 1) {
      await probeImageError(`/api/images/file?path=images/${i}.png`);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
