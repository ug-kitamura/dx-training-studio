import { z } from "zod";
import {
  AI_KEY_ERROR,
  resolveAiApiKey,
  resolvePixabayApiKey,
} from "@/lib/api-keys";
import { callClaude } from "@/lib/anthropic-messages";
import { resolveAiModel } from "@/lib/resolve-ai-model";
import { lessonSchema } from "@/lib/schema";
import { executeWebImageSearch } from "@/lib/web-image-search";
import {
  buildWebSearchPlanMessages,
  parseWebSearchPlanResponse,
} from "@/lib/web-image-search-plan";
import { getProjectRoot } from "@/lib/project-root";

const bodySchema = z.object({
  // レッスン未選択でも検索できるよう任意。無ければ文脈ブロックを添えない
  lesson: lessonSchema.optional(),
  prompt: z.string().min(1),
});

export async function POST(req: Request) {
  const aiKey = resolveAiApiKey(req);
  if (!aiKey) {
    return Response.json({ error: AI_KEY_ERROR }, { status: 401 });
  }

  const pixabayKey = resolvePixabayApiKey(req);
  if (!pixabayKey) {
    return Response.json(
      { error: "Pixabay API キーが未設定です。設定ダイアログから入力するか、`.env.local` に PIXABAY_API_KEY を設定してください。" },
      { status: 401 },
    );
  }

  const modelResult = resolveAiModel(req);
  if (!modelResult.ok) {
    return Response.json({ error: modelResult.error }, { status: 400 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json: unknown = await req.json();
    parsed = bodySchema.parse(json);
  } catch {
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const { system, user } = buildWebSearchPlanMessages(parsed.lesson, parsed.prompt.trim());

  let plan: ReturnType<typeof parseWebSearchPlanResponse>;
  try {
    const raw = await callClaude(aiKey, modelResult.model, system, user);
    plan = parseWebSearchPlanResponse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "検索計画の生成に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }

  try {
    const results = await executeWebImageSearch(getProjectRoot(), pixabayKey, plan);
    if (results.length === 0) {
      return Response.json(
        { error: "条件に合う画像が見つかりませんでした。プロンプトを変えて再試行してください。" },
        { status: 404 },
      );
    }
    return Response.json({
      results: results.map(({ file, alt }) => ({ file, alt })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "画像の検索に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
