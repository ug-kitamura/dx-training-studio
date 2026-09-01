import { describe, expect, it, vi, afterEach } from "vitest";
import {
  saveAgentSessionFallback,
  createInitialStorage,
  AGENT_CHAT_STORAGE_KEY,
} from "@/lib/agent-chat-storage";

describe("saveAgentSessionFallback failure", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    try {
      localStorage.removeItem(AGENT_CHAT_STORAGE_KEY);
    } catch {
      // ignore
    }
  });

  it("returns false when localStorage.setItem throws", () => {
    const storage = createInitialStorage();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => undefined,
    });

    expect(saveAgentSessionFallback(storage)).toBe(false);
  });
});
