/**
 * 非ストリーミングの単発 Claude 呼び出し（画像プロンプト提案・Web 検索計画・
 * 社内コンテキスト整形などの API ルート共用）。
 * ストリーミング＋tool loop が要る Agent 系は lib/agent/llm/anthropic.ts を使う。
 */
export async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  options?: { maxTokens?: number },
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: options?.maxTokens ?? 2048,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  const data = (await res.json()) as {
    error?: { type?: string; message?: string };
    content?: Array<{ type: string; text?: string }>;
  };

  if (!res.ok) {
    const apiMessage = data.error?.message?.trim();
    const apiType = data.error?.type?.trim();
    const detail =
      apiMessage && apiType && !apiMessage.includes(apiType)
        ? `${apiType}: ${apiMessage}`
        : apiMessage || apiType;
    throw new Error(detail ?? "Claude API error");
  }

  const text = data.content
    ?.filter((chunk) => chunk.type === "text")
    .map((chunk) => chunk.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("empty Claude response");
  return text;
}
