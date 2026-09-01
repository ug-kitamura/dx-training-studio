import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/agent/config/route";
import { resolveModelLabel } from "@/lib/agent/model-labels";

describe("resolveModelLabel", () => {
  it("maps known model slugs", () => {
    expect(resolveModelLabel("claude-sonnet-5")).toBe("Claude Sonnet 5");
    expect(resolveModelLabel("claude-opus-5")).toBe("Claude Opus 5");
    expect(resolveModelLabel("claude-fable-5")).toBe("Claude Fable 5");
    expect(resolveModelLabel("claude-haiku-4-5")).toBe("Claude Haiku 4.5");
    expect(resolveModelLabel("gpt-5-nano")).toBe("GPT 5 nano");
  });

  it("falls back to slug when unknown", () => {
    expect(resolveModelLabel("custom-model")).toBe("custom-model");
  });
});

describe("GET /api/agent/config", () => {
  it("returns model and label", async () => {
    const prev = process.env.AI_MODEL;
    process.env.AI_MODEL = "claude-opus-5";
    const response = await GET();
    const data = (await response.json()) as { model: string; modelLabel: string };
    expect(data.model).toBe("claude-opus-5");
    expect(data.modelLabel).toBe("Claude Opus 5");
    process.env.AI_MODEL = prev;
  });
});
