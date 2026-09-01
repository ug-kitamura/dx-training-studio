import { describe, expect, it, afterEach } from "vitest";
import {
  DEFAULT_AI_MODEL,
  UNSUPPORTED_MODEL_ERROR,
} from "@/lib/ai-models";
import { resolveAiModel, resolveAiModelSlug } from "@/lib/resolve-ai-model";

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/test", { headers });
}

describe("resolveAiModelSlug", () => {
  const prev = process.env.AI_MODEL;

  afterEach(() => {
    process.env.AI_MODEL = prev;
  });

  it("prefers x-ai-model header", () => {
    process.env.AI_MODEL = "claude-opus-4-6";
    const req = requestWithHeaders({ "x-ai-model": "claude-sonnet-5" });
    expect(resolveAiModelSlug(req)).toBe("claude-sonnet-5");
  });

  it("falls back to AI_MODEL env", () => {
    process.env.AI_MODEL = "claude-opus-4-6";
    const req = requestWithHeaders({});
    expect(resolveAiModelSlug(req)).toBe("claude-opus-4-6");
  });

  it("uses default when header and env are absent", () => {
    delete process.env.AI_MODEL;
    const req = requestWithHeaders({});
    expect(resolveAiModelSlug(req)).toBe(DEFAULT_AI_MODEL);
  });
});

describe("resolveAiModel", () => {
  it("accepts supported model", () => {
    const req = requestWithHeaders({ "x-ai-model": "claude-sonnet-5" });
    expect(resolveAiModel(req)).toEqual({ ok: true, model: "claude-sonnet-5" });
  });

  it("rejects unsupported model", () => {
    const req = requestWithHeaders({ "x-ai-model": "gpt-5-nano" });
    expect(resolveAiModel(req)).toEqual({
      ok: false,
      error: UNSUPPORTED_MODEL_ERROR,
    });
  });
});
