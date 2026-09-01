import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getCanonicalEntry,
  getCanonicalList,
  invalidateCanonicalCache,
  resetCanonicalCache,
} from "@/lib/image-storage/canonical-cache";
import type { CanonicalBackend, CanonicalFileEntry } from "@/lib/image-storage/types";

function entry(name: string, size = 100): CanonicalFileEntry {
  return {
    path: `images/${name}`,
    name,
    source: "uploaded",
    uploadedAt: "2026-08-01T00:00:00.000Z",
    size,
  };
}

/** listCanonical の呼び出し回数を数えるスタブ */
function makeBackend(entries: CanonicalFileEntry[] = [entry("a.png")]) {
  const listCanonical = vi.fn(async () => entries);
  const backend: CanonicalBackend = {
    listCanonical,
    readCanonical: vi.fn(async () => null),
    putCanonical: vi.fn(async () => entries[0]!),
    deleteCanonical: vi.fn(async () => {}),
  };
  return { backend, listCanonical };
}

function makeProjectRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "canonical-cache-"));
  fs.mkdirSync(path.join(root, "images"));
  return root;
}

describe("canonical-cache（storage / TTL）", () => {
  beforeEach(() => resetCanonicalCache());
  afterEach(() => vi.useRealTimers());

  it("TTL 内は listCanonical を 1 回しか呼ばない", async () => {
    const { backend, listCanonical } = makeBackend();
    const root = makeProjectRoot();

    await getCanonicalList(root, "storage", backend);
    await getCanonicalList(root, "storage", backend);
    await getCanonicalList(root, "storage", backend);

    expect(listCanonical).toHaveBeenCalledTimes(1);
  });

  it("TTL を過ぎると読み直す", async () => {
    vi.useFakeTimers();
    const { backend, listCanonical } = makeBackend();
    const root = makeProjectRoot();

    await getCanonicalList(root, "storage", backend);
    vi.advanceTimersByTime(46_000);
    await getCanonicalList(root, "storage", backend);

    expect(listCanonical).toHaveBeenCalledTimes(2);
  });

  it("invalidate すると TTL 残でも読み直す", async () => {
    const { backend, listCanonical } = makeBackend();
    const root = makeProjectRoot();

    await getCanonicalList(root, "storage", backend);
    invalidateCanonicalCache("storage");
    await getCanonicalList(root, "storage", backend);

    expect(listCanonical).toHaveBeenCalledTimes(2);
  });

  it("storageMode ごとに別のキャッシュを持つ", async () => {
    const { backend, listCanonical } = makeBackend();
    const root = makeProjectRoot();

    await getCanonicalList(root, "storage", backend);
    invalidateCanonicalCache("local");
    await getCanonicalList(root, "storage", backend);

    expect(listCanonical).toHaveBeenCalledTimes(1);
  });
});

describe("canonical-cache（local / mtime 検証）", () => {
  beforeEach(() => resetCanonicalCache());

  it("images/ が変わらなければ読み直さない", async () => {
    const { backend, listCanonical } = makeBackend();
    const root = makeProjectRoot();

    await getCanonicalList(root, "local", backend);
    await getCanonicalList(root, "local", backend);

    expect(listCanonical).toHaveBeenCalledTimes(1);
  });

  it("images/ 直下にファイルが直接置かれたら読み直す", async () => {
    const { backend, listCanonical } = makeBackend();
    const root = makeProjectRoot();

    await getCanonicalList(root, "local", backend);
    // mtime の分解能に埋もれないよう明示的に進める
    const future = new Date(Date.now() + 5_000);
    fs.writeFileSync(path.join(root, "images", "new.png"), "x");
    fs.utimesSync(path.join(root, "images"), future, future);
    await getCanonicalList(root, "local", backend);

    expect(listCanonical).toHaveBeenCalledTimes(2);
  });

  it("images/ が無ければ毎回読み直す", async () => {
    const { backend, listCanonical } = makeBackend();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "canonical-cache-empty-"));

    await getCanonicalList(root, "local", backend);
    await getCanonicalList(root, "local", backend);

    expect(listCanonical).toHaveBeenCalledTimes(2);
  });
});

describe("getCanonicalEntry", () => {
  beforeEach(() => resetCanonicalCache());

  it("一覧にあるパスのメタデータを返す", async () => {
    const { backend } = makeBackend([entry("a.png", 42)]);
    const root = makeProjectRoot();

    const found = await getCanonicalEntry(root, "storage", backend, "images/a.png");

    expect(found?.size).toBe(42);
  });

  it("一覧に無いパスは undefined を返す（呼び出し側が head へフォールバックする）", async () => {
    const { backend } = makeBackend([entry("a.png")]);
    const root = makeProjectRoot();

    const found = await getCanonicalEntry(root, "storage", backend, "images/zzz.png");

    expect(found).toBeUndefined();
  });
});
