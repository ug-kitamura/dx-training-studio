import { z } from "zod";
import { AI_KEY_ERROR, resolveAiApiKey } from "@/lib/api-keys";
import { callClaude } from "@/lib/anthropic-messages";
import {
  buildImageGenerationMessages,
  parseAiGenerationResponse,
} from "@/lib/ai-image-prompt";
import { resolveUniquePngFileName } from "@/lib/image-slug";
import { saveStagingImage } from "@/lib/image-store";
import {
  buildSmallWidthWarning,
  renderDiagramToPng,
} from "@/lib/render-diagram-capture.mjs";
import { resolveAiModel } from "@/lib/resolve-ai-model";
import { lessonSchema } from "@/lib/schema";
import { getProjectRoot } from "@/lib/project-root";

const bodySchema = z.object({
  // レッスン未選択でも生成できるよう任意。無ければ文脈ブロックを添えない
  lesson: lessonSchema.optional(),
  prompt: z.string().min(1),
  /**
   * 図中テキストと alt の言語（編集言語）。省略は ja。
   * ⚠ `lesson.content` は呼び出し側が編集言語の本文を渡す——サーバーは
   * 言語に応じて正本ファイルを読みに行かない（未保存の編集が文脈から漏れる）
   */
  language: z.enum(["ja", "en"]).optional(),
});

/** @see https://platform.claude.com/docs/en/about-claude/models/overview */

function playwrightHint(): string {
  return "Playwright の Chromium が未導入の可能性があります。start.bat で起動するか、dx-training-studio で npx playwright install chromium を実行してください。";
}

export async function POST(req: Request) {
  const apiKey = resolveAiApiKey(req);
  if (!apiKey) {
    return Response.json({ error: AI_KEY_ERROR }, { status: 401 });
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

  const { system, user } = buildImageGenerationMessages(
    parsed.lesson,
    parsed.prompt,
    parsed.language ?? "ja",
  );

  let generation: ReturnType<typeof parseAiGenerationResponse>;
  try {
    const raw = await callClaude(apiKey, modelResult.model, system, user, {
      maxTokens: 8192,
    });
    generation = parseAiGenerationResponse(raw, parsed.prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }

  const projectRoot = getProjectRoot();
  const fileName = await resolveUniquePngFileName(projectRoot, generation.slug);

  try {
    const { png, cssWidth } = await renderDiagramToPng(generation.html);
    const file = await saveStagingImage(projectRoot, "ai", fileName, png);
    const warning = buildSmallWidthWarning(cssWidth);
    return Response.json({
      file,
      alt: generation.alt,
      slug: generation.slug,
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PNG 変換に失敗しました";
    const isPlaywright =
      /playwright|chromium|Executable doesn't exist/i.test(message);
    return Response.json(
      {
        error: isPlaywright ? playwrightHint() : message,
      },
      { status: 500 },
    );
  }
}
