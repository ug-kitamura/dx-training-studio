import os from "node:os";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { resolveSql } from "@/lib/context-db/resolve";
import { tokenizeSearchQuery } from "@/lib/context-search";
import type {
  ContextItem,
  ContextItemRow,
  CreateContextItemInput,
  UpdateContextItemInput,
} from "@/lib/context-db/types";

function getCurrentUsername(): string | null {
  try {
    const username = os.userInfo().username?.trim();
    return username || null;
  } catch {
    return null;
  }
}

function toIsoDate(value: string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function toIsoTimestamp(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function mapContextItemRow(row: ContextItemRow): ContextItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tags: row.tags ?? [],
    source_url: row.source_url,
    source_last_updated_at: toIsoDate(row.source_last_updated_at),
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: toIsoTimestamp(row.created_at),
    updated_at: toIsoTimestamp(row.updated_at),
  };
}

export type ContextRepository = ReturnType<typeof createContextDbRepository>;

export function createContextDbRepository(
  sql: NeonQueryFunction<false, false> = resolveSql(),
) {
  return {
    async checkConnection(): Promise<void> {
      await sql`SELECT 1`;
    },

    async listItems(tags?: string[]): Promise<ContextItem[]> {
      if (tags && tags.length > 0) {
        const rows = (await sql`
          SELECT *
          FROM context_items
          WHERE tags && ${tags}::text[]
          ORDER BY updated_at DESC, id DESC
        `) as ContextItemRow[];
        return rows.map(mapContextItemRow);
      }

      const rows = (await sql`
        SELECT *
        FROM context_items
        ORDER BY updated_at DESC, id DESC
      `) as ContextItemRow[];
      return rows.map(mapContextItemRow);
    },

    async getItem(id: number): Promise<ContextItem | null> {
      const rows = (await sql`
        SELECT *
        FROM context_items
        WHERE id = ${id}
        LIMIT 1
      `) as ContextItemRow[];
      const row = rows[0];
      return row ? mapContextItemRow(row) : null;
    },

    async createItem(input: CreateContextItemInput): Promise<ContextItem> {
      const username = getCurrentUsername();
      const rows = (await sql`
        INSERT INTO context_items (
          title,
          body,
          tags,
          source_url,
          source_last_updated_at,
          created_by,
          updated_by
        )
        VALUES (
          ${input.title},
          ${input.body},
          ${input.tags}::text[],
          ${input.source_url},
          ${input.source_last_updated_at ?? null},
          ${username},
          ${username}
        )
        RETURNING *
      `) as ContextItemRow[];
      const row = rows[0];
      if (!row) {
        throw new Error("Failed to create context item");
      }
      return mapContextItemRow(row);
    },

    async updateItem(
      id: number,
      input: UpdateContextItemInput,
    ): Promise<ContextItem | null> {
      const existing = await this.getItem(id);
      if (!existing) return null;

      const username = getCurrentUsername();
      const rows = (await sql`
        UPDATE context_items
        SET
          title = ${input.title ?? existing.title},
          body = ${input.body ?? existing.body},
          tags = ${(input.tags ?? existing.tags)}::text[],
          source_url = ${input.source_url ?? existing.source_url},
          source_last_updated_at = ${
            input.source_last_updated_at !== undefined
              ? input.source_last_updated_at
              : existing.source_last_updated_at
          },
          updated_by = ${username},
          updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `) as ContextItemRow[];
      const row = rows[0];
      return row ? mapContextItemRow(row) : null;
    },

    async deleteItem(id: number): Promise<boolean> {
      const rows = (await sql`
        DELETE FROM context_items
        WHERE id = ${id}
        RETURNING id
      `) as { id: number }[];
      return rows.length > 0;
    },

    async listDistinctTags(): Promise<string[]> {
      const rows = (await sql`
        SELECT DISTINCT unnest(tags) AS tag
        FROM context_items
        ORDER BY tag
      `) as { tag: string }[];
      return rows.map((row) => row.tag);
    },

    async searchItems(query: string): Promise<ContextItem[]> {
      const tokens = tokenizeSearchQuery(query);
      if (tokens.length === 0) return [];

      const patterns = tokens.map((token) => `%${token}%`);
      const rows = (await sql`
        SELECT *
        FROM context_items
        WHERE EXISTS (
          SELECT 1
          FROM unnest(${patterns}::text[]) AS search_pattern(pattern)
          WHERE
            title ILIKE search_pattern.pattern
            OR body ILIKE search_pattern.pattern
            OR COALESCE(array_to_string(tags, ' '), '') ILIKE search_pattern.pattern
        )
        ORDER BY updated_at DESC, id DESC
      `) as ContextItemRow[];
      return rows.map(mapContextItemRow);
    },
  };
}

