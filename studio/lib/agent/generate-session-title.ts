import {
  deriveSessionTitle,
  SESSION_TITLE_MAX_LENGTH,
  SESSION_TITLE_TARGET_LENGTH,
} from "@/lib/agent-chat-storage";
import { resolveAiApiKey } from "@/lib/api-keys";
import { AI_KEY_ERROR } from "@/lib/agent/llm/anthropic";
import type { LlmMessage } from "@/lib/agent/llm/types";
import { resolveLlmProvider } from "@/lib/agent/llm/resolve-provider";

export { SESSION_TITLE_MAX_LENGTH, SESSION_TITLE_TARGET_LENGTH };
export const SESSION_TITLE_CONTENT_TRUNCATE = 500;

export const SESSION_TITLE_SYSTEM_PROMPT = `あなたは会話タイトル生成器です。
以下の会話の内容を表す短いタイトルを1行だけ出力してください。

ルール:
- 日本語
- 30文字程度を目標（最大40文字）
- 名詞句または短い文
- 引用符・句読点・説明は不要
- 会話の主題が伝わること`;

export type TitleGenerationMessage = {
  role: "user" | "assistant";
  content: string;
};

export function truncateMessageContent(
  content: string,
  maxLength = SESSION_TITLE_CONTENT_TRUNCATE,
): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

export function normalizeSessionTitle(
  raw: string,
  maxLength = SESSION_TITLE_MAX_LENGTH,
): string {
  const singleLine = raw
    .trim()
    .replace(/^["'「『]+|["'」』]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!singleLine) {
    return deriveSessionTitle("");
  }
  if (singleLine.length <= maxLength) return singleLine;
  return singleLine.slice(0, maxLength);
}

export function buildTitleGenerationUserPrompt(
  messages: TitleGenerationMessage[],
): string {
  const lines = messages.map((message) => {
    const role = message.role === "user" ? "User" : "Assistant";
    return `${role}: ${truncateMessageContent(message.content)}`;
  });
  return lines.join("\n\n");
}

export function buildTitleGenerationMessages(
  messages: TitleGenerationMessage[],
): LlmMessage[] {
  return [
    {
      role: "user",
      content: buildTitleGenerationUserPrompt(messages),
    },
  ];
}

export function hasTitleGenerationExchange(
  messages: TitleGenerationMessage[],
): boolean {
  return (
    messages.some(
      (message) => message.role === "user" && message.content.trim(),
    ) &&
    messages.some(
      (message) => message.role === "assistant" && message.content.trim(),
    )
  );
}

export type GenerateSessionTitleResult =
  | { ok: true; title: string }
  | { ok: false; error: string; status: number };

export async function generateSessionTitle(
  req: Request,
  messages: TitleGenerationMessage[],
): Promise<GenerateSessionTitleResult> {
  if (!hasTitleGenerationExchange(messages)) {
    return { ok: false, error: "Invalid request body", status: 400 };
  }

  const apiKey = resolveAiApiKey(req);
  if (!apiKey) {
    return { ok: false, error: AI_KEY_ERROR, status: 401 };
  }

  const providerResult = resolveLlmProvider(req);
  if (!providerResult.ok) {
    return {
      ok: false,
      error: providerResult.error,
      status: providerResult.status,
    };
  }

  const firstExchange = extractFirstExchange(messages);
  const turn = await providerResult.provider.runTurn({
    apiKey,
    model: providerResult.model,
    system: SESSION_TITLE_SYSTEM_PROMPT,
    messages: buildTitleGenerationMessages(firstExchange),
    tools: [],
    maxTokens: 60,
    signal: req.signal,
  });

  const title = normalizeSessionTitle(turn.text);
  if (!title || title === deriveSessionTitle("")) {
    return { ok: false, error: "Empty model response", status: 502 };
  }

  return { ok: true, title };
}

function extractFirstExchange(
  messages: TitleGenerationMessage[],
): TitleGenerationMessage[] {
  const result: TitleGenerationMessage[] = [];
  for (const message of messages) {
    if (!message.content.trim()) continue;
    result.push({
      role: message.role,
      content: message.content,
    });
    if (
      result.some((item) => item.role === "user") &&
      result.some((item) => item.role === "assistant")
    ) {
      break;
    }
  }
  return result;
}
