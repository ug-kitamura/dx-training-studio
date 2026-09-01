import type { AgentToolEvent, AgentLogicalTurn } from "@/lib/agent/llm/types";

export type AgentFileAttachment = {
  path: string;
  name: string;
};

export type AgentChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  toolEvents?: AgentToolEvent[];
  toolTurns?: AgentLogicalTurn[];
  attachments?: AgentFileAttachment[];
};

export type AgentChatSession = {
  id: string;
  title: string;
  messages: AgentChatMessage[];
  activeSkillId: string | null;
  createdAt: string;
  updatedAt: string;
  /** 直近ターンの可視トークン数（フォルダ往復で表示を残すため永続化）。未計測は null/未設定 */
  lastTurnTokens?: number | null;
  /** セッション累計の可視トークン数（同上） */
  sessionTokenTotal?: number;
};

export type AgentChatStorage = {
  version: 1;
  activeSessionId: string;
  sessions: AgentChatSession[];
};

import { STORAGE_KEYS } from "@/lib/storage-keys";

export const AGENT_CHAT_STORAGE_KEY = STORAGE_KEYS.agentChat;
export const MAX_AGENT_CHAT_SESSIONS = 10;
export const DEFAULT_SESSION_TITLE = "新しい会話";
export const SESSION_TITLE_TARGET_LENGTH = 30;
export const SESSION_TITLE_MAX_LENGTH = 40;

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function deriveSessionTitle(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return DEFAULT_SESSION_TITLE;
  if (trimmed.length <= SESSION_TITLE_MAX_LENGTH) return trimmed;
  return trimmed.slice(0, SESSION_TITLE_MAX_LENGTH);
}

export function isPlaceholderSessionTitle(
  title: string,
  firstUserContent: string,
): boolean {
  if (title === DEFAULT_SESSION_TITLE) return true;
  const trimmed = firstUserContent.trim();
  if (!trimmed) return title === DEFAULT_SESSION_TITLE;
  return title === deriveSessionTitle(trimmed);
}

export function createEmptySession(
  now = new Date().toISOString(),
): AgentChatSession {
  return {
    id: createSessionId(),
    title: DEFAULT_SESSION_TITLE,
    messages: [],
    activeSkillId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createInitialStorage(): AgentChatStorage {
  const session = createEmptySession();
  return {
    version: 1,
    activeSessionId: session.id,
    sessions: [session],
  };
}

function sortSessionsByUpdatedAt(
  sessions: AgentChatSession[],
): AgentChatSession[] {
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function enforceSessionLimit(
  sessions: AgentChatSession[],
): AgentChatSession[] {
  if (sessions.length <= MAX_AGENT_CHAT_SESSIONS) return sessions;
  const sorted = sortSessionsByUpdatedAt(sessions);
  return sorted.slice(0, MAX_AGENT_CHAT_SESSIONS);
}

export function parseAgentChatStorage(raw: unknown): AgentChatStorage | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as AgentChatStorage;
  if (
    parsed.version !== 1 ||
    !parsed.activeSessionId ||
    !Array.isArray(parsed.sessions)
  ) {
    return null;
  }
  const sessions = enforceSessionLimit(parsed.sessions);
  const activeSessionId = sessions.some((s) => s.id === parsed.activeSessionId)
    ? parsed.activeSessionId
    : (sessions[0]?.id ?? parsed.activeSessionId);
  return { version: 1, activeSessionId, sessions };
}

/**
 * FS へ保存できないときのフォールバック。
 *
 * **キーは 1 本だけ持つ。** サーバー側の保存先が単一（`lib/agent-session-store.ts` の
 * `AGENT_SESSION_PATH`）なので、フォーカス階層でキーを分けると両者で履歴が食い違う。
 * フォルダ別に分けていた頃の入れ子構造（`folders` マップと ino キーへの移行）は、
 * セッション一本化で不要になったため削除した。
 */
export function loadAgentSessionFallback(): AgentChatStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AGENT_CHAT_STORAGE_KEY);
    if (!raw) return null;
    return parseAgentChatStorage(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveAgentSessionFallback(storage: AgentChatStorage): boolean {
  if (typeof window === "undefined") return false;
  try {
    const normalized: AgentChatStorage = {
      version: 1,
      activeSessionId: storage.activeSessionId,
      sessions: enforceSessionLimit(storage.sessions),
    };
    localStorage.setItem(AGENT_CHAT_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function getActiveSession(
  storage: AgentChatStorage,
): AgentChatSession | undefined {
  return storage.sessions.find(
    (session) => session.id === storage.activeSessionId,
  );
}

export function updateActiveSession(
  storage: AgentChatStorage,
  updates: Partial<
    Pick<
      AgentChatSession,
      | "messages"
      | "activeSkillId"
      | "title"
      | "lastTurnTokens"
      | "sessionTokenTotal"
    >
  >,
): AgentChatStorage {
  const now = new Date().toISOString();
  const sessions = storage.sessions.map((session) => {
    if (session.id !== storage.activeSessionId) return session;
    return {
      ...session,
      ...updates,
      updatedAt: now,
    };
  });
  return { ...storage, sessions: enforceSessionLimit(sessions) };
}

export function addSession(storage: AgentChatStorage): AgentChatStorage {
  const session = createEmptySession();
  return enforceStorage({
    version: 1,
    activeSessionId: session.id,
    sessions: enforceSessionLimit([session, ...storage.sessions]),
  });
}

function enforceStorage(storage: AgentChatStorage): AgentChatStorage {
  const sessions = enforceSessionLimit(storage.sessions);
  const activeSessionId = sessions.some((s) => s.id === storage.activeSessionId)
    ? storage.activeSessionId
    : (sessions[0]?.id ?? storage.activeSessionId);
  return { version: 1, activeSessionId, sessions };
}

export function switchSession(
  storage: AgentChatStorage,
  sessionId: string,
): AgentChatStorage {
  if (!storage.sessions.some((session) => session.id === sessionId))
    return storage;
  return { ...storage, activeSessionId: sessionId };
}

export function normalizeStoredSessionTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "";
  if (trimmed.length <= SESSION_TITLE_MAX_LENGTH) return trimmed;
  return trimmed.slice(0, SESSION_TITLE_MAX_LENGTH);
}

export function updateSessionTitle(
  storage: AgentChatStorage,
  sessionId: string,
  title: string,
): AgentChatStorage {
  const normalized = normalizeStoredSessionTitle(title);
  if (!normalized) return storage;

  const now = new Date().toISOString();
  const sessions = storage.sessions.map((session) =>
    session.id === sessionId
      ? { ...session, title: normalized, updatedAt: now }
      : session,
  );
  return { ...storage, sessions: enforceSessionLimit(sessions) };
}

export function deleteSession(
  storage: AgentChatStorage,
  sessionId: string,
): AgentChatStorage {
  const remaining = storage.sessions.filter(
    (session) => session.id !== sessionId,
  );
  if (remaining.length === 0) {
    const fresh = createEmptySession();
    return { version: 1, activeSessionId: fresh.id, sessions: [fresh] };
  }
  const activeSessionId =
    storage.activeSessionId === sessionId
      ? remaining[0].id
      : storage.activeSessionId;
  return enforceStorage({ version: 1, activeSessionId, sessions: remaining });
}

export function listSessionsSorted(
  storage: AgentChatStorage,
): AgentChatSession[] {
  return sortSessionsByUpdatedAt(storage.sessions);
}

export function formatSessionUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatMessageTimestamp(message: AgentChatMessage): string {
  const iso = message.createdAt ?? messageTimestampFromId(message.id);
  if (!iso) return "";
  return formatSessionUpdatedAt(iso);
}

function messageTimestampFromId(id: string): string | null {
  const ms = Number.parseInt(id.split("-")[0] ?? "", 10);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

export function exportSessionAsMarkdown(session: AgentChatSession): string {
  const lines = [
    `# ${session.title}`,
    "",
    `Exported: ${new Date().toISOString()}`,
    "",
  ];
  for (const message of session.messages) {
    const heading = message.role === "user" ? "## User" : "## Assistant";
    lines.push(heading, "", message.content, "");
  }
  return lines.join("\n");
}

export function downloadSessionMarkdown(session: AgentChatSession): void {
  const markdown = exportSessionAsMarkdown(session);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `agent-chat-${date}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
