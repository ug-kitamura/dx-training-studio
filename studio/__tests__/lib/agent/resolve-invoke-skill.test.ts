import { describe, expect, it } from "vitest";
import {
  resolveInvokeSkillId,
  GENERAL_CHAT_SKILL_ID,
} from "@/lib/agent/resolve-invoke-skill";

describe("resolveInvokeSkillId", () => {
  it("returns general-chat when active skill is null", () => {
    expect(resolveInvokeSkillId(null)).toBe(GENERAL_CHAT_SKILL_ID);
  });

  it("returns active skill id when set", () => {
    expect(resolveInvokeSkillId("create-draft")).toBe("create-draft");
  });
});
