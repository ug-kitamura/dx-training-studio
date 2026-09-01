import { describe, expect, it } from "vitest";
import {
  createContextDbRepository,
  mapContextItemRow,
} from "@/lib/context-db/repository";
import type { ContextItemRow } from "@/lib/context-db/types";

describe("context-db repository", () => {
  it("maps database rows to ContextItem", () => {
    const row: ContextItemRow = {
      id: 1,
      title: "環境構築",
      body: "手順",
      tags: ["環境構築"],
      source_url: "https://example.com/doc",
      source_last_updated_at: "2024-01-15",
      created_by: "dev",
      updated_by: "dev",
      created_at: "2024-02-01T00:00:00.000Z",
      updated_at: "2024-02-02T00:00:00.000Z",
    };

    expect(mapContextItemRow(row)).toEqual({
      id: 1,
      title: "環境構築",
      body: "手順",
      tags: ["環境構築"],
      source_url: "https://example.com/doc",
      source_last_updated_at: "2024-01-15",
      created_by: "dev",
      updated_by: "dev",
      created_at: "2024-02-01T00:00:00.000Z",
      updated_at: "2024-02-02T00:00:00.000Z",
    });
  });

  it("lists items with OR tag filter", async () => {
    const calls: unknown[][] = [];
    const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push([strings.join("|"), ...values]);
      return [
        {
          id: 1,
          title: "A",
          body: "body-a",
          tags: ["環境構築"],
          source_url: "https://a.example",
          source_last_updated_at: null,
          created_by: null,
          updated_by: null,
          created_at: "2024-02-01T00:00:00.000Z",
          updated_at: "2024-02-02T00:00:00.000Z",
        },
        {
          id: 2,
          title: "B",
          body: "body-b",
          tags: ["セキュリティ"],
          source_url: "https://b.example",
          source_last_updated_at: null,
          created_by: null,
          updated_by: null,
          created_at: "2024-02-01T00:00:00.000Z",
          updated_at: "2024-02-02T00:00:00.000Z",
        },
      ];
    };

    const repo = createContextDbRepository(sql as never);
    const items = await repo.listItems(["環境構築", "セキュリティ"]);

    expect(items).toHaveLength(2);
    expect(calls[0]?.[1]).toEqual(["環境構築", "セキュリティ"]);
  });

  it("returns distinct tags", async () => {
    const sql = async () => [{ tag: "xyz" }, { tag: "環境構築" }];
    const repo = createContextDbRepository(sql as never);
    await expect(repo.listDistinctTags()).resolves.toEqual(["xyz", "環境構築"]);
  });

  it("searches items with OR across tokens in one query", async () => {
    const calls: unknown[][] = [];
    const sql = async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push(values);
      return [
        {
          id: 3,
          title: "開発環境セットアップ",
          body: "Git を社内 PC にインストール",
          tags: ["git"],
          source_url: "https://example.com",
          source_last_updated_at: null,
          created_by: null,
          updated_by: null,
          created_at: "2024-02-01T00:00:00.000Z",
          updated_at: "2024-02-02T00:00:00.000Z",
        },
      ];
    };
    const repo = createContextDbRepository(sql as never);
    const items = await repo.searchItems("Git インストール 環境構築");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toEqual(["%Git%", "%インストール%", "%環境構築%"]);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("開発環境セットアップ");
  });
});
