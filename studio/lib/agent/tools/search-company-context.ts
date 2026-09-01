import { DbConnectionError } from "@/lib/context-db/types";
import { getContextRepository } from "@/lib/context-resolve";
import { normalizeSearchQuery } from "@/lib/context-search";
import type { ContextStorageMode } from "@/lib/schema";

export type SearchCompanyContextInput = {
  query: string;
};

export type CompactContextItem = {
  id: number;
  i: number;
  title: string;
  url: string;
  tags: string[];
  updated: string | null;
  body: string;
};

export type SelectedCompactContextItem = CompactContextItem & {
  hasBody: boolean;
};

export type SearchCompanyContextResult = {
  items?: CompactContextItem[];
  error?: string;
};

export type SearchToolDisplay = {
  summary: string;
  display: string;
};

export function buildSearchDisplay(query: string, count: number): SearchToolDisplay {
  return {
    summary: `${count}件`,
    display: `🔍 search: ${query} → ${count}件`,
  };
}

export function toCompactSearchItems(
  items: Array<{
    id: number;
    title: string;
    source_url: string;
    tags: string[];
    source_last_updated_at: string | null;
  }>,
): CompactContextItem[] {
  return items.map((item, index) => ({
    id: item.id,
    i: index + 1,
    title: item.title,
    url: item.source_url,
    tags: item.tags,
    updated: item.source_last_updated_at,
    body: "",
  }));
}

export async function executeSearchCompanyContext(
  input: SearchCompanyContextInput,
  contextMode: ContextStorageMode = "database",
): Promise<{ result: SearchCompanyContextResult; display: SearchToolDisplay }> {
  const query = normalizeSearchQuery(input.query ?? "");
  if (!query) {
    const display = buildSearchDisplay(input.query ?? "", 0);
    return {
      result: { error: "検索キーワードが空です", items: [] },
      display,
    };
  }

  try {
    const repo = getContextRepository(contextMode);
    const items = await repo.searchItems(query);
    const compact = toCompactSearchItems(items);
    return {
      result: { items: compact },
      display: buildSearchDisplay(query, compact.length),
    };
  } catch (error) {
    if (error instanceof DbConnectionError) {
      return {
        result: { error: error.message, items: [] },
        display: buildSearchDisplay(query, 0),
      };
    }
    const message = error instanceof Error ? error.message : "検索に失敗しました";
    return {
      result: { error: message, items: [] },
      display: buildSearchDisplay(query, 0),
    };
  }
}

export const SEARCH_COMPANY_CONTEXT_SCHEMA = {
  name: "search_company_context",
  description:
    "社内コンテキスト DB をキーワード検索する。結果は id / title / url / tags の一覧（body なし）。",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "検索キーワード（引用符なし）",
      },
    },
    required: ["query"],
  },
} as const;
