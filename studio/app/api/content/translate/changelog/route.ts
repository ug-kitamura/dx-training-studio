import { resolveAiApiKey } from "@/lib/api-keys";
import { resolveAiModel } from "@/lib/resolve-ai-model";
import { AI_KEY_ERROR } from "@/lib/agent/llm/anthropic";
import { getProjectRoot } from "@/lib/project-root";
import { runTranslationTurn } from "@/lib/translation/llm";
import {
  buildChangelogSystemPrompt,
  buildChangelogUserPrompt,
  parseChangelogResponse,
  readTranslationContract,
  TRANSLATION_CONTRACT_MISSING_ERROR,
} from "@/lib/translation/prompts";
import { readChangelogPair } from "@/lib/translation/units";

/**
 * changelog 追訳の下書き（studio-translation spec）。
 *
 * 英語版があれば「英語側に無い新しいエントリの英訳」だけを返す（`kind: "entries"`）。
 * 挿入はクライアントが行う——既存エントリに触れない担保は構造で（AI 下書きと同じ流儀）。
 * 英語版が無ければ全文の英訳（`kind: "full"`）。正本には書かない。
 */
export async function POST(req: Request) {
  const apiKey = resolveAiApiKey(req);
  if (!apiKey) {
    return Response.json({ error: AI_KEY_ERROR }, { status: 401 });
  }

  // モデルはギアメニューの選択に従う（未対応モデルは他の AI 機能と同じエラー）
  const model = resolveAiModel(req);
  if (!model.ok) {
    return Response.json({ error: model.error }, { status: 400 });
  }

  const projectRoot = getProjectRoot();
  const contract = readTranslationContract(projectRoot);
  if (!contract) {
    return Response.json(
      { error: TRANSLATION_CONTRACT_MISSING_ERROR },
      { status: 500 },
    );
  }

  const pair = readChangelogPair(projectRoot);
  if (!pair) {
    return Response.json(
      { error: "変更履歴（contents/changelog.md）がありません" },
      { status: 404 },
    );
  }

  const result = await runTranslationTurn({
    apiKey,
    model: model.model,
    system: buildChangelogSystemPrompt(contract),
    userPrompt: buildChangelogUserPrompt(pair),
    parse: parseChangelogResponse,
    signal: req.signal,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ kind: result.value.kind, text: result.value.text });
}
