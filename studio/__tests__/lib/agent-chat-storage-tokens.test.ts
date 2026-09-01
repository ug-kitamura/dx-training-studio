import { describe, expect, it } from "vitest";
import {
  createInitialStorage,
  updateActiveSession,
  parseAgentChatStorage,
  getActiveSession,
} from "@/lib/agent-chat-storage";

describe("agent chat storage token persistence", () => {
  it("stores last-turn and session-total tokens on the active session", () => {
    const storage = createInitialStorage();
    const next = updateActiveSession(storage, {
      lastTurnTokens: 123,
      sessionTokenTotal: 456,
    });
    const session = getActiveSession(next);
    expect(session?.lastTurnTokens).toBe(123);
    expect(session?.sessionTokenTotal).toBe(456);
  });

  it("round-trips token fields through parseAgentChatStorage (folder switch away/back)", () => {
    const storage = updateActiveSession(createInitialStorage(), {
      lastTurnTokens: 789,
      sessionTokenTotal: 1000,
    });
    // 保存 → 読み込み相当（JSON 経由）でトークンが落ちないこと
    const roundTripped = parseAgentChatStorage(
      JSON.parse(JSON.stringify(storage)),
    );
    const session = roundTripped ? getActiveSession(roundTripped) : undefined;
    expect(session?.lastTurnTokens).toBe(789);
    expect(session?.sessionTokenTotal).toBe(1000);
  });
});
