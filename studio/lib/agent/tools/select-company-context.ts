import type { ContextItem } from "@/lib/context-db/types";
import { DbConnectionError } from "@/lib/context-db/types";
import { getContextRepository } from "@/lib/context-resolve";
import type { ContextStorageMode } from "@/lib/schema";
import type { SelectedCompactContextItem } from "@/lib/agent/tools/search-company-context";

export type SelectCompanyContextInput = {
  ids: number[];
};

export type SelectCompanyContextResult = {
  items: SelectedCompactContextItem[];
  error?: string;
};

export type SelectToolDisplay = {
  summary: string;
  display: string;
  tags: string[];
};

export function parseIdsInput(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = raw
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 1);
  if (raw.length > 0 && ids.length === 0) return null;
  return [...new Set(ids)];
}

function toCompactSelectedItem(item: ContextItem, index: number): SelectedCompactContextItem {
  return {
    id: item.id,
    i: index + 1,
    title: item.title,
    url: item.source_url,
    tags: item.tags,
    updated: item.source_last_updated_at,
    body: item.body,
    hasBody: item.body.trim().length > 0,
  };
}

export function formatIdsLabel(ids: number[]): string {
  if (ids.length === 0) return "none";
  return ids.join(",");
}

export async function executeSelectCompanyContext(
  input: SelectCompanyContextInput,
  contextMode: ContextStorageMode = "database",
): Promise<{ result: SelectCompanyContextResult; display: SelectToolDisplay }> {
  const ids = parseIdsInput(input.ids);
  if (ids === null) {
    return {
      result: { items: [], error: "ids が不正です" },
      display: { summary: "error", display: "✗ select: invalid", tags: [] },
    };
  }

  if (ids.length === 0) {
    return {
      result: { items: [] },
      display: { summary: "0件", display: "✓ select: none", tags: [] },
    };
  }

  try {
    const repo = getContextRepository(contextMode);
    const fetched: ContextItem[] = [];
    const missing: number[] = [];

    for (const id of ids) {
      const item = await repo.getItem(id);
      if (item) {
        fetched.push(item);
      } else {
        missing.push(id);
      }
    }

    const compact = fetched.map((item, index) => toCompactSelectedItem(item, index));
    const tags = fetched.flatMap((item) => item.tags);

    if (fetched.length === 0) {
      return {
        result: {
          items: [],
          error: `指定 id の item が見つかりません: ${missing.join(", ")}`,
        },
        display: {
          summary: "0件",
          display: `✗ select: not found (${formatIdsLabel(ids)})`,
          tags: [],
        },
      };
    }

    const result: SelectCompanyContextResult = { items: compact };
    if (missing.length > 0) {
      result.error = `一部 id が見つかりません: ${missing.join(", ")}`;
    }

    return {
      result,
      display: {
        summary: `${compact.length}件`,
        display: `✓ select: ${formatIdsLabel(ids)}`,
        tags,
      },
    };
  } catch (error) {
    if (error instanceof DbConnectionError) {
      return {
        result: { items: [], error: error.message },
        display: {
          summary: "error",
          display: "✗ select: db error",
          tags: [],
        },
      };
    }
    const message = error instanceof Error ? error.message : "選択に失敗しました";
    return {
      result: { items: [], error: message },
      display: { summary: "error", display: "✗ select: error", tags: [] },
    };
  }
}

export const SELECT_COMPANY_CONTEXT_SCHEMA = {
  name: "select_company_context",
  description:
    "社内コンテキスト item を DB id で取得する。選択 item の body と hasBody を返す。空配列は選択なし。",
  input_schema: {
    type: "object",
    properties: {
      ids: {
        type: "array",
        items: { type: "integer" },
        description: "context_items の DB id 配列。空配列は選択なし。",
      },
    },
    required: ["ids"],
  },
} as const;
