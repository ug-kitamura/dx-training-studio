import { afterEach, describe, expect, it, vi } from "vitest";
import { DbConnectionError } from "@/lib/context-db/types";

const checkConnection = vi.fn();
const listItems = vi.fn();
const searchItems = vi.fn();

vi.mock("@/lib/context-resolve", () => ({
  getContextRepository: () => ({
    checkConnection,
    listItems,
    searchItems,
    getItem: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    listDistinctTags: vi.fn(),
  }),
  parseContextModeFromRequest: (req: Request) => {
    const { searchParams } = new URL(req.url);
    return searchParams.get("contextMode") === "local" ? "local" : "database";
  },
  resetContextRepositoryForTests: vi.fn(),
}));

describe("GET /api/context/db-check", () => {
  afterEach(() => {
    checkConnection.mockReset();
  });

  it("returns ok when connection succeeds", async () => {
    checkConnection.mockResolvedValue(undefined);
    const { GET } = await import("@/app/api/context/db-check/route");
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 503 when database is unavailable", async () => {
    checkConnection.mockRejectedValue(new DbConnectionError());
    const { GET } = await import("@/app/api/context/db-check/route");
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "データベースに接続できません" });
  });
});

describe("GET /api/context/items", () => {
  afterEach(() => {
    listItems.mockReset();
  });

  it("returns filtered items", async () => {
    listItems.mockResolvedValue([{ id: 1, title: "A" }]);
    const { GET } = await import("@/app/api/context/items/route");
    const response = await GET(
      new Request(
        "http://localhost/api/context/items?tags=環境構築,xyz&contextMode=database",
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [{ id: 1, title: "A" }] });
    expect(listItems).toHaveBeenCalledWith(["環境構築", "xyz"]);
  });

  it("returns 400 on invalid create body", async () => {
    const { POST } = await import("@/app/api/context/items/route");
    const response = await POST(
      new Request("http://localhost/api/context/items?contextMode=local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "A", body: "B" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("accepts empty tags on create", async () => {
    const { POST } = await import("@/app/api/context/items/route");
    const response = await POST(
      new Request("http://localhost/api/context/items?contextMode=local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "A",
          body: "B",
          tags: [],
          source_url: "https://example.com",
        }),
      }),
    );
    expect(response.status).toBe(201);
  });
});

describe("GET /api/context/items/search", () => {
  afterEach(() => {
    searchItems.mockReset();
  });

  it("returns search results", async () => {
    searchItems.mockResolvedValue([{ id: 1, title: "A" }]);
    const { GET } = await import("@/app/api/context/items/search/route");
    const response = await GET(
      new Request(
        "http://localhost/api/context/items/search?q=環境&contextMode=local",
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [{ id: 1, title: "A" }],
    });
    expect(searchItems).toHaveBeenCalledWith("環境");
  });

  it("normalizes quoted q before search", async () => {
    searchItems.mockResolvedValue([{ id: 2, title: "NMS Git ブランチ運用ルール" }]);
    const { GET } = await import("@/app/api/context/items/search/route");
    const response = await GET(
      new Request(
        "http://localhost/api/context/items/search?q=%E3%80%8C%E3%83%96%E3%83%A9%E3%83%B3%E3%83%81%E3%80%8D&contextMode=database",
      ),
    );
    expect(response.status).toBe(200);
    expect(searchItems).toHaveBeenCalledWith("ブランチ");
  });

  it("returns 400 when q is missing", async () => {
    const { GET } = await import("@/app/api/context/items/search/route");
    const response = await GET(
      new Request("http://localhost/api/context/items/search?contextMode=local"),
    );
    expect(response.status).toBe(400);
  });
});
