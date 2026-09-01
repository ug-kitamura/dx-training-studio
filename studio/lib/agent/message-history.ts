import type { AgentLogicalTurn, LlmContentBlock } from "@/lib/agent/llm/types";

export type InvokeChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolEvents?: Array<{
    name: string;
    phase: "start" | "end";
    toolUseId?: string;
    input?: Record<string, unknown>;
    summary?: string;
    display: string;
    result?: string;
    tags?: string[];
  }>;
  /** 論理ターン列（優先）。無い場合は toolEvents からフォールバック再構成する */
  toolTurns?: AgentLogicalTurn[];
};

function appendLogicalTurns(
  llmMessages: Array<{
    role: "user" | "assistant";
    content: string | LlmContentBlock[];
  }>,
  turns: AgentLogicalTurn[],
): void {
  for (const turn of turns) {
    const assistantBlocks: LlmContentBlock[] = [];
    const text = turn.text?.trim();
    if (text) {
      assistantBlocks.push({ type: "text", text: turn.text! });
    }
    for (const call of turn.toolCalls ?? []) {
      assistantBlocks.push({
        type: "tool_use",
        id: call.id,
        name: call.name,
        input: call.input ?? {},
      });
    }
    if (assistantBlocks.length > 0) {
      llmMessages.push({ role: "assistant", content: assistantBlocks });
    }

    const toolCalls = turn.toolCalls ?? [];
    if (toolCalls.length > 0) {
      llmMessages.push({
        role: "user",
        content: toolCalls.map((call) => ({
          type: "tool_result" as const,
          tool_use_id: call.id,
          content: call.result,
        })),
      });
    }
  }
}

/** 旧形式: toolEvents を1ブロックに潰す（互換フォールバック） */
function appendLegacyToolEvents(
  llmMessages: Array<{
    role: "user" | "assistant";
    content: string | LlmContentBlock[];
  }>,
  message: InvokeChatMessage,
): void {
  const toolEvents = message.toolEvents ?? [];
  const starts = toolEvents.filter((event) => event.phase === "start");
  const ends = toolEvents.filter((event) => event.phase === "end");
  const assistantBlocks: LlmContentBlock[] = [];

  // 旧形式では時系列が失われているが、少なくとも tool → text よりは
  // tool を先に置き、最後に確認待ち文言を付ける方がマシ
  for (const end of ends) {
    const start = starts.find((event) => event.toolUseId === end.toolUseId);
    if (!start?.toolUseId) continue;
    assistantBlocks.push({
      type: "tool_use",
      id: start.toolUseId,
      name: start.name,
      input: start.input ?? {},
    });
  }

  const toolResults = ends
    .filter((event) => event.toolUseId && event.result)
    .map((event) => ({
      type: "tool_result" as const,
      tool_use_id: event.toolUseId!,
      content: event.result!,
    }));

  if (assistantBlocks.length > 0) {
    llmMessages.push({ role: "assistant", content: assistantBlocks });
  }
  if (toolResults.length > 0) {
    llmMessages.push({ role: "user", content: toolResults });
  }
  if (message.content.trim()) {
    llmMessages.push({ role: "assistant", content: message.content });
  } else if (assistantBlocks.length === 0) {
    llmMessages.push({ role: "assistant", content: message.content || " " });
  }
}

export function clientMessagesToLlmMessages(messages: InvokeChatMessage[]) {
  const llmMessages: Array<{
    role: "user" | "assistant";
    content: string | LlmContentBlock[];
  }> = [];

  for (const message of messages) {
    if (message.role === "user") {
      llmMessages.push({ role: "user", content: message.content });
      continue;
    }

    const turns = message.toolTurns;
    if (turns && turns.length > 0) {
      appendLogicalTurns(llmMessages, turns);
      // toolTurns に最終 text が含まれない場合の保険（旧クライアント混在）
      const lastTurn = turns[turns.length - 1];
      const lastHasTools = (lastTurn.toolCalls?.length ?? 0) > 0;
      const content = message.content.trim();
      if (content && lastHasTools) {
        const already = turns.some((turn) => turn.text?.trim() === content);
        if (!already) {
          llmMessages.push({ role: "assistant", content: message.content });
        }
      }
      continue;
    }

    if (message.toolEvents && message.toolEvents.length > 0) {
      appendLegacyToolEvents(llmMessages, message);
      continue;
    }

    llmMessages.push({ role: "assistant", content: message.content || " " });
  }

  return llmMessages;
}
