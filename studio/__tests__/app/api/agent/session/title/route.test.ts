import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent/generate-session-title", () => ({
  generateSessionTitle: vi.fn(),
}));

import { generateSessionTitle } from "@/lib/agent/generate-session-title";

describe("POST /api/agent/session/title", () => {
  beforeEach(() => {
    vi.mocked(generateSessionTitle).mockReset();
  });

  it("returns generated title for valid request", async () => {
    vi.mocked(generateSessionTitle).mockResolvedValue({
      ok: true,
      title: "レッスン構成の相談",
    });

    const { POST } = await import("@/app/api/agent/session/title/route");
    const res = await POST(
      new Request("http://localhost/api/agent/session/title", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: "構成を相談したい" },
            { role: "assistant", content: "どのレッスンですか？" },
          ],
        }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ title: "レッスン構成の相談" });
  });

  it("returns 400 when assistant message is missing", async () => {
    const { POST } = await import("@/app/api/agent/session/title/route");
    const res = await POST(
      new Request("http://localhost/api/agent/session/title", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "hello" }],
        }),
      }),
    );

    expect(res.status).toBe(400);
    expect(generateSessionTitle).not.toHaveBeenCalled();
  });

  it("returns provider error status", async () => {
    vi.mocked(generateSessionTitle).mockResolvedValue({
      ok: false,
      error: "AI API キーを設定（歯車）するか、サーバーに AI_API_KEY を設定してください",
      status: 401,
    });

    const { POST } = await import("@/app/api/agent/session/title/route");
    const res = await POST(
      new Request("http://localhost/api/agent/session/title", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: "hello" },
            { role: "assistant", content: "world" },
          ],
        }),
      }),
    );

    expect(res.status).toBe(401);
  });
});
