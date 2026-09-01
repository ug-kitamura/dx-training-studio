import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTavilySearchProvider,
  resolveSearchProvider,
  SEARCH_MANUAL_RESULT_NOTICE,
  SEARCH_MANUAL_SKIP_GUIDANCE,
  SEARCH_NO_CITATION_GUIDANCE,
  SEARCH_REJECTED_GUIDANCE,
  SEARCH_RESULT_MAX,
  SEARCH_UNAVAILABLE_NOTICE,
  SEARCH_UNCONFIGURED_NOTICE,
} from "@/lib/agent/tools/search-provider";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("検索未成立時の出典抑止", () => {
  it("検索が成立しなかった 4 ケースの案内に出典抑止が含まれる", () => {
    for (const notice of [
      SEARCH_UNAVAILABLE_NOTICE,
      SEARCH_UNCONFIGURED_NOTICE,
      SEARCH_REJECTED_GUIDANCE,
      SEARCH_MANUAL_SKIP_GUIDANCE,
    ]) {
      expect(notice).toContain(SEARCH_NO_CITATION_GUIDANCE);
    }
  });

  it("人手フォールバックで結果を貼付した場合は出典抑止を含めない", () => {
    // 入力された結果に基づく出典は正当なため、ここだけは除外する
    expect(SEARCH_MANUAL_RESULT_NOTICE).not.toContain(
      SEARCH_NO_CITATION_GUIDANCE,
    );
  });

  it("出典抑止は既存の再試行抑止・続行指示より後ろに置かれる", () => {
    for (const notice of [
      SEARCH_UNAVAILABLE_NOTICE,
      SEARCH_UNCONFIGURED_NOTICE,
      SEARCH_REJECTED_GUIDANCE,
      SEARCH_MANUAL_SKIP_GUIDANCE,
    ]) {
      expect(notice.indexOf("続行")).toBeLessThan(
        notice.indexOf(SEARCH_NO_CITATION_GUIDANCE),
      );
    }
  });

  it("作業フォルダ内の資料に基づく記述は抑止の対象外と明示する", () => {
    expect(SEARCH_NO_CITATION_GUIDANCE).toContain("作業フォルダ");
  });
});

describe("createTavilySearchProvider", () => {
  it("normalizes results to title/url/snippet with limit", async () => {
    const many = Array.from({ length: SEARCH_RESULT_MAX + 3 }, (_, i) => ({
      title: `Result ${i}`,
      url: `https://example.com/${i}`,
      content: `  snippet\n ${i}  ${"x".repeat(500)}`,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ results: many })),
    );
    const provider = createTavilySearchProvider("key");
    const outcome = await provider.search("test query");
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.results).toHaveLength(SEARCH_RESULT_MAX);
      expect(outcome.results[0]).toMatchObject({
        title: "Result 0",
        url: "https://example.com/0",
      });
      expect(outcome.results[0].snippet.length).toBeLessThanOrEqual(300);
      expect(outcome.results[0].snippet).not.toContain("\n");
    }
  });

  it("normalizes auth errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    const provider = createTavilySearchProvider("bad-key");
    const outcome = await provider.search("q");
    expect(outcome).toMatchObject({
      ok: false,
      error: expect.stringContaining("認証"),
    });
  });

  it("normalizes network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    const provider = createTavilySearchProvider("key");
    const outcome = await provider.search("q");
    expect(outcome).toMatchObject({
      ok: false,
      error: expect.stringContaining("接続できません"),
    });
  });

  it("skips entries without url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          results: [
            { title: "no url" },
            { url: "https://a.example", content: "ok" },
          ],
        }),
      ),
    );
    const provider = createTavilySearchProvider("key");
    const outcome = await provider.search("q");
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.results).toHaveLength(1);
      expect(outcome.results[0].url).toBe("https://a.example");
    }
  });
});

describe("resolveSearchProvider", () => {
  it("returns null when no key is configured", () => {
    vi.stubEnv("SEARCH_API_KEY", "");
    const req = new Request("http://localhost/api", { method: "POST" });
    expect(resolveSearchProvider(req)).toBeNull();
  });

  it("resolves provider from header key", () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      headers: { "x-search-api-key": "abc" },
    });
    expect(resolveSearchProvider(req)).not.toBeNull();
  });
});
