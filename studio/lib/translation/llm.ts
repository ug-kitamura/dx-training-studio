/**
 * 翻訳 API 共通の LLM 実行。
 *
 * モデルはワークスペースのモデル設定に従う（studio-translation spec）——
 * 呼び出し側のルートが `resolveAiModel(req)` で解決した値を渡すこと。
 * ⚠ ここで既定値へフォールバックしない。翻訳だけ固定モデルにしていた頃の
 * 名残（`TRANSLATION_MODEL`）を復活させないこと——他の AI 機能と同じ
 * 解決経路に載せる、というのが今の決定。
 *
 * `resolveLlmProvider` を通さず `anthropicProvider` を直に叩いているのは、
 * 選べるモデルのうち非 Anthropic は `gpt-5-nano` だけで、それは
 * `resolveAiModel` が未対応として弾くため。
 */
import { anthropicProvider } from "@/lib/agent/llm/anthropic";
import { TRANSLATION_RETRY_PROMPT } from "@/lib/translation/prompts";

export type TranslationTurnResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status: number };

/**
 * スキーマ検証つきで最大2回（初回＋修正指示のリトライ1回）実行する。
 * ⚠ maxTokens は絞らない——大きい入力で自発 thinking が上限を食い尽くす実測がある
 * （changelog-draft の教訓）。省略してモデルプロファイルの既定に任せる
 */
export async function runTranslationTurn<T>(args: {
  apiKey: string;
  /** `resolveAiModel(req)` が返したモデル。ギアメニューの選択に従う */
  model: string;
  system: string;
  userPrompt: string;
  parse: (text: string) => T | null;
  signal: AbortSignal;
}): Promise<TranslationTurnResult<T>> {
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: args.userPrompt },
  ];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const turn = await anthropicProvider.runTurn({
      apiKey: args.apiKey,
      model: args.model,
      system: args.system,
      messages,
      tools: [],
      signal: args.signal,
    });

    const value = args.parse(turn.text);
    if (value !== null) return { ok: true, value };

    messages.push({ role: "assistant", content: turn.text });
    messages.push({ role: "user", content: TRANSLATION_RETRY_PROMPT });
  }
  // 空応答（上流ストリームの途中切断を含む）もここに落ちる
  return {
    ok: false,
    error: "AI の応答を解釈できませんでした。もう一度試してください",
    status: 502,
  };
}
