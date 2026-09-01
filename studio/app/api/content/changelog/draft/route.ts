import { z } from "zod";
import { resolveAiApiKey } from "@/lib/api-keys";
import { AI_KEY_ERROR } from "@/lib/agent/llm/anthropic";
import { resolveLlmProvider } from "@/lib/agent/llm/resolve-provider";
import { firstEntryDate } from "@/lib/changelog-entry";
import {
  baselineMsFromDate,
  buildDraftUserPrompt,
  buildTreeText,
  CHANGELOG_DRAFT_SYSTEM_PROMPT,
  collectUpdatedLessons,
  listLessons,
  parseDraftResponse,
  readChangelogFile,
  todayDateJst,
} from "@/lib/changelog-draft";
import { getProjectRoot } from "@/lib/project-root";

const bodySchema = z.object({
  /** 基準日の上書き（YYYY-MM-DD）。省略時は changelog 先頭エントリの日付 */
  since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * 変更履歴の AI 下書き。
 *
 * 出力は「新規エントリのテキスト」と「人向けメモ」だけ——ファイル全体を
 * 書かせない（追記のみの担保は構造で。挿入はクライアントが行う）。
 * ここでは正本に一切書き込まない——採否は人が差分を見て決める。
 */
export async function POST(req: Request) {
  let body: unknown = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "基準日は YYYY-MM-DD 形式で指定してください" },
      { status: 400 },
    );
  }

  const apiKey = resolveAiApiKey(req);
  if (!apiKey) {
    return Response.json({ error: AI_KEY_ERROR }, { status: 401 });
  }
  const providerResult = resolveLlmProvider(req);
  if (!providerResult.ok) {
    return Response.json(
      { error: providerResult.error },
      { status: providerResult.status },
    );
  }

  const projectRoot = getProjectRoot();
  const changelog = readChangelogFile(projectRoot);
  const baselineDate = parsed.data.since ?? firstEntryDate(changelog.content);
  const baselineMs = baselineMsFromDate(baselineDate);

  const { lessons, truncated } = collectUpdatedLessons(projectRoot, baselineMs);
  if (lessons.length === 0) {
    return Response.json({
      entry: null,
      notes: [],
      baselineDate,
      usedLessons: [],
      truncated: false,
      message: "基準日以降に更新されたレッスンがありません。基準日を指定し直すか、手で書いてください",
    });
  }

  const userPrompt = buildDraftUserPrompt({
    todayDate: todayDateJst(),
    changelogContent: changelog.content,
    treeText: buildTreeText(listLessons(projectRoot)),
    lessons,
    truncated,
  });

  // スキーマ検証つきで最大2回（初回＋修正指示のリトライ1回）
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: userPrompt },
  ];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // ⚠ maxTokens を絞りすぎないこと。モデルは大きい入力で自発的に thinking を
    // 出すことがあり（実測 2026-08-21）、1500 のような小さい値だと thinking が
    // 上限を食い尽くして可視テキストが空になったり、JSON が途中で切れたりする。
    // 省略してモデルプロファイルの既定（十分大きい値）に任せる
    const turn = await providerResult.provider.runTurn({
      apiKey,
      model: providerResult.model,
      system: CHANGELOG_DRAFT_SYSTEM_PROMPT,
      messages,
      tools: [],
      signal: req.signal,
    });

    const draft = parseDraftResponse(turn.text);
    if (draft) {
      return Response.json({
        entry: draft.entry,
        notes: draft.notes,
        baselineDate,
        usedLessons: lessons.map((l) => ({
          series: l.series,
          course: l.course,
          lesson: l.lesson,
        })),
        truncated,
      });
    }

    messages.push({ role: "assistant", content: turn.text });
    messages.push({
      role: "user",
      content:
        '出力が指定の JSON 形式ではありません。{"entry": "...", "notes": [...]} の JSON オブジェクトだけを出力し直してください。',
    });
  }

  // 空応答（上流ストリームが途中で切れた場合を含む）もここに落ちる。
  // 一時的な API 側の不調で起きうるため、メッセージは「もう一度」を促す
  return Response.json(
    { error: "AI の応答を解釈できませんでした。もう一度試してください" },
    { status: 502 },
  );
}
