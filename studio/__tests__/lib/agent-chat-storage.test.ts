import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_CHAT_STORAGE_KEY,
  addSession,
  createEmptySession,
  createInitialStorage,
  DEFAULT_SESSION_TITLE,
  deleteSession,
  deriveSessionTitle,
  enforceSessionLimit,
  exportSessionAsMarkdown,
  formatMessageTimestamp,
  getActiveSession,
  isPlaceholderSessionTitle,
  loadAgentSessionFallback,
  MAX_AGENT_CHAT_SESSIONS,
  saveAgentSessionFallback,
  switchSession,
  updateActiveSession,
  updateSessionTitle,
} from "@/lib/agent-chat-storage";

describe("agent-chat-storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("creates initial storage when empty", () => {
    const storage = createInitialStorage();
    expect(storage.sessions).toHaveLength(1);
    expect(storage.activeSessionId).toBe(storage.sessions[0]?.id);
    expect(storage.sessions[0]?.title).toBe(DEFAULT_SESSION_TITLE);
  });

  it("persists and restores sessions", () => {
    const initial = createInitialStorage();
    const withMessage = updateActiveSession(initial, {
      messages: [{ id: "m1", role: "user", content: "hello" }],
      activeSkillId: "create-draft",
      title: deriveSessionTitle("hello"),
    });
    saveAgentSessionFallback(withMessage);

    const loaded = loadAgentSessionFallback();
    expect(loaded?.sessions[0]?.messages).toEqual([
      { id: "m1", role: "user", content: "hello" },
    ]);
    expect(loaded?.sessions[0]?.activeSkillId).toBe("create-draft");
    expect(loaded?.sessions[0]?.title).toBe("hello");
  });

  it("derives session title up to max length without ellipsis", () => {
    const atLimit = "あ".repeat(40);
    expect(deriveSessionTitle(atLimit)).toBe(atLimit);
    const overLimit = "あ".repeat(50);
    expect(deriveSessionTitle(overLimit)).toBe("あ".repeat(40));
  });

  it("updates session title by id", () => {
    const initial = createInitialStorage();
    const sessionId = initial.activeSessionId;
    const next = updateSessionTitle(initial, sessionId, "  カスタムタイトル  ");
    expect(getActiveSession(next)?.title).toBe("カスタムタイトル");
  });

  it("rejects empty session title updates", () => {
    const initial = createInitialStorage();
    const next = updateSessionTitle(initial, initial.activeSessionId, "   ");
    expect(next).toBe(initial);
  });

  it("detects placeholder session titles", () => {
    expect(isPlaceholderSessionTitle("新しい会話", "")).toBe(true);
    expect(isPlaceholderSessionTitle("hello", "hello")).toBe(true);
    expect(isPlaceholderSessionTitle("カスタムタイトル", "hello")).toBe(false);
  });

  it("drops oldest sessions when exceeding limit", () => {
    const now = Date.now();
    const sessions = Array.from(
      { length: MAX_AGENT_CHAT_SESSIONS + 1 },
      (_, index) => ({
        ...createEmptySession(new Date(now - index * 1000).toISOString()),
        title: `session-${index}`,
      }),
    );
    const trimmed = enforceSessionLimit(sessions);
    expect(trimmed).toHaveLength(MAX_AGENT_CHAT_SESSIONS);
    expect(
      trimmed.some(
        (session) => session.title === `session-${MAX_AGENT_CHAT_SESSIONS}`,
      ),
    ).toBe(false);
  });

  it("adds and switches sessions", () => {
    const initial = createInitialStorage();
    const firstId = initial.activeSessionId;
    const withMessage = updateActiveSession(initial, {
      messages: [{ id: "m1", role: "user", content: "first" }],
    });
    const next = addSession(withMessage);
    expect(next.activeSessionId).not.toBe(firstId);
    expect(next.sessions).toHaveLength(2);

    const switched = switchSession(next, firstId);
    expect(switched.activeSessionId).toBe(firstId);
  });

  it("deletes session and creates fresh one when last session removed", () => {
    const initial = createInitialStorage();
    const next = deleteSession(initial, initial.activeSessionId);
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0]?.messages).toEqual([]);
  });

  it("exports markdown", () => {
    const session = {
      ...createEmptySession(),
      title: "Test chat",
      messages: [
        { id: "u1", role: "user" as const, content: "質問" },
        { id: "a1", role: "assistant" as const, content: "回答" },
      ],
    };
    const markdown = exportSessionAsMarkdown(session);
    expect(markdown).toContain("# Test chat");
    expect(markdown).toContain("## User");
    expect(markdown).toContain("質問");
    expect(markdown).toContain("## Assistant");
    expect(markdown).toContain("回答");
  });

  it("フォールバックはキーを 1 本しか使わない", () => {
    const initial = createInitialStorage();
    saveAgentSessionFallback(initial);

    expect(loadAgentSessionFallback()?.activeSessionId).toBe(
      initial.activeSessionId,
    );
    // スコープ別のキーを作らない（サーバー側の保存先が単一のため）
    expect(Object.keys(localStorage)).toEqual([AGENT_CHAT_STORAGE_KEY]);
  });

  it("returns false when localStorage throws on save", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(saveAgentSessionFallback(createInitialStorage())).toBe(false);
    expect(localStorage.getItem(AGENT_CHAT_STORAGE_KEY)).toBeNull();
  });

  it("formats message timestamp from createdAt", () => {
    const message = {
      id: "1",
      role: "user" as const,
      content: "hello",
      createdAt: "2026-06-14T14:30:00.000Z",
    };
    expect(formatMessageTimestamp(message)).toContain("6/14");
  });
});
