"use client";

import type { AgentLogicalTurn, AgentToolEvent } from "@/lib/agent/llm/types";
import { CONFIRM_KINDS, isConfirmKind } from "@/lib/agent/tools/confirm-kind";

export type ToolConfirmKind = (typeof CONFIRM_KINDS)[number];

export type ToolConfirmScriptInfo = {
  purpose: string;
  code: string;
  writes: Array<{ path: string; exists: boolean }>;
  networkWarning: boolean;
  scriptPath?: string;
  args?: string[];
};

export type ToolConfirmSearchInfo = {
  query: string;
  purpose: string;
};

export type ToolConfirmGenerateInfo = {
  purpose: string;
  instruction: string;
  sections: string[];
  contextPaths: string[];
  /** 差し込み先の区間名（設定時はファイル全体の上書きではない） */
  marker?: string;
};

export type ToolConfirmInlineAssetsInfo = {
  targets: string[];
};

export type ToolConfirmCreatedFolder = {
  level: "series" | "course" | "lesson";
  name: string;
};

export type ToolConfirmCreateFolderInfo = {
  /** 新しく作られる階層。上位（シリーズ）から順に並ぶ */
  folders: ToolConfirmCreatedFolder[];
};

const FOLDER_LEVELS = new Set(["series", "course", "lesson"]);

function parseCreatedFolders(value: unknown): ToolConfirmCreatedFolder[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { level, name } = entry as Record<string, unknown>;
    if (typeof level !== "string" || !FOLDER_LEVELS.has(level)) return [];
    if (typeof name !== "string" || !name) return [];
    return [{ level: level as ToolConfirmCreatedFolder["level"], name }];
  });
}

export type ToolConfirmRequiredEvent = {
  toolUseId: string;
  kind: ToolConfirmKind;
  path: string;
  isNew: boolean;
  script?: ToolConfirmScriptInfo;
  search?: ToolConfirmSearchInfo;
  generate?: ToolConfirmGenerateInfo;
  inlineAssets?: ToolConfirmInlineAssetsInfo;
  createFolder?: ToolConfirmCreateFolderInfo;
};

export type AgentStreamCallbacks = {
  onDelta: (text: string) => void;
  onToolStart?: (event: AgentToolEvent) => void;
  onToolEnd?: (event: AgentToolEvent) => void;
  onLogicalTurn?: (turn: AgentLogicalTurn) => void;
  /** ターンごとの可視（出力）トークン数。`.meta/diagnostics.log` の outputTokens と同じ値 */
  onTokenUsage?: (event: { outputTokens: number }) => void;
  onConfirmRequired?: (event: ToolConfirmRequiredEvent) => void;
  /**
   * サーバが送った confirm_required の kind をクライアントが解釈できない場合に呼ばれる。
   * ダイアログは表示できないため、呼び出し側は toolUseId へ即時拒否を送り、
   * サーバ側の確認待ち（5 分 TTL）を無言で待たせないようにすること。
   */
  onUnknownConfirmKind?: (event: { toolUseId: string; kind: string }) => void;
};

/**
 * Agent invoke SSE parser (text_delta / tool_start / tool_end / logical_turn / done / error).
 */
export async function consumeAgentStream(
  response: Response,
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  if (!response.body) {
    throw new Error("empty response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const throwIfAborted = () => {
    if (signal?.aborted) {
      void reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }
  };

  try {
    while (true) {
      throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        throwIfAborted();
        const lines = chunk.split("\n");
        const eventLine = lines.find((line) => line.startsWith("event: "));
        const dataLine = lines.find((line) => line.startsWith("data: "));
        if (!eventLine || !dataLine) continue;

        const eventName = eventLine.slice("event: ".length).trim();
        const payload = dataLine.slice("data: ".length).trim();
        if (!payload) continue;

        let data: Record<string, unknown>;
        try {
          data = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          continue;
        }

        switch (eventName) {
          case "text_delta": {
            const text = typeof data.text === "string" ? data.text : "";
            if (text) callbacks.onDelta(text);
            break;
          }
          case "tool_start":
            callbacks.onToolStart?.({
              phase: "start",
              name: String(data.name ?? ""),
              input:
                data.input && typeof data.input === "object"
                  ? (data.input as Record<string, unknown>)
                  : undefined,
              toolUseId:
                typeof data.toolUseId === "string" ? data.toolUseId : undefined,
              display: String(data.display ?? data.name ?? ""),
            });
            break;
          case "tool_end":
            callbacks.onToolEnd?.({
              phase: "end",
              name: String(data.name ?? ""),
              toolUseId:
                typeof data.toolUseId === "string" ? data.toolUseId : undefined,
              summary:
                typeof data.summary === "string" ? data.summary : undefined,
              display: String(data.display ?? data.name ?? ""),
              result: typeof data.result === "string" ? data.result : undefined,
              tags: Array.isArray(data.tags)
                ? data.tags.filter(
                    (tag): tag is string => typeof tag === "string",
                  )
                : undefined,
            });
            break;
          case "token_usage": {
            const outputTokens =
              typeof data.outputTokens === "number" ? data.outputTokens : 0;
            callbacks.onTokenUsage?.({ outputTokens });
            break;
          }
          case "logical_turn": {
            const text = typeof data.text === "string" ? data.text : undefined;
            const rawCalls = Array.isArray(data.toolCalls)
              ? data.toolCalls
              : [];
            const toolCalls = rawCalls
              .map((item) => {
                if (!item || typeof item !== "object") return null;
                const call = item as Record<string, unknown>;
                if (
                  typeof call.id !== "string" ||
                  typeof call.name !== "string" ||
                  typeof call.result !== "string"
                ) {
                  return null;
                }
                return {
                  id: call.id,
                  name: call.name,
                  input:
                    call.input && typeof call.input === "object"
                      ? (call.input as Record<string, unknown>)
                      : {},
                  result: call.result,
                };
              })
              .filter(
                (call): call is NonNullable<typeof call> => call !== null,
              );
            callbacks.onLogicalTurn?.({
              ...(text ? { text } : {}),
              ...(toolCalls.length > 0 ? { toolCalls } : {}),
            });
            break;
          }
          case "confirm_required": {
            const kind = data.kind;
            if (typeof data.toolUseId !== "string") break;

            if (!isConfirmKind(kind)) {
              callbacks.onUnknownConfirmKind?.({
                toolUseId: data.toolUseId,
                kind: typeof kind === "string" ? kind : String(kind),
              });
              break;
            }

            if (typeof data.path === "string") {
              const rawScript =
                data.script && typeof data.script === "object"
                  ? (data.script as Record<string, unknown>)
                  : null;
              const script: ToolConfirmScriptInfo | undefined = rawScript
                ? {
                    purpose:
                      typeof rawScript.purpose === "string"
                        ? rawScript.purpose
                        : "",
                    code:
                      typeof rawScript.code === "string" ? rawScript.code : "",
                    writes: Array.isArray(rawScript.writes)
                      ? rawScript.writes
                          .filter(
                            (
                              entry,
                            ): entry is { path: string; exists: boolean } =>
                              Boolean(
                                entry &&
                                typeof entry === "object" &&
                                typeof (entry as { path?: unknown }).path ===
                                  "string",
                              ),
                          )
                          .map((entry) => ({
                            path: entry.path,
                            exists: Boolean(entry.exists),
                          }))
                      : [],
                    networkWarning: Boolean(rawScript.networkWarning),
                    ...(typeof rawScript.scriptPath === "string"
                      ? { scriptPath: rawScript.scriptPath }
                      : {}),
                    ...(Array.isArray(rawScript.args)
                      ? {
                          args: rawScript.args.filter(
                            (arg): arg is string => typeof arg === "string",
                          ),
                        }
                      : {}),
                  }
                : undefined;
              const rawSearch =
                data.search && typeof data.search === "object"
                  ? (data.search as Record<string, unknown>)
                  : null;
              const search: ToolConfirmSearchInfo | undefined =
                rawSearch && typeof rawSearch.query === "string"
                  ? {
                      query: rawSearch.query,
                      purpose:
                        typeof rawSearch.purpose === "string"
                          ? rawSearch.purpose
                          : "",
                    }
                  : undefined;
              const rawGenerate =
                data.generate && typeof data.generate === "object"
                  ? (data.generate as Record<string, unknown>)
                  : null;
              const generate: ToolConfirmGenerateInfo | undefined = rawGenerate
                ? {
                    purpose:
                      typeof rawGenerate.purpose === "string"
                        ? rawGenerate.purpose
                        : "",
                    instruction:
                      typeof rawGenerate.instruction === "string"
                        ? rawGenerate.instruction
                        : "",
                    sections: Array.isArray(rawGenerate.sections)
                      ? rawGenerate.sections.filter(
                          (entry): entry is string => typeof entry === "string",
                        )
                      : [],
                    contextPaths: Array.isArray(rawGenerate.contextPaths)
                      ? rawGenerate.contextPaths.filter(
                          (entry): entry is string => typeof entry === "string",
                        )
                      : [],
                    ...(typeof rawGenerate.marker === "string" &&
                    rawGenerate.marker
                      ? { marker: rawGenerate.marker }
                      : {}),
                  }
                : undefined;
              const rawInline =
                data.inlineAssets && typeof data.inlineAssets === "object"
                  ? (data.inlineAssets as Record<string, unknown>)
                  : null;
              const inlineAssets: ToolConfirmInlineAssetsInfo | undefined =
                rawInline
                  ? {
                      targets: Array.isArray(rawInline.targets)
                        ? rawInline.targets.filter(
                            (entry): entry is string =>
                              typeof entry === "string",
                          )
                        : [],
                    }
                  : undefined;
              const rawCreateFolder =
                data.createFolder && typeof data.createFolder === "object"
                  ? (data.createFolder as Record<string, unknown>)
                  : null;
              const createFolder: ToolConfirmCreateFolderInfo | undefined =
                rawCreateFolder
                  ? { folders: parseCreatedFolders(rawCreateFolder.folders) }
                  : undefined;
              callbacks.onConfirmRequired?.({
                toolUseId: data.toolUseId,
                kind,
                path: data.path,
                isNew: Boolean(data.isNew),
                ...(script ? { script } : {}),
                ...(search ? { search } : {}),
                ...(generate ? { generate } : {}),
                ...(inlineAssets ? { inlineAssets } : {}),
                ...(createFolder ? { createFolder } : {}),
              });
            }
            break;
          }
          case "error": {
            const message =
              typeof data.message === "string"
                ? data.message
                : "スキル実行に失敗しました";
            throw new Error(message);
          }
          case "done":
            return;
          default:
            break;
        }
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => undefined);
      throw new DOMException("Aborted", "AbortError");
    }
    throw error;
  }
}

/** @deprecated use consumeAgentStream */
export async function consumeAnthropicStream(
  response: Response,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  return consumeAgentStream(response, { onDelta }, signal);
}
