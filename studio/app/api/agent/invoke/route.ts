import { z } from "zod";
import {
  buildSkillSystemPrompt,
  getSkillCatalogRoots,
  loadSkill,
  resolveSkillDir,
} from "@/lib/agent/skill-loader";
import {
  enrichUserMessageWithAttachments,
  resolveAttachmentsForMessage,
} from "@/lib/agent/file-attachments";
import { createAgentLoopSseStream, runAgentLoop } from "@/lib/agent/agent-loop";
import { clientMessagesToLlmMessages } from "@/lib/agent/message-history";
import {
  buildSkillRuntimeContext,
  mergeSkillSystemPrompt,
} from "@/lib/agent/skill-runtime-context";
import {
  skillMentionsSubagent,
  SUBAGENT_FALLBACK_MODEL_HINT,
} from "@/lib/agent/subagent-fallback";
import {
  skillMentionsImageIO,
  IMAGE_IO_FALLBACK_MODEL_HINT,
} from "@/lib/agent/image-io-fallback";
import { getProjectRoot } from "@/lib/project-root";
import { parseContextMode } from "@/lib/context-resolve";

const toolEventSchema = z.object({
  name: z.string(),
  phase: z.enum(["start", "end"]),
  toolUseId: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  summary: z.string().optional(),
  display: z.string(),
  result: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const logicalTurnSchema = z.object({
  text: z.string().optional(),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        input: z.record(z.string(), z.unknown()),
        result: z.string(),
      }),
    )
    .optional(),
});

const attachmentSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  toolEvents: z.array(toolEventSchema).optional(),
  toolTurns: z.array(logicalTurnSchema).optional(),
  attachments: z.array(attachmentSchema).optional(),
});

const runtimeFocusSchema = z.object({
  workScopeKey: z.string(),
  currentFileRelativePath: z.string().nullable().optional(),
  preferredOutputDir: z.string().optional(),
});

const bodySchema = z.object({
  skillId: z.string().min(1),
  variables: z.record(z.string(), z.string()).optional(),
  messages: z.array(messageSchema).min(1),
  runtimeFocus: runtimeFocusSchema.optional(),
});

/** 作業スコープの文脈なしでも実行できるツール（社内コンテキスト検索のみ） */
const SCOPE_INDEPENDENT_TOOLS = new Set([
  "search_company_context",
  "select_company_context",
]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const projectRoot = getProjectRoot();
  const skillRoots = getSkillCatalogRoots(projectRoot);
  const skill = loadSkill(skillRoots, parsed.data.skillId);
  if (!skill) {
    return Response.json(
      { error: `スキルが見つかりません: ${parsed.data.skillId}` },
      { status: 404 },
    );
  }

  const variables = parsed.data.variables ?? {};
  const { prompt, missingVariables } = buildSkillSystemPrompt(skill, variables);
  if (missingVariables.length > 0) {
    return Response.json(
      {
        error: `必須変数が不足しています: ${missingVariables.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const skillDirAbsolute = resolveSkillDir(skillRoots, skill.id) ?? undefined;

  const focus = parsed.data.runtimeFocus;
  const mentionsSubagent = skillMentionsSubagent(skill.body);
  const mentionsImageIO = skillMentionsImageIO(skill.body);
  let systemPrompt = prompt;
  // 空文字はシリーズ 0 件（`contents/` 直下）を表す正当なスコープなので、focus の有無で見る
  if (focus) {
    let runtime = buildSkillRuntimeContext({
      workScopeKey: focus.workScopeKey,
      currentFileRelativePath: focus.currentFileRelativePath,
      skillId: skill.id,
      skillDirAbsolute,
      skillAssets: skill.assets,
      mentionsSubagent,
      imageIoSkipped: mentionsImageIO,
    });
    if (focus.preferredOutputDir !== undefined) {
      const dirLabel =
        focus.preferredOutputDir === ""
          ? "作業フォルダ直下"
          : focus.preferredOutputDir;
      runtime += `\n\nユーザが選んだ出力先の優先候補: \`${dirLabel}\`。`;
    }
    systemPrompt = mergeSkillSystemPrompt(prompt, runtime);
  } else if (mentionsSubagent || mentionsImageIO) {
    const hints = [
      mentionsSubagent ? SUBAGENT_FALLBACK_MODEL_HINT : null,
      mentionsImageIO ? IMAGE_IO_FALLBACK_MODEL_HINT : null,
    ].filter((hint): hint is string => hint !== null);
    systemPrompt = mergeSkillSystemPrompt(
      prompt,
      `## ワークスペースランタイム\n\n${hints.join("\n")}`,
    );
  }

  const historyMessages = parsed.data.messages.slice(0, -1);
  const latestMessage = parsed.data.messages[parsed.data.messages.length - 1];
  if (!latestMessage || latestMessage.role !== "user") {
    return Response.json(
      { error: "Last message must be from user" },
      { status: 400 },
    );
  }

  // @ 参照は書込ルートの 2 系統（`@contents/...` と `@contents-work/...`）
  const structuredPaths = latestMessage.attachments?.map((item) => item.path);
  const resolvedAttachments = resolveAttachmentsForMessage(
    projectRoot,
    latestMessage.content,
    structuredPaths,
  );
  if ("error" in resolvedAttachments) {
    return Response.json(
      { error: resolvedAttachments.error },
      { status: 400 },
    );
  }

  const enrichedLatest = {
    ...latestMessage,
    content: enrichUserMessageWithAttachments(
      latestMessage.content,
      resolvedAttachments.attachments,
    ),
  };

  const invokeMessages = [...historyMessages, enrichedLatest];
  const llmMessages = clientMessagesToLlmMessages(invokeMessages);
  // 作業スコープが渡らない呼び出しではファイル系ツールを提示しない（宣言があっても非表示）
  const declaredTools = skill.tools ?? [];
  const toolNames = focus
    ? declaredTools
    : declaredTools.filter((name) => SCOPE_INDEPENDENT_TOOLS.has(name));
  const contextMode = parseContextMode(req.headers.get("x-context-mode"));

  const stream = createAgentLoopSseStream(async (emit) => {
    return await runAgentLoop({
      req,
      system: systemPrompt,
      messages: llmMessages,
      toolNames,
      emit,
      signal: req.signal,
      workScopeKey: focus?.workScopeKey,
      skillId: skill.id,
      skillDirAbsolute,
      contextMode,
    });
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
