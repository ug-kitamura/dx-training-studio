import { afterEach, describe, expect, it } from "vitest";
import {
  isAutoNudgeDisabled,
  resolveModelProfile,
  UNKNOWN_MODEL_PROFILE,
} from "@/lib/agent/model-profiles";

describe("model-profiles", () => {
  afterEach(() => {
    delete process.env.DX_STUDIO_MODEL_PROFILES;
    delete process.env.DX_STUDIO_AUTO_NUDGE;
  });

  it("raises the large Claude group's maxOutputTokens to 64000", () => {
    const sonnet = resolveModelProfile("claude-sonnet-5");
    expect(sonnet.maxOutputTokens).toBe(64000);
    expect(sonnet.continuations).toEqual({
      generatePerSection: 4,
      textPerTurn: 4,
      nudgeMax: 2,
    });
    expect(sonnet.providerParams).toEqual({});

    const haiku = resolveModelProfile("claude-haiku-4-5");
    expect(haiku.maxOutputTokens).toBe(32000);
    expect(haiku.continuations.generatePerSection).toBe(4);
  });

  it("moves claude-fable-5 into the large group (was mistakenly grouped with Haiku)", () => {
    const fable = resolveModelProfile("claude-fable-5");
    expect(fable.maxOutputTokens).toBe(64000);
  });

  it("defines gpt-5-nano with raised continuation caps and provider params", () => {
    const nano = resolveModelProfile("gpt-5-nano");
    expect(nano.maxOutputTokens).toBe(32000);
    expect(nano.continuations).toEqual({
      generatePerSection: 8,
      textPerTurn: 8,
      nudgeMax: 10,
    });
    expect(nano.providerParams.generate).toMatchObject({
      reasoning_effort: "minimal",
      verbosity: "high",
    });
    expect(nano.providerParams.agent).toMatchObject({
      reasoning_effort: "medium",
    });
  });

  it("resolves claude-opus-5 to a defined profile (new model = profile addition)", () => {
    const opus = resolveModelProfile("claude-opus-5");
    // プロファイル追加のみで解決でき、UNKNOWN 既定に落ちない
    expect(opus).not.toEqual(UNKNOWN_MODEL_PROFILE);
    expect(opus.maxOutputTokens).toBe(64000);
    expect(opus.continuations.nudgeMax).toBe(2);
  });

  it("falls back to the conservative default for unknown models", () => {
    const profile = resolveModelProfile("gemini-3.5-flash");
    expect(profile).toEqual(UNKNOWN_MODEL_PROFILE);
    // 返り値の変更が既定に波及しない（deep copy）
    profile.continuations.nudgeMax = 999;
    expect(resolveModelProfile("gemini-3.5-flash").continuations.nudgeMax).toBe(
      UNKNOWN_MODEL_PROFILE.continuations.nudgeMax,
    );
  });

  it("applies DX_STUDIO_MODEL_PROFILES as a partial deep-merge override", () => {
    process.env.DX_STUDIO_MODEL_PROFILES = JSON.stringify({
      "gpt-5-nano": {
        continuations: { nudgeMax: 15 },
        providerParams: { generate: { verbosity: "low" } },
      },
    });
    const nano = resolveModelProfile("gpt-5-nano");
    expect(nano.continuations.nudgeMax).toBe(15);
    // 未指定フィールドは既定のまま
    expect(nano.continuations.generatePerSection).toBe(8);
    expect(nano.maxOutputTokens).toBe(32000);
    // providerParams はスロット内 shallow merge
    expect(nano.providerParams.generate).toMatchObject({
      reasoning_effort: "minimal",
      verbosity: "low",
    });
  });

  it("ignores invalid DX_STUDIO_MODEL_PROFILES JSON and keeps defaults", () => {
    process.env.DX_STUDIO_MODEL_PROFILES = "{ broken";
    const nano = resolveModelProfile("gpt-5-nano");
    expect(nano.continuations.nudgeMax).toBe(10);
  });

  it("ignores non-positive or non-integer override values", () => {
    process.env.DX_STUDIO_MODEL_PROFILES = JSON.stringify({
      "gpt-5-nano": {
        maxOutputTokens: -1,
        continuations: { nudgeMax: "many", textPerTurn: 0 },
      },
    });
    const nano = resolveModelProfile("gpt-5-nano");
    expect(nano.maxOutputTokens).toBe(32000);
    expect(nano.continuations.nudgeMax).toBe(10);
    expect(nano.continuations.textPerTurn).toBe(8);
  });

  it("reports the auto-nudge disable switch", () => {
    expect(isAutoNudgeDisabled()).toBe(false);
    process.env.DX_STUDIO_AUTO_NUDGE = "disabled";
    expect(isAutoNudgeDisabled()).toBe(true);
  });
});
