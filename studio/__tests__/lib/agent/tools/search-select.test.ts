import { beforeEach, describe, expect, it, vi } from "vitest";
import { DbConnectionError } from "@/lib/context-db/types";
import {
  executeSearchCompanyContext,
  toCompactSearchItems,
} from "@/lib/agent/tools/search-company-context";
import {
  executeSelectCompanyContext,
  parseIdsInput,
} from "@/lib/agent/tools/select-company-context";
import { executeRegisteredTool } from "@/lib/agent/tools/registry";

vi.mock("@/lib/context-resolve", () => ({
  getContextRepository: vi.fn(),
}));

import { getContextRepository } from "@/lib/context-resolve";

const sampleItem = {
  id: 42,
  title: "ブランチ",
  body: "secret body",
  tags: ["git"],
  source_url: "https://example.com",
  source_last_updated_at: "2026-01-01",
  created_by: null,
  updated_by: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

describe("search-company-context", () => {
  beforeEach(() => {
    vi.mocked(getContextRepository).mockReset();
  });

  it("returns compact items with id and without body", async () => {
    vi.mocked(getContextRepository).mockReturnValue({
      searchItems: vi.fn().mockResolvedValue([sampleItem]),
    } as never);

    const outcome = await executeSearchCompanyContext({ query: "ブランチ" }, "local");

    expect(outcome.result.items).toHaveLength(1);
    expect(outcome.result.items?.[0]?.id).toBe(42);
    expect(outcome.result.items?.[0]?.body).toBe("");
    expect(outcome.display.display).toBe("🔍 search: ブランチ → 1件");
  });

  it("returns db error in tool result", async () => {
    vi.mocked(getContextRepository).mockReturnValue({
      searchItems: vi.fn().mockRejectedValue(new DbConnectionError()),
    } as never);

    const outcome = await executeSearchCompanyContext({ query: "test" }, "local");

    expect(outcome.result.error).toBeTruthy();
    expect(outcome.result.items).toEqual([]);
  });
});

describe("select-company-context", () => {
  beforeEach(() => {
    vi.mocked(getContextRepository).mockReset();
  });

  it("parses ids input", () => {
    expect(parseIdsInput([42, 57])).toEqual([42, 57]);
    expect(parseIdsInput([])).toEqual([]);
    expect(parseIdsInput("none")).toBeNull();
  });

  it("returns body and hasBody for selected items by id", async () => {
    vi.mocked(getContextRepository).mockReturnValue({
      getItem: vi.fn().mockImplementation(async (id: number) => {
        if (id === 2) {
          return {
            id: 2,
            title: "B",
            body: "body-b",
            tags: ["b"],
            source_url: "https://b",
            source_last_updated_at: null,
            created_by: null,
            updated_by: null,
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
          };
        }
        return null;
      }),
    } as never);

    const outcome = await executeSelectCompanyContext({ ids: [2] }, "local");
    expect(outcome.result.items).toHaveLength(1);
    expect(outcome.result.items[0]?.body).toBe("body-b");
    expect(outcome.result.items[0]?.hasBody).toBe(true);
    expect(outcome.display.tags).toEqual(["b"]);
  });

  it("returns hasBody false for empty body items", async () => {
    vi.mocked(getContextRepository).mockReturnValue({
      getItem: vi.fn().mockResolvedValue({
        id: 42,
        title: "NMS",
        body: "",
        tags: ["nms"],
        source_url: "https://example.com/nms",
        source_last_updated_at: null,
        created_by: null,
        updated_by: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      }),
    } as never);

    const outcome = await executeSelectCompanyContext({ ids: [42] }, "local");
    expect(outcome.result.items).toHaveLength(1);
    expect(outcome.result.items[0]?.hasBody).toBe(false);
    expect(outcome.result.error).toBeUndefined();
  });

  it("succeeds without prior search session (invoke跨ぎ)", async () => {
    vi.mocked(getContextRepository).mockReturnValue({
      getItem: vi.fn().mockResolvedValue(sampleItem),
    } as never);

    const outcome = await executeSelectCompanyContext({ ids: [42] }, "local");
    expect(outcome.result.items).toHaveLength(1);
    expect(outcome.result.items[0]?.id).toBe(42);
    expect(outcome.result.error).toBeUndefined();
  });

  it("returns error when id does not exist", async () => {
    vi.mocked(getContextRepository).mockReturnValue({
      getItem: vi.fn().mockResolvedValue(null),
    } as never);

    const outcome = await executeSelectCompanyContext({ ids: [99999] }, "local");
    expect(outcome.result.items).toEqual([]);
    expect(outcome.result.error).toContain("99999");
  });

  it("treats empty ids as no selection", async () => {
    const outcome = await executeSelectCompanyContext({ ids: [] }, "local");
    expect(outcome.result.items).toEqual([]);
    expect(outcome.result.error).toBeUndefined();
    expect(outcome.display.display).toBe("✓ select: none");
  });
});

function contextOnly(mode: "local" | "database") {
  return {
    projectRoot: process.cwd(),
    workScopeKey: "",
    contextMode: mode,
  };
}

describe("tool registry", () => {
  beforeEach(() => {
    vi.mocked(getContextRepository).mockReset();
  });

  it("executes registered search tool", async () => {
    vi.mocked(getContextRepository).mockReturnValue({
      searchItems: vi.fn().mockResolvedValue([]),
    } as never);

    const outcome = await executeRegisteredTool(
      "search_company_context",
      { query: "git" },
      contextOnly("local"),
    );
    expect(outcome.display.summary).toBe("0件");
  });

  it("executes registered select tool", async () => {
    vi.mocked(getContextRepository).mockReturnValue({
      getItem: vi.fn().mockResolvedValue(sampleItem),
    } as never);

    const outcome = await executeRegisteredTool(
      "select_company_context",
      { ids: [42] },
      contextOnly("local"),
    );
    expect(outcome.display.summary).toBe("1件");
  });
});

describe("toCompactSearchItems", () => {
  it("assigns id and 1-based index", () => {
    expect(
      toCompactSearchItems([
        {
          id: 42,
          title: "A",
          source_url: "https://a",
          tags: [],
          source_last_updated_at: null,
        },
      ]),
    ).toEqual([
      {
        id: 42,
        i: 1,
        title: "A",
        url: "https://a",
        tags: [],
        updated: null,
        body: "",
      },
    ]);
  });
});
