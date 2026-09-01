import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { AgentChatPane } from "@/components/workspace/AgentChatPane";
import type {
  AgentChatSession,
  AgentChatStorage,
} from "@/lib/agent-chat-storage";

function makeSession(suffix: string): AgentChatSession {
  const now = new Date().toISOString();
  return {
    id: `session--${suffix}`,
    title: "保存済みの会話",
    messages: [
      {
        id: `msg--${suffix}`,
        role: "user",
        content: "保存済みのメッセージ",
        createdAt: now,
      },
    ],
    activeSkillId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeStorage(): AgentChatStorage {
  const session = makeSession("s1");
  return { version: 1, activeSessionId: session.id, sessions: [session] };
}

let saved: AgentChatStorage[];
let stored: AgentChatStorage | null;
let loadCount: number;

function installFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      if (input === "/api/agent/session") {
        if (init?.method === "PUT") {
          const storage = JSON.parse(String(init.body)) as AgentChatStorage;
          saved.push(storage);
          stored = storage;
          return { ok: true, json: async () => ({ ok: true }) };
        }
        loadCount += 1;
        if (!stored) {
          return { ok: false, status: 404, json: async () => ({}) };
        }
        const snapshot = stored;
        return { ok: true, json: async () => snapshot };
      }
      return { ok: true, json: async () => ({}) };
    }),
  );
}

/** ペイン4 と同じ描画。key を渡さない（フォーカス変更でリマウントしない）。 */
function Harness({ scopeKey }: { scopeKey: string }) {
  return (
    <AgentChatPane
      scopeKey={scopeKey}
      currentFilePath={null}
      onOpenSettings={() => {}}
      skills={[]}
    />
  );
}

describe("AgentChatPane はフォーカス変更でセッションを切り替えない", () => {
  beforeEach(() => {
    saved = [];
    stored = makeStorage();
    loadCount = 0;
    installFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("スコープが変わっても表示中の会話が残る", async () => {
    const view = render(<Harness scopeKey="シリーズA/コースB/レッスンC" />);
    expect(await screen.findByText("保存済みのメッセージ")).toBeVisible();

    view.rerender(<Harness scopeKey="シリーズX" />);

    expect(screen.getByText("保存済みのメッセージ")).toBeVisible();
  });

  it("スコープが変わってもセッションを読み直さない", async () => {
    const view = render(<Harness scopeKey="シリーズA/コースB/レッスンC" />);
    await screen.findByText("保存済みのメッセージ");
    expect(loadCount).toBe(1);

    view.rerender(<Harness scopeKey="シリーズX" />);
    view.rerender(<Harness scopeKey="シリーズY/コースZ" />);

    // 読み直すと実行中の会話の表示を失うため、マウント時の 1 回だけであること
    await waitFor(() => {
      expect(loadCount).toBe(1);
    });
  });

  it("スコープが変わっても未送信の入力が消えない", async () => {
    const view = render(<Harness scopeKey="シリーズA/コースB/レッスンC" />);
    await screen.findByText("保存済みのメッセージ");

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "書きかけ" },
    });

    view.rerender(<Harness scopeKey="シリーズX" />);

    expect(screen.getByRole("textbox")).toHaveValue("書きかけ");
  });

  it("保存はスコープを問わず同じ 1 本へ書く", async () => {
    const view = render(<Harness scopeKey="シリーズA/コースB/レッスンC" />);
    await screen.findByText("保存済みのメッセージ");

    view.rerender(<Harness scopeKey="シリーズX" />);
    fireEvent.click(screen.getByRole("button", { name: /新規/ }));

    await waitFor(() => {
      expect(saved.length).toBeGreaterThan(0);
    });
    // 保存先はクエリを持たない単一エンドポイント。スコープ別のファイルは生まれない
    const fetchMock = globalThis.fetch as unknown as {
      mock: { calls: [string, RequestInit?][] };
    };
    const sessionCalls = fetchMock.mock.calls
      .map(([url]) => url)
      .filter((url) => url.startsWith("/api/agent/session"));
    expect(sessionCalls.every((url) => url === "/api/agent/session")).toBe(true);
  });
});
