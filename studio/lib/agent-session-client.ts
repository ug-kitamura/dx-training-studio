import {
  createInitialStorage,
  loadAgentSessionFallback,
  saveAgentSessionFallback,
  type AgentChatStorage,
} from "@/lib/agent-chat-storage";

/**
 * Agent 会話の読み書き。保存先はサーバー・localStorage フォールバックとも**単一**で、
 * ペイン1〜3 のフォーカスによって切り替わらない——スキルの 1 実行は複数フォルダを
 * 横断して書くため、フォーカス先に会話を紐づけると後から探せなくなる。
 */
export async function loadAgentSession(): Promise<AgentChatStorage> {
  try {
    const res = await fetch("/api/agent/session");
    if (res.ok) {
      const data = (await res.json()) as AgentChatStorage;
      if (data.version === 1 && Array.isArray(data.sessions)) {
        return data;
      }
    }
  } catch {
    /* fall through to localStorage */
  }

  return loadAgentSessionFallback() ?? createInitialStorage();
}

export async function saveAgentSession(
  storage: AgentChatStorage,
): Promise<boolean> {
  try {
    const res = await fetch("/api/agent/session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(storage),
    });
    if (res.ok) return true;
  } catch {
    /* fall through */
  }

  return saveAgentSessionFallback(storage);
}
