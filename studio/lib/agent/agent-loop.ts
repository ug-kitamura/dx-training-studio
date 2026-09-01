import { resolveAiApiKey } from "@/lib/api-keys";
import { AI_KEY_ERROR } from "@/lib/agent/anthropic-stream";
import {
  buildAssistantToolUseMessage,
  buildToolResultMessages,
} from "@/lib/agent/llm/anthropic";
import type {
  LlmMessage,
  AgentToolEvent,
  AgentLogicalTurn,
  ProviderTurnResult,
  ToolCall,
} from "@/lib/agent/llm/types";
import type { ContextStorageMode } from "@/lib/schema";
import {
  AGENT_AUTO_NUDGE_LIMIT_NOTICE,
  AGENT_AUTO_NUDGE_PROMPT,
  AGENT_BROKEN_TOOL_USE_ERROR,
  AGENT_LOOP_LIMIT_ERROR,
  buildIncompleteArtifactsNotice,
  AGENT_MISSING_GENERATE_INPUT_ERROR,
  AGENT_MISSING_PATH_ERROR,
  AGENT_MISSING_SCRIPT_INPUT_ERROR,
  AGENT_REPEATED_TOOL_ERROR,
  AGENT_TEXT_CONTINUATION_LIMIT_NOTICE,
  AGENT_TEXT_CONTINUATION_PROMPT,
  GENERATE_REJECTED_GUIDANCE,
  GENERATE_WRITE_INPUT_GUIDANCE,
  LARGE_FILE_WRITE_GUIDANCE,
  MAX_AGENT_LOOP_TURNS,
  MAX_CONSECUTIVE_IDENTICAL_TOOL_ERRORS,
  MAX_TEXT_CONTINUATIONS_PER_TURN,
  MAX_TOKENS_TRUNCATION_NOTE,
  SCRIPT_INPUT_GUIDANCE,
} from "@/lib/agent/llm/types";
import { resolveLlmProvider } from "@/lib/agent/llm/resolve-provider";
import type { LlmProvider } from "@/lib/agent/llm/provider";
import {
  isAutoNudgeDisabled,
  resolveModelProfile,
} from "@/lib/agent/model-profiles";
import { classifyTurnEnd, hasTextProgress } from "@/lib/agent/turn-end";
import {
  executeRegisteredTool,
  isScriptToolName,
  normalizeScriptToolCall,
  preflightScriptToolCall,
  resolveToolDefinitions,
  skillHasScriptsDir,
  type ToolExecutionContext,
  type ToolExecutionOutcome,
} from "@/lib/agent/tools/registry";
import {
  resolveConfirmRequirement,
  seedSkipOverwritePathsFromHistory,
  collectWrittenPathsFromToolResult,
  normalizeConfirmPath,
} from "@/lib/agent/tools/confirm-gate";
import { awaitToolConfirmDecision } from "@/lib/agent/tools/tool-confirm-registry";
import {
  resolveSearchProvider,
  SEARCH_REJECTED_GUIDANCE,
  SEARCH_MANUAL_SKIP_GUIDANCE,
  SEARCH_MANUAL_RESULT_NOTICE,
  type SearchSessionState,
} from "@/lib/agent/tools/search-provider";
import { checkWorkScopeExists } from "@/lib/agent/work-scope-guard";
import type { ToolDefinition } from "@/lib/agent/llm/types";
import { getProjectRoot } from "@/lib/project-root";

export type AgentLoopEmit = (event: string, data: unknown) => void;

export type RunAgentLoopOptions = {
  req: Request;
  system: string;
  messages: LlmMessage[];
  toolNames: string[];
  emit: AgentLoopEmit;
  signal?: AbortSignal;
  workScopeKey?: string;
  skillId?: string;
  skillDirAbsolute?: string;
  /** dx 固有: 社内コンテキストの保存先モード（search/select_company_context 用） */
  contextMode?: ContextStorageMode;
};

export type RunAgentLoopResult =
  | { ok: true; toolEvents: AgentToolEvent[]; toolTurns: AgentLogicalTurn[] }
  | { ok: false; error: string; status: number };

const PATH_REQUIRED_TOOLS = new Set([
  "read_file",
  "write_file",
  "mkdir",
  "replace_in_file",
  "replace_between",
  "append_file",
]);

export function isBrokenToolUse(call: ToolCall): string | null {
  if (call.inputParseError) {
    return AGENT_BROKEN_TOOL_USE_ERROR;
  }
  if (call.name === "copy_file") {
    const from = call.input?.from;
    const to = call.input?.to;
    if (
      typeof from !== "string" ||
      !from.trim() ||
      typeof to !== "string" ||
      !to.trim()
    ) {
      return AGENT_MISSING_PATH_ERROR;
    }
    return null;
  }
  if (call.name === "run_script") {
    const code = call.input?.code;
    if (typeof code !== "string" || !code.trim()) {
      return AGENT_MISSING_SCRIPT_INPUT_ERROR;
    }
    return null;
  }
  if (call.name === "run_skill_script") {
    const scriptPath = call.input?.script_path;
    if (typeof scriptPath !== "string" || !scriptPath.trim()) {
      return AGENT_MISSING_SCRIPT_INPUT_ERROR;
    }
    return null;
  }
  if (call.name === "generate_and_write") {
    const pathValue = call.input?.path;
    const instruction = call.input?.instruction;
    if (
      typeof pathValue !== "string" ||
      !pathValue.trim() ||
      typeof instruction !== "string" ||
      !instruction.trim()
    ) {
      return AGENT_MISSING_GENERATE_INPUT_ERROR;
    }
    return null;
  }
  if (PATH_REQUIRED_TOOLS.has(call.name)) {
    const pathValue = call.input?.path;
    if (typeof pathValue !== "string" || !pathValue.trim()) {
      return AGENT_MISSING_PATH_ERROR;
    }
  }
  return null;
}

export function extractToolErrorMessage(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const error = (result as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error : null;
}

function brokenToolOutcome(
  message: string,
  options?: { truncatedByMaxTokens?: boolean },
): ToolExecutionOutcome {
  // script / generate 系の入力不備には各 schema を再提示する（LARGE_FILE_WRITE_GUIDANCE は
  // これらのツールへ誘導する案内のため、ツール自体の入力失敗には循環して役立たない）
  const baseGuidance =
    message === AGENT_MISSING_SCRIPT_INPUT_ERROR
      ? SCRIPT_INPUT_GUIDANCE
      : message === AGENT_MISSING_GENERATE_INPUT_ERROR
        ? GENERATE_WRITE_INPUT_GUIDANCE
        : LARGE_FILE_WRITE_GUIDANCE;
  const guidance = options?.truncatedByMaxTokens
    ? `${MAX_TOKENS_TRUNCATION_NOTE} ${baseGuidance}`
    : baseGuidance;
  return {
    result: {
      error: message,
      recoverable: true,
      guidance,
    },
    display: {
      summary: "error",
      display: `✗ ${message}`,
    },
  };
}

export type TurnWithContinuationOptions = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  system: string;
  /** 継続なしの通常ターンに使う会話履歴（このまま変更しない） */
  baseMessages: LlmMessage[];
  tools: ToolDefinition[];
  maxTokens?: number;
  signal?: AbortSignal;
  emit: AgentLoopEmit;
  /** max_tokens 自動継続の上限（省略時は既定値。プロファイル値を渡す） */
  textContinuationsMax?: number;
  /** モデルプロファイルの通過袋（agent スロット） */
  providerParams?: Record<string, unknown>;
};

export type TurnWithContinuationResult =
  | {
      ok: true;
      text: string;
      result: ProviderTurnResult;
      /** このターンで実行した max_tokens 自動継続の回数（診断ログ用） */
      continuations: number;
    }
  | { ok: false; error: string; status: number };

/**
 * ツール呼び出しなしで `stopReason: "max_tokens"` となったターンを、
 * 「つづき」の手動催促なしに自動継続する。継続用の scratch メッセージ
 * （assistant の途中経過 + 続き指示）は `baseMessages` を書き換えずローカルに
 * 組み立てるため、確定した会話履歴には最終的な 1 通の assistant メッセージのみが残る
 * （generate_and_write の子生成と同じ考え方）。
 */
export async function runTurnWithMaxTokensContinuation(
  options: TurnWithContinuationOptions,
): Promise<TurnWithContinuationResult> {
  let accumulatedText = "";
  let latestResult: ProviderTurnResult | null = null;
  let continuations = 0;
  const continuationsMax =
    options.textContinuationsMax ?? MAX_TEXT_CONTINUATIONS_PER_TURN;

  for (;;) {
    const messages: LlmMessage[] =
      continuations === 0
        ? options.baseMessages
        : [
            ...options.baseMessages,
            { role: "assistant", content: accumulatedText },
            { role: "user", content: AGENT_TEXT_CONTINUATION_PROMPT },
          ];

    let stepText = "";
    let stepResult: ProviderTurnResult | null = null;
    for await (const event of options.provider.streamTurn({
      apiKey: options.apiKey,
      model: options.model,
      system: options.system,
      messages,
      tools: options.tools,
      maxTokens: options.maxTokens,
      signal: options.signal,
      providerParams: options.providerParams,
    })) {
      if (event.type === "text_delta") {
        stepText += event.text;
        options.emit("text_delta", { text: event.text });
      } else if (event.type === "turn_complete") {
        stepResult = event.result;
      }
    }

    if (!stepResult) {
      return { ok: false, error: "Empty model response", status: 502 };
    }

    accumulatedText += stepText;
    latestResult = stepResult;

    const shouldContinue =
      stepResult.toolCalls.length === 0 &&
      stepResult.stopReason === "max_tokens";
    if (!shouldContinue) break;

    if (continuations >= continuationsMax) {
      accumulatedText += AGENT_TEXT_CONTINUATION_LIMIT_NOTICE;
      options.emit("text_delta", {
        text: AGENT_TEXT_CONTINUATION_LIMIT_NOTICE,
      });
      break;
    }
    continuations += 1;
  }

  return {
    ok: true,
    text: accumulatedText,
    result: { ...latestResult!, text: accumulatedText },
    continuations,
  };
}

export async function runAgentLoop(
  options: RunAgentLoopOptions,
): Promise<RunAgentLoopResult> {
  const apiKey = resolveAiApiKey(options.req);
  if (!apiKey) {
    return { ok: false, error: AI_KEY_ERROR, status: 401 };
  }

  const providerResult = resolveLlmProvider(options.req);
  if (!providerResult.ok) {
    return {
      ok: false,
      error: providerResult.error,
      status: providerResult.status,
    };
  }

  const tools: ToolDefinition[] = resolveToolDefinitions(options.toolNames, {
    hasSkillScripts: skillHasScriptsDir(options.skillDirAbsolute),
  });
  const profile = resolveModelProfile(providerResult.model);
  const maxTokens = profile.maxOutputTokens;
  const llmMessages = [...options.messages];
  const toolEvents: AgentToolEvent[] = [];
  const toolTurns: AgentLogicalTurn[] = [];
  const workScopeKey = options.workScopeKey;
  const skillOptions = {
    skillId: options.skillId,
    skillDirAbsolute: options.skillDirAbsolute,
  };
  const searchProvider = resolveSearchProvider(options.req);
  const searchSession: SearchSessionState = { unavailable: false };
  // 空文字は contents/ 直下を指す正当なスコープ。未指定（undefined）とは区別する
  const toolContext: ToolExecutionContext | undefined =
    workScopeKey !== undefined
      ? {
          projectRoot: getProjectRoot(),
          workScopeKey,
          ...skillOptions,
          ...(options.signal ? { signal: options.signal } : {}),
          search: { provider: searchProvider, session: searchSession },
          generate: {
            provider: providerResult.provider,
            apiKey,
            model: providerResult.model,
            maxTokens,
            signal: options.signal,
            providerParams: profile.providerParams.generate,
          },
          ...(options.contextMode ? { contextMode: options.contextMode } : {}),
        }
      : options.contextMode
        ? // dx: 案件フォルダなしでも社内コンテキスト検索ツールは動かす
          // （ファイル系ツールはフォルダ必須のため invoke 側で非提示にする）
          {
            projectRoot: getProjectRoot(),
            workScopeKey: "",
            contextMode: options.contextMode,
          }
        : undefined;

  const projectRoot = getProjectRoot();

  let consecutiveError: string | null = null;
  let consecutiveErrorCount = 0;
  let turnText = "";
  /** AI 作成済み／上書き許可済み → 以降の overwrite 確認をスキップ */
  const skipOverwritePaths = seedSkipOverwritePathsFromHistory(llmMessages);

  // ---- ターン終了3値判定と自動続行（nudge）の状態 ----
  const autoNudgeEnabled = !isAutoNudgeDisabled();
  const nudgeMax = profile.continuations.nudgeMax;
  let nudges = 0;
  let noProgressStreak = 0;
  let previousNudgedText = "";
  let anyToolCallsInInvoke = false;
  /** 書込系 tool_result の templateStatus を path 単位で追跡（完了ゲート） */
  const templateResidualByPath = new Map<string, number>();

  const totalLeftoverArtifacts = () => {
    let total = 0;
    for (const count of templateResidualByPath.values()) total += count;
    return total;
  };

  const leftoverArtifactPaths = () => {
    const paths: string[] = [];
    for (const [artifactPath, count] of templateResidualByPath) {
      if (count > 0) paths.push(artifactPath);
    }
    return paths;
  };

  const trackTemplateStatus = (result: unknown) => {
    if (!result || typeof result !== "object") return;
    const record = result as {
      path?: unknown;
      templateStatus?: {
        remainingPlaceholders?: unknown[];
        emptySections?: unknown[];
      };
    };
    if (typeof record.path !== "string" || !record.path) return;
    if (!record.templateStatus || typeof record.templateStatus !== "object") {
      return;
    }
    const remaining =
      (record.templateStatus.remainingPlaceholders?.length ?? 0) +
      (record.templateStatus.emptySections?.length ?? 0);
    templateResidualByPath.set(record.path, remaining);
  };

  /**
   * ターンの可視トークン数をクライアントへ通知する。
   * セッション累計はチャットセッション（複数 invoke をまたぐ）単位のため、
   * クライアント側で積算する。
   *
   * 診断ログのファイル追記は `retire-workspace-folder` で廃止した。
   */
  const emitTurnTokenUsage = (outputTokens?: number) => {
    if (outputTokens === undefined) return;
    options.emit("token_usage", { outputTokens });
  };

  const emitLogicalTurn = (turn: AgentLogicalTurn) => {
    if (!turn.text?.trim() && !(turn.toolCalls && turn.toolCalls.length > 0)) {
      return;
    }
    toolTurns.push(turn);
    options.emit("logical_turn", turn);
  };

  for (let turn = 0; turn < MAX_AGENT_LOOP_TURNS; turn += 1) {
    if (workScopeKey) {
      const missing = checkWorkScopeExists(projectRoot, workScopeKey);
      if (missing) {
        return { ok: false, error: missing, status: 409 };
      }
    }

    const stepOutcome = await runTurnWithMaxTokensContinuation({
      provider: providerResult.provider,
      apiKey,
      model: providerResult.model,
      system: options.system,
      baseMessages: llmMessages,
      tools,
      maxTokens,
      signal: options.signal,
      emit: options.emit,
      textContinuationsMax: profile.continuations.textPerTurn,
      providerParams: profile.providerParams.agent,
    });

    if (!stepOutcome.ok) {
      return {
        ok: false,
        error: stepOutcome.error,
        status: stepOutcome.status,
      };
    }

    turnText = stepOutcome.text;
    const turnResult = stepOutcome.result;

    if (turnResult.toolCalls.length === 0) {
      // ターン終了3値判定: ユーザー待ち / 完了 → 停止、息切れ → 自動続行
      const turnEnd = classifyTurnEnd({
        text: turnText,
        hadAnyToolCalls: anyToolCallsInInvoke,
        leftoverArtifactCount: totalLeftoverArtifacts(),
      });
      emitTurnTokenUsage(turnResult.outputTokens);

      if (turnEnd === "stalled" && autoNudgeEnabled) {
        // 進捗判定: 直前の nudge 後テキストと比較（進捗なし 2 連続で停止）
        if (nudges > 0) {
          if (hasTextProgress(previousNudgedText, turnText)) {
            noProgressStreak = 0;
          } else {
            noProgressStreak += 1;
          }
        }

        if (nudges < nudgeMax && noProgressStreak < 2) {
          emitLogicalTurn({ text: turnText || undefined });
          llmMessages.push(
            { role: "assistant", content: turnText || "（応答なし）" },
            { role: "user", content: AGENT_AUTO_NUDGE_PROMPT },
          );
          previousNudgedText = turnText;
          nudges += 1;
          continue;
        }

        // 上限到達または進捗なし → 打ち切りを明示して停止。
        // 成果物に未充填の残作業が残っていれば、黙って終了せず未完了を明示する。
        const leftoverPaths = leftoverArtifactPaths();
        const limitNotice =
          leftoverPaths.length > 0
            ? buildIncompleteArtifactsNotice(leftoverPaths)
            : AGENT_AUTO_NUDGE_LIMIT_NOTICE;
        options.emit("text_delta", { text: limitNotice });
        turnText += limitNotice;
      }

      emitLogicalTurn({ text: turnText || undefined });
      options.emit("done", {});
      return { ok: true, toolEvents, toolTurns };
    }

    anyToolCallsInInvoke = true;
    // nudge 後にツール実行へ進んだ場合は進捗ありとして扱う
    noProgressStreak = 0;

    const assistantMessage = buildAssistantToolUseMessage(turnResult);
    if (assistantMessage) {
      llmMessages.push(assistantMessage);
    }

    const toolResults: string[] = [];
    for (const call of turnResult.toolCalls) {
      // ユーザー中断時は、このターンの残りツールを実行せずループを終える。
      // 実行中の LLM 呼び出し・スクリプト・確認待ちは各 signal 配線で個別に停止する。
      if (options.signal?.aborted) {
        return { ok: true, toolEvents, toolTurns };
      }
      if (workScopeKey) {
        const missing = checkWorkScopeExists(projectRoot, workScopeKey);
        if (missing) {
          return { ok: false, error: missing, status: 409 };
        }
      }

      // モデルの入力ゆらぎ（code の別名キー・run_script / run_skill_script の取り違え）を救済する
      if (isScriptToolName(call.name)) {
        const normalized = normalizeScriptToolCall(call.name, call.input ?? {});
        call.name = normalized.name;
        call.input = normalized.input;
      }

      options.emit("tool_start", {
        name: call.name,
        input: call.input,
        toolUseId: call.id,
      });
      toolEvents.push({
        phase: "start",
        name: call.name,
        input: call.input,
        toolUseId: call.id,
        display: call.name,
      });

      const broken = isBrokenToolUse(call);
      let outcome: ToolExecutionOutcome;

      // スクリプト系は確認ダイアログより先に事前検査する
      // （構文エラーや存在しないスクリプトの承認をユーザーに求めない）
      const preflight =
        !broken && toolContext && isScriptToolName(call.name)
          ? await preflightScriptToolCall(call.name, call.input, toolContext)
          : null;

      if (broken) {
        outcome = brokenToolOutcome(broken, {
          truncatedByMaxTokens: turnResult.stopReason === "max_tokens",
        });
      } else if (preflight) {
        outcome = preflight;
      } else {
        const requirement = toolContext
          ? resolveConfirmRequirement(
              toolContext.projectRoot,
              toolContext.workScopeKey,
              call,
              {
                ...skillOptions,
                skipOverwritePaths,
                searchAvailable: searchProvider !== null,
              },
            )
          : null;

        if (requirement) {
          options.emit("confirm_required", {
            toolUseId: call.id,
            kind: requirement.kind,
            path: requirement.path,
            isNew: requirement.isNew,
            ...(requirement.script ? { script: requirement.script } : {}),
            ...(requirement.search ? { search: requirement.search } : {}),
            ...(requirement.generate ? { generate: requirement.generate } : {}),
            ...(requirement.inlineAssets
              ? { inlineAssets: requirement.inlineAssets }
              : {}),
            ...(requirement.createFolder
              ? { createFolder: requirement.createFolder }
              : {}),
          });
          const resolution = await awaitToolConfirmDecision(
            call.id,
            undefined,
            options.signal,
          );
          const decision = resolution.decision;
          if (requirement.kind === "web-search-manual") {
            // 人手フォールバック: 承認＝結果貼付、拒否/timeout＝スキップして続行
            const manualText = resolution.manualSearchText?.trim();
            outcome =
              decision === "approve" && manualText
                ? {
                    result: {
                      query: requirement.path,
                      source: "user-provided",
                      results: manualText,
                      notice: SEARCH_MANUAL_RESULT_NOTICE,
                    },
                    display: {
                      summary: "手動入力",
                      display: `🔎 web検索（手動入力）: ${requirement.path}`,
                    },
                  }
                : {
                    result: {
                      unavailable: true,
                      skipped: true,
                      query: requirement.path,
                      guidance: SEARCH_MANUAL_SKIP_GUIDANCE,
                    },
                    display: {
                      summary: "スキップ",
                      display: `✗ web検索をスキップ: ${requirement.path}`,
                    },
                  };
          } else if (decision === "reject" || decision === "timeout") {
            const timedOut = decision === "timeout";
            const reason = timedOut
              ? "確認ダイアログが時間内に応答されなかったため実行を見送りました（ダイアログが表示されない場合は画面を再読み込みしてください）"
              : "ユーザーが確認ダイアログで拒否しました";
            outcome = {
              result: {
                rejected: true,
                ...(timedOut ? { timedOut: true } : {}),
                path: requirement.path,
                reason,
                ...(call.name === "web_search"
                  ? { guidance: SEARCH_REJECTED_GUIDANCE }
                  : {}),
                ...(call.name === "generate_and_write"
                  ? { guidance: GENERATE_REJECTED_GUIDANCE }
                  : {}),
              },
              display: {
                summary: timedOut ? "タイムアウト" : "拒否",
                display: timedOut
                  ? `✗ 確認タイムアウト（無応答）: ${requirement.path}`
                  : `✗ ユーザーが拒否: ${requirement.path}`,
              },
            };
          } else {
            if (requirement.kind === "overwrite") {
              skipOverwritePaths.add(normalizeConfirmPath(requirement.path));
            }
            outcome = await executeRegisteredTool(
              call.name,
              call.input,
              toolContext,
            );
          }
        } else {
          outcome = await executeRegisteredTool(
            call.name,
            call.input,
            toolContext,
          );
        }
      }

      const resultJson = JSON.stringify(outcome.result);
      toolResults.push(resultJson);
      trackTemplateStatus(outcome.result);

      if (!extractToolErrorMessage(outcome.result)) {
        for (const written of collectWrittenPathsFromToolResult(
          outcome.result,
        )) {
          skipOverwritePaths.add(written);
        }
      }

      options.emit("tool_end", {
        name: call.name,
        toolUseId: call.id,
        summary: outcome.display.summary,
        display: outcome.display.display,
        result: resultJson,
        tags: outcome.display.tags,
      });
      toolEvents.push({
        phase: "end",
        name: call.name,
        toolUseId: call.id,
        summary: outcome.display.summary,
        display: outcome.display.display,
        result: resultJson,
        tags: outcome.display.tags,
      });

      const errorMessage = extractToolErrorMessage(outcome.result);
      if (errorMessage) {
        if (errorMessage === consecutiveError) {
          consecutiveErrorCount += 1;
        } else {
          consecutiveError = errorMessage;
          consecutiveErrorCount = 1;
        }
        if (consecutiveErrorCount > MAX_CONSECUTIVE_IDENTICAL_TOOL_ERRORS) {
          const message = `${AGENT_REPEATED_TOOL_ERROR}: ${errorMessage}`;
          return { ok: false, error: message, status: 422 };
        }
      } else {
        consecutiveError = null;
        consecutiveErrorCount = 0;
      }
    }

    emitTurnTokenUsage(turnResult.outputTokens);

    emitLogicalTurn({
      text: turnText || undefined,
      toolCalls: turnResult.toolCalls.map((call, index) => ({
        id: call.id,
        name: call.name,
        input: call.input,
        result: toolResults[index] ?? "{}",
      })),
    });

    llmMessages.push(
      ...buildToolResultMessages(turnResult.toolCalls, toolResults),
    );
  }

  return { ok: false, error: AGENT_LOOP_LIMIT_ERROR, status: 422 };
}

export function createAgentLoopSseStream(
  run: (emit: AgentLoopEmit) => Promise<RunAgentLoopResult>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const emit: AgentLoopEmit = (event, data) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const result = await run(emit);
        if (!result.ok) {
          emit("error", { message: result.error });
          controller.close();
          return;
        }
        if (result.ok) {
          controller.close();
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "スキル実行に失敗しました";
        emit("error", { message });
        controller.close();
      }
    },
  });
}
