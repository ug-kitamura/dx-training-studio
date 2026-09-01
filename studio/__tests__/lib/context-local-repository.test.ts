import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createContextLocalRepository } from "@/lib/context-local/repository";
import { getStorePath, readStore } from "@/lib/context-local/store";

describe("context-local repository", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  async function createTempRepo() {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "context-local-"));
    return createContextLocalRepository(tempDir);
  }

  it("creates store on first create", async () => {
    const repo = await createTempRepo();
    const item = await repo.createItem({
      title: "環境構築",
      body: "手順",
      tags: ["環境構築"],
      source_url: "https://example.com",
    });

    expect(item.id).toBe(1);
    await expect(readStore(tempDir)).resolves.toEqual({
      nextId: 2,
      items: [item],
    });
    await expect(fs.readFile(getStorePath(tempDir), "utf8")).resolves.toContain(
      "環境構築",
    );
  });

  it("lists items with OR tag filter", async () => {
    const repo = await createTempRepo();
    await repo.createItem({
      title: "A",
      body: "body-a",
      tags: ["環境構築"],
      source_url: "https://a.example",
    });
    await repo.createItem({
      title: "B",
      body: "body-b",
      tags: ["セキュリティ"],
      source_url: "https://b.example",
    });

    const items = await repo.listItems(["環境構築", "セキュリティ"]);
    expect(items).toHaveLength(2);
  });

  it("updates item in place", async () => {
    const repo = await createTempRepo();
    const created = await repo.createItem({
      title: "旧タイトル",
      body: "body",
      tags: ["git"],
      source_url: "https://example.com",
    });

    const updated = await repo.updateItem(created.id, { title: "新タイトル" });
    expect(updated?.title).toBe("新タイトル");
    const store = await readStore(tempDir);
    expect(store.items[0]?.title).toBe("新タイトル");
  });

  it("deletes item from store", async () => {
    const repo = await createTempRepo();
    const created = await repo.createItem({
      title: "削除対象",
      body: "body",
      tags: ["git"],
      source_url: "https://example.com",
    });

    await expect(repo.deleteItem(created.id)).resolves.toBe(true);
    await expect(readStore(tempDir)).resolves.toEqual({
      nextId: 2,
      items: [],
    });
  });

  it("searches title, body, and tags", async () => {
    const repo = await createTempRepo();
    await repo.createItem({
      title: "開発環境",
      body: "Git インストール",
      tags: ["git"],
      source_url: "https://example.com",
    });

    const byTitle = await repo.searchItems("開発");
    const byBody = await repo.searchItems("インストール");
    const byTag = await repo.searchItems("git");

    expect(byTitle).toHaveLength(1);
    expect(byBody).toHaveLength(1);
    expect(byTag).toHaveLength(1);
  });

  it("returns distinct tags sorted", async () => {
    const repo = await createTempRepo();
    await repo.createItem({
      title: "A",
      body: "a",
      tags: ["xyz", "環境構築"],
      source_url: "https://a.example",
    });
    await repo.createItem({
      title: "B",
      body: "b",
      tags: ["環境構築"],
      source_url: "https://b.example",
    });

    await expect(repo.listDistinctTags()).resolves.toEqual(["xyz", "環境構築"]);
  });

  it("initializes single store file under local-db", async () => {
    const repo = await createTempRepo();
    await repo.listItems();
    await expect(fs.access(getStorePath(tempDir))).resolves.toBeUndefined();
  });

  it("migrates legacy split files into single store", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "context-local-"));
    const localDb = path.join(tempDir, "local-db");
    const itemsDir = path.join(localDb, "context-items");
    await fs.mkdir(itemsDir, { recursive: true });
    await fs.writeFile(
      path.join(localDb, "context-meta.json"),
      JSON.stringify({ nextId: 2 }),
      "utf8",
    );
    await fs.writeFile(
      path.join(itemsDir, "1.json"),
      JSON.stringify({
        id: 1,
        title: "legacy",
        body: "body",
        tags: ["git"],
        source_url: "https://example.com",
        source_last_updated_at: null,
        created_by: null,
        updated_by: null,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    const repo = createContextLocalRepository(tempDir);
    const items = await repo.listItems();
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("legacy");
    await expect(fs.access(getStorePath(tempDir))).resolves.toBeUndefined();
  });
});
