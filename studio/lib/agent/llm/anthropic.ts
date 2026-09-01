import type {
  LlmCacheControl,
  LlmContentBlock,
  LlmMessage,
  ProviderTurnResult,
  StreamEvent,
  ToolCall,
  ToolDefinition,
} from "@/lib/agent/llm/types";
import type {
  LlmProvider,
  LlmProviderRunOptions,
} from "@/lib/agent/llm/provider";
import { DEFAULT_AI_MODEL } from "@/lib/ai-models";
import { resolveAiModel } from "@/lib/resolve-ai-model";
import { resolveModelProfile } from "@/lib/agent/model-profiles";

const EPHEMERAL_CACHE_CONTROL: LlmCacheControl = { type: "ephemeral" };

export const DEFAULT_MODEL = DEFAULT_AI_MODEL;
// キー未設定文言の正本は lib/api-keys.ts（サーバーとクライアントの一致判定に使うため一本化）
import { AI_KEY_ERROR } from "@/lib/api-keys";
export { AI_KEY_ERROR };

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

export function resolveAnthropicModel(req?: Request): string {
  if (req) {
    const result = resolveAiModel(req);
    if (result.ok) return result.model;
  }
  return process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

type AnthropicContentBlock =
  | { type: "text"; text: string; cache_control?: LlmCacheControl }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
      cache_control?: LlmCacheControl;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      cache_control?: LlmCacheControl;
    };

type AnthropicApiMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

type AnthropicSystemBlock = {
  type: "text";
  text: string;
  cache_control?: LlmCacheControl;
};

function toAnthropicMessages(messages: LlmMessage[]): AnthropicApiMessage[] {
  return messages.map((message) => {
    if (typeof message.content === "string") {
      return { role: message.role, content: message.content };
    }
    return {
      role: message.role,
      content: message.content.map((block) => {
        switch (block.type) {
          case "text":
            return {
              type: "text" as const,
              text: block.text,
              ...(block.cache_control
                ? { cache_control: block.cache_control }
                : {}),
            };
          case "tool_use":
            return {
              type: "tool_use" as const,
              id: block.id,
              name: block.name,
              input: block.input,
              ...(block.cache_control
                ? { cache_control: block.cache_control }
                : {}),
            };
          case "tool_result":
            return {
              type: "tool_result" as const,
              tool_use_id: block.tool_use_id,
              content: block.content,
              ...(block.cache_control
                ? { cache_control: block.cache_control }
                : {}),
            };
        }
      }),
    };
  });
}

/** system 文字列を prompt caching 対応のブロック配列へ変換する（空文字は従来どおり文字列のまま） */
function withSystemCacheControl(
  system: string,
): string | AnthropicSystemBlock[] {
  if (!system.trim()) return system;
  return [
    { type: "text", text: system, cache_control: EPHEMERAL_CACHE_CONTROL },
  ];
}

/** 末尾のツール定義にのみ cache_control を付与する（元の配列は変更しない） */
function withToolsCacheControl(
  tools: ToolDefinition[],
): ToolDefinition[] | undefined {
  if (tools.length === 0) return undefined;
  const lastIndex = tools.length - 1;
  return [
    ...tools.slice(0, lastIndex),
    { ...tools[lastIndex], cache_control: EPHEMERAL_CACHE_CONTROL },
  ];
}

/**
 * 最新メッセージの最終コンテンツブロックへ cache_control を付与する。
 * `toAnthropicMessages` が毎回新しい配列・オブジェクトを作るため、呼び出し元の
 * `LlmMessage[]` を破壊せず、過去ターンへ古いブレークポイントが蓄積することもない。
 */
function withMessagesCacheControl(
  messages: AnthropicApiMessage[],
): AnthropicApiMessage[] {
  if (messages.length === 0) return messages;
  const lastIndex = messages.length - 1;
  const last = messages[lastIndex];
  const content: AnthropicContentBlock[] =
    typeof last.content === "string"
      ? last.content
        ? [{ type: "text", text: last.content }]
        : []
      : last.content;
  if (content.length === 0) return messages;

  const lastBlockIndex = content.length - 1;
  const updatedContent = [
    ...content.slice(0, lastBlockIndex),
    { ...content[lastBlockIndex], cache_control: EPHEMERAL_CACHE_CONTROL },
  ];
  return [
    ...messages.slice(0, lastIndex),
    { ...last, content: updatedContent },
  ];
}

function buildAssistantContent(result: ProviderTurnResult): LlmContentBlock[] {
  const blocks: LlmContentBlock[] = [];
  if (result.text) {
    blocks.push({ type: "text", text: result.text });
  }
  for (const call of result.toolCalls) {
    blocks.push({
      type: "tool_use",
      id: call.id,
      name: call.name,
      input: call.input,
    });
  }
  return blocks;
}

export function buildToolResultMessages(
  toolCalls: ToolCall[],
  results: string[],
): LlmMessage[] {
  if (toolCalls.length === 0) return [];
  return [
    {
      role: "user",
      content: toolCalls.map((call, index) => ({
        type: "tool_result" as const,
        tool_use_id: call.id,
        content: results[index] ?? "{}",
      })),
    },
  ];
}

export function buildAssistantToolUseMessage(
  result: ProviderTurnResult,
): LlmMessage | null {
  const content = buildAssistantContent(result);
  if (content.length === 0) return null;
  return { role: "assistant", content };
}

/**
 * `message_start` イベントの usage から prompt caching の効果を観測し、サーバログへ出力する。
 * 効果検証のみが目的のため、取得・パースに失敗してもストリーム処理には一切影響させない。
 */
function logCacheUsage(event: Record<string, unknown>): void {
  try {
    const message = event.message as
      | { usage?: Record<string, unknown> }
      | undefined;
    const usage = message?.usage;
    if (!usage) return;
    const cacheRead =
      typeof usage.cache_read_input_tokens === "number"
        ? usage.cache_read_input_tokens
        : 0;
    const cacheCreation =
      typeof usage.cache_creation_input_tokens === "number"
        ? usage.cache_creation_input_tokens
        : 0;
    const inputTokens =
      typeof usage.input_tokens === "number" ? usage.input_tokens : undefined;
    if (cacheRead === 0 && cacheCreation === 0 && inputTokens === undefined) {
      return;
    }
    console.log(
      `[anthropic] prompt cache usage: read=${cacheRead} creation=${cacheCreation} input=${inputTokens ?? "?"}`,
    );
  } catch {
    // 観測の失敗はリクエスト処理に影響させない
  }
}

export async function* parseAnthropicStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const toolBlocks: Array<{
    id: string;
    name: string;
    inputJson: string;
    input?: Record<string, unknown>;
    inputParseError?: boolean;
  }> = [];
  let stopReason: ProviderTurnResult["stopReason"] = "unknown";
  let outputTokens: number | undefined;

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const lines = chunk.split("\n");
        const dataLine = lines.find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        const payload = dataLine.slice("data: ".length).trim();
        if (!payload || payload === "[DONE]") continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          continue;
        }

        switch (event.type) {
          case "message_start": {
            logCacheUsage(event);
            break;
          }
          case "content_block_start": {
            const index = event.index as number | undefined;
            const contentBlock = event.content_block as
              | { type?: string; id?: string; name?: string }
              | undefined;
            if (
              contentBlock?.type === "tool_use" &&
              contentBlock.id &&
              contentBlock.name &&
              typeof index === "number"
            ) {
              toolBlocks[index] = {
                id: contentBlock.id,
                name: contentBlock.name,
                inputJson: "",
              };
            }
            break;
          }
          case "content_block_delta": {
            const delta = event.delta as
              | { type?: string; text?: string; partial_json?: string }
              | undefined;
            if (delta?.type === "text_delta" && delta.text) {
              text += delta.text;
              yield { type: "text_delta", text: delta.text };
            }
            if (delta?.type === "input_json_delta" && delta.partial_json) {
              const index = event.index as number | undefined;
              const block =
                typeof index === "number" ? toolBlocks[index] : undefined;
              if (block) block.inputJson += delta.partial_json;
            }
            break;
          }
          case "content_block_stop": {
            const index = event.index as number | undefined;
            const block =
              typeof index === "number" ? toolBlocks[index] : undefined;
            if (block?.inputJson) {
              try {
                block.input = JSON.parse(block.inputJson) as Record<
                  string,
                  unknown
                >;
              } catch {
                block.input = {};
                block.inputParseError = true;
              }
            }
            break;
          }
          case "message_delta": {
            const delta = event.delta as { stop_reason?: string } | undefined;
            if (delta?.stop_reason === "tool_use") stopReason = "tool_use";
            if (delta?.stop_reason === "end_turn") stopReason = "end_turn";
            if (delta?.stop_reason === "max_tokens") stopReason = "max_tokens";
            const usage = event.usage as { output_tokens?: number } | undefined;
            if (typeof usage?.output_tokens === "number") {
              outputTokens = usage.output_tokens;
            }
            break;
          }
          default:
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const calls: ToolCall[] = toolBlocks
    .filter((block): block is NonNullable<typeof block> => block !== undefined)
    .map((block) => ({
      id: block.id,
      name: block.name,
      input: block.input ?? {},
      ...(block.inputParseError ? { inputParseError: true as const } : {}),
      ...(block.inputParseError && block.inputJson
        ? { partialJson: block.inputJson }
        : {}),
    }));

  if (calls.length > 0 && stopReason === "unknown") {
    stopReason = "tool_use";
  }
  if (calls.length === 0 && stopReason === "unknown") {
    stopReason = "end_turn";
  }

  yield {
    type: "turn_complete",
    result: {
      text,
      toolCalls: calls,
      stopReason,
      ...(outputTokens !== undefined ? { outputTokens } : {}),
    },
  };
}

async function runAnthropicTurn(
  options: LlmProviderRunOptions,
): Promise<Response> {
  const messages = withMessagesCacheControl(
    toAnthropicMessages(options.messages),
  );
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.maxTokens ?? resolveModelProfile(options.model).maxOutputTokens,
      stream: true,
      system: withSystemCacheControl(options.system),
      messages,
      tools: withToolsCacheControl(options.tools),
    }),
    signal: options.signal,
  });
}

export const anthropicProvider: LlmProvider = {
  async runTurn(options) {
    for await (const event of this.streamTurn(options)) {
      if (event.type === "turn_complete") return event.result;
    }
    return { text: "", toolCalls: [], stopReason: "unknown" };
  },

  async *streamTurn(options) {
    const upstream = await runAnthropicTurn(options);
    if (!upstream.ok) {
      let message = "Anthropic API error";
      try {
        const data = (await upstream.json()) as {
          error?: { type?: string; message?: string };
        };
        const apiMessage = data.error?.message?.trim();
        const apiType = data.error?.type?.trim();
        message =
          apiMessage && apiType && !apiMessage.includes(apiType)
            ? `${apiType}: ${apiMessage}`
            : apiMessage || apiType || message;
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }
    if (!upstream.body) {
      throw new Error("empty Anthropic response");
    }
    yield* parseAnthropicStream(upstream.body, options.signal);
  },
};

export async function streamAnthropicMessages(options: {
  req: Request;
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}): Promise<Response> {
  const { resolveAiApiKey } = await import("@/lib/api-keys");
  const apiKey = resolveAiApiKey(options.req);
  if (!apiKey) {
    return Response.json({ error: AI_KEY_ERROR }, { status: 401 });
  }

  const modelResult = resolveAiModel(options.req);
  if (!modelResult.ok) {
    return Response.json({ error: modelResult.error }, { status: 400 });
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelResult.model,
      max_tokens:
        options.maxTokens ??
        resolveModelProfile(modelResult.model).maxOutputTokens,
      stream: true,
      system: options.system,
      messages: options.messages,
    }),
  });

  if (!upstream.ok) {
    let message = "Anthropic API error";
    try {
      const data = (await upstream.json()) as {
        error?: { type?: string; message?: string };
      };
      const apiMessage = data.error?.message?.trim();
      const apiType = data.error?.type?.trim();
      message =
        apiMessage && apiType && !apiMessage.includes(apiType)
          ? `${apiType}: ${apiMessage}`
          : apiMessage || apiType || message;
    } catch {
      // ignore parse errors
    }
    return Response.json({ error: message }, { status: upstream.status });
  }

  if (!upstream.body) {
    return Response.json(
      { error: "empty Anthropic response" },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export {
  toAnthropicMessages,
  buildAssistantContent,
  withSystemCacheControl,
  withToolsCacheControl,
  withMessagesCacheControl,
};
