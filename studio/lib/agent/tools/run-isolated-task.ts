import fs from "node:fs";
import path from "node:path";
import { resolveToolTargetPath } from "@/lib/agent/tools/fs-guard";
import {
  framedWriteDivertOutcome,
  resolveFramedWriteTarget,
} from "@/lib/agent/tools/framed-write-guard";
import {
  GENERATE_MAX_SECTIONS,
  GENERATE_RETRY_GUIDANCE,
  GENERATE_TOTAL_CHAR_LIMIT,
  resolveGenerateContextFiles,
  runChildGeneration,
} from "@/lib/agent/tools/generate-write";
import type {
  ToolExecutionContext,
  ToolExecutionOutcome,
} from "@/lib/agent/tools/execution-types";

/**
 * path 省略時、結果テキストをそのまま tool_result として親へ返す際の上限。
 * ファイル書込（generate_and_write の GENERATE_TOTAL_CHAR_LIMIT）よりずっと
 * 小さく取る。ここで返した内容はそのまま親の会話履歴に残るため、
 * サブエージェント fallback が「隔離した文脈で実行する」効果を出すには、
 * 要約・レポート程度の分量に絞る必要がある。
 */
export const ISOLATED_TASK_RESULT_CHAR_LIMIT = 8_000;

/** 子 LLM への固定 system prompt。generate_and_write の「ファイル生成器」より汎用的な役割文にする */
const TASK_SYSTEM_PROMPT =
  "あなたは親のエージェントから独立して指示されたタスクを実行するタスク実行器である。指示されたタスクの結果のみを出力する。前置き・後書き・コードフェンス（```）を出力してはならない。";

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string" && !!entry.trim(),
  );
}

export type RunIsolatedTaskInput = {
  purpose: string;
  instruction: string;
  path: string | null;
  sections: string[];
  contextPaths: string[];
};

export function parseRunIsolatedTaskInput(
  input: Record<string, unknown>,
): RunIsolatedTaskInput | { error: string } {
  const instruction = nonEmptyString(input.instruction);
  if (!instruction) return { error: "instruction が空です" };

  const sections = stringArray(input.sections);
  if (sections.length > GENERATE_MAX_SECTIONS) {
    return {
      error: `sections が多すぎます（上限 ${GENERATE_MAX_SECTIONS} 件）。結果を分けて再実行してください`,
    };
  }

  return {
    purpose: nonEmptyString(input.purpose) ?? "",
    instruction,
    path: nonEmptyString(input.path),
    sections,
    contextPaths: stringArray(input.context_paths),
  };
}

function errorOutcome(message: string): ToolExecutionOutcome {
  return {
    result: { error: message },
    display: { summary: "error", display: `✗ ${message}` },
  };
}

function taskFailureOutcome(
  message: string,
  completedSections: number,
): ToolExecutionOutcome {
  return {
    result: {
      error: message,
      completedSections,
      recoverable: true,
      guidance: GENERATE_RETRY_GUIDANCE,
    },
    display: { summary: "error", display: `✗ ${message}` },
  };
}

/**
 * run_isolated_task の実行本体。
 * サブエージェント起動の代替として、親の会話履歴を引き継がない子 LLM 呼び出しで
 * タスクを実行する。path が指定されればファイルへ直接書き込み（要約のみ tool_result
 * に残す）、省略されれば結果テキストをそのまま tool_result として返す（上限あり）。
 * いずれの場合も context_paths の内容そのものは親の履歴に戻さない。
 */
export async function executeRunIsolatedTask(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): Promise<ToolExecutionOutcome> {
  const generate = context.generate;
  if (!generate) {
    return errorOutcome(
      "run_isolated_task を実行するための LLM 設定がありません",
    );
  }

  const parsed = parseRunIsolatedTaskInput(input);
  if ("error" in parsed) return errorOutcome(parsed.error);

  let targetResolved: ReturnType<typeof resolveToolTargetPath> | null = null;
  if (parsed.path) {
    const resolved = resolveToolTargetPath(
      context.projectRoot,
      context.workScopeKey,
      parsed.path,
      {
        skillId: context.skillId,
        skillDirAbsolute: context.skillDirAbsolute,
        preferSkillIfExists: false,
      },
    );
    if ("error" in resolved) return errorOutcome(resolved.error);
    if (resolved.insideSkill) {
      return errorOutcome(
        `スキルディレクトリへの書込はできません: ${resolved.relativePath}`,
      );
    }
    targetResolved = resolved;
  }

  const contextFiles = resolveGenerateContextFiles(
    context,
    parsed.contextPaths,
  );
  if ("error" in contextFiles) return errorOutcome(contextFiles.error);

  const startedAt = Date.now();
  const childResult = await runChildGeneration({
    generate,
    systemPrompt: TASK_SYSTEM_PROMPT,
    instruction: parsed.instruction,
    sections: parsed.sections,
    contextFiles,
    totalCharLimit: targetResolved
      ? GENERATE_TOTAL_CHAR_LIMIT
      : ISOLATED_TASK_RESULT_CHAR_LIMIT,
  });
  if (!childResult.ok) {
    return taskFailureOutcome(childResult.error, childResult.completedSections);
  }
  const durationMs = Date.now() - startedAt;

  const truncatedContextPaths = contextFiles
    .filter((file) => file.truncated)
    .map((file) => file.displayPath);
  const truncationNote =
    truncatedContextPaths.length > 0
      ? `（参照ファイルを読取上限で切り詰め: ${truncatedContextPaths.join("・")}）`
      : "";

  if (targetResolved) {
    // 額縁テンプレートを丸ごと上書きしそうな場合は中間ファイル置き場へ退避する
    const decision = resolveFramedWriteTarget({
      absolutePath: targetResolved.absolutePath,
      relativePath: targetResolved.relativePath,
      workScopeKey: context.workScopeKey,
      projectRoot: context.projectRoot,
    });

    fs.mkdirSync(path.dirname(decision.absolutePath), {
      recursive: true,
    });
    fs.writeFileSync(decision.absolutePath, childResult.text, "utf-8");
    const bytes = Buffer.byteLength(childResult.text, "utf-8");

    if (decision.kind === "divert") {
      return framedWriteDivertOutcome(decision, {
        label: "🧩 独立実行書込",
        bytes,
        extraResult: {
          sections: childResult.sectionCount,
          continuations: childResult.continuations,
          durationMs,
          ...(truncatedContextPaths.length > 0
            ? { truncatedContextPaths }
            : {}),
        },
      });
    }

    return {
      result: {
        path: decision.relativePath,
        bytes,
        sections: childResult.sectionCount,
        continuations: childResult.continuations,
        durationMs,
        ...(truncatedContextPaths.length > 0 ? { truncatedContextPaths } : {}),
      },
      display: {
        summary: `${bytes} bytes`,
        display: `🧩 独立実行書込: ${decision.relativePath}（${bytes} bytes・${childResult.sectionCount} セクション）${truncationNote}`,
      },
    };
  }

  return {
    result: {
      resultText: childResult.text,
      sections: childResult.sectionCount,
      continuations: childResult.continuations,
      durationMs,
      ...(truncatedContextPaths.length > 0 ? { truncatedContextPaths } : {}),
    },
    display: {
      summary: `${childResult.text.length} 文字`,
      display: `🧩 独立実行: ${parsed.purpose || "タスクを実行"}（${childResult.text.length} 文字）${truncationNote}`,
    },
  };
}
