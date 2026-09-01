import fs from "node:fs";
import path from "node:path";
import {
  isLessonMetaWritePath,
  resolveToolTargetPath,
} from "@/lib/agent/tools/fs-guard";
import {
  framedWriteDivertOutcome,
  resolveDivertTarget,
  resolveFramedWriteTarget,
} from "@/lib/agent/tools/framed-write-guard";
import { resolveModelProfile } from "@/lib/agent/model-profiles";
import {
  findMarkerSectionNames,
  normalizeMarkerName,
  scanTemplateResiduals,
  spliceMarkerSection,
  templateResidualCount,
} from "@/lib/agent/tools/replace-feedback";
import type { LlmContentBlock, LlmMessage } from "@/lib/agent/llm/types";
import type {
  ToolExecutionContext,
  ToolExecutionOutcome,
} from "@/lib/agent/tools/execution-types";

/** 1 回の generate_and_write / run_isolated_task で許容するセクション数の上限 */
export const GENERATE_MAX_SECTIONS = 12;

/**
 * 生成合計文字数の上限。
 * replace_between の from_path 読取上限（registry の READ_CHAR_LIMIT）と一致させ、
 * 「生成できたのに差し込めない」不整合を防ぐ。
 */
export const GENERATE_TOTAL_CHAR_LIMIT = 100_000;

/** context_paths の 1 ファイルあたりの読取上限 */
export const GENERATE_CONTEXT_FILE_CHAR_LIMIT = 50_000;

/** 継続呼び出しに添える、生成済み本文の末尾抜粋の長さ */
const PREVIOUS_TAIL_CHAR_LIMIT = 2_000;

/** 子 LLM への固定 system prompt（本文のみ出力の契約） */
const GENERATOR_SYSTEM_PROMPT =
  "あなたはファイル生成器である。指示された成果物の本文のみを出力する。前置き・後書き・説明文・コードフェンス（```）を出力してはならない。出力はそのままファイルへ書き込まれる。";

const CONTINUE_PROMPT =
  "出力が上限で途中終了しました。直前の出力の続きだけを、既出部分を一切繰り返さずに出力してください。";

export const GENERATE_RETRY_GUIDANCE =
  "sections をより細かく分割する、instruction を絞る、または成果物を複数ファイルに分けて再実行してください。";

export type GenerateWriteInput = {
  purpose: string;
  path: string;
  instruction: string;
  sections: string[];
  contextPaths: string[];
  /** 差し込み先の区間名（素名へ正規化済み）。未指定なら null */
  marker: string | null;
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string" && !!entry.trim(),
  );
}

export function parseGenerateWriteInput(
  input: Record<string, unknown>,
): GenerateWriteInput | { error: string } {
  const targetPath = nonEmptyString(input.path);
  const instruction = nonEmptyString(input.instruction);
  if (!targetPath) return { error: "path が空です" };
  if (!instruction) return { error: "instruction が空です" };

  const sections = stringArray(input.sections);
  if (sections.length > GENERATE_MAX_SECTIONS) {
    return {
      error: `sections が多すぎます（上限 ${GENERATE_MAX_SECTIONS} 件）。成果物を複数ファイルに分けてください`,
    };
  }

  const rawMarker = nonEmptyString(input.marker);
  const marker = rawMarker ? normalizeMarkerName(rawMarker) : null;
  if (rawMarker && !marker) {
    return {
      error: `marker の形式が不正です: ${rawMarker}。区間名（例: CONTENT）または <!-- CONTENT_START --> の形で指定してください`,
    };
  }

  return {
    purpose: nonEmptyString(input.purpose) ?? "",
    path: targetPath,
    instruction,
    sections,
    contextPaths: stringArray(input.context_paths),
    marker,
  };
}

export type ResolvedContextFile = {
  displayPath: string;
  content: string;
  truncated: boolean;
};

/**
 * context_paths を読取ゾーン（プロジェクト配下＋実行中スキル配下）で解決し、
 * 内容を読取上限つきで収集する。ゾーン外・不存在はエラー。
 */
export function resolveGenerateContextFiles(
  context: ToolExecutionContext,
  contextPaths: string[],
): ResolvedContextFile[] | { error: string } {
  const files: ResolvedContextFile[] = [];
  for (const entry of contextPaths) {
    const resolved = resolveToolTargetPath(
      context.projectRoot,
      context.workScopeKey,
      entry,
      {
        skillId: context.skillId,
        skillDirAbsolute: context.skillDirAbsolute,
        preferSkillIfExists: true,
      },
    );
    if ("error" in resolved) return { error: resolved.error };
    if (!resolved.insideProject && !resolved.insideSkill) {
      return {
        error: `context_paths はプロジェクト内または実行中スキル配下のみ指定できます: ${resolved.relativePath}`,
      };
    }
    if (
      !fs.existsSync(resolved.absolutePath) ||
      !fs.statSync(resolved.absolutePath).isFile()
    ) {
      return { error: `ファイルが見つかりません: ${resolved.relativePath}` };
    }
    const raw = fs.readFileSync(resolved.absolutePath, "utf-8");
    const truncated = raw.length > GENERATE_CONTEXT_FILE_CHAR_LIMIT;
    files.push({
      displayPath: resolved.relativePath,
      content: truncated ? raw.slice(0, GENERATE_CONTEXT_FILE_CHAR_LIMIT) : raw,
      truncated,
    });
  }
  return files;
}

/**
 * セクション間・max_tokens 継続間で不変の prefix（instruction + context + 全体構成）。
 * `cache_control` をこのブロックへ付与し、同一 generate_and_write 呼び出し内の
 * 全子呼び出しでキャッシュ再利用させる。
 */
function buildInvariantPrefix(
  input: GenerateWriteInput,
  contextFiles: ResolvedContextFile[],
): string {
  const lines: string[] = ["# 生成指示", input.instruction.trim()];

  if (contextFiles.length > 0) {
    lines.push("", "# 参考資料");
    for (const file of contextFiles) {
      lines.push(
        "",
        `## ${file.displayPath}${file.truncated ? "（先頭のみ抜粋）" : ""}`,
        file.content,
      );
    }
  }

  if (input.sections.length > 0) {
    lines.push(
      "",
      "# 全体のセクション構成",
      ...input.sections.map((section, i) => `${i + 1}. ${section}`),
    );
  }

  return lines.join("\n");
}

/** セクション・継続ごとに変化する部分（今回の出力範囲・直前生成の末尾抜粋） */
function buildVariablePart(
  input: GenerateWriteInput,
  sectionIndex: number,
  previousTail: string,
): string {
  const lines: string[] = [];

  if (input.sections.length > 0) {
    lines.push(
      "# 今回出力する範囲",
      `セクション ${sectionIndex + 1}: ${input.sections[sectionIndex]}`,
      "このセクションの本文のみを出力すること。他のセクションの内容を出力してはならない。",
    );
  }

  if (previousTail) {
    lines.push(
      "",
      "# 直前までに生成済みの本文（末尾抜粋。繰り返さず、この続きとして自然につながるように出力する）",
      previousTail,
    );
  }

  return lines.join("\n");
}

/**
 * 不変 prefix と可変部を 2 ブロックに分けたメッセージ content を組み立てる。
 * prefix 末尾に `cache_control` を付け、セクション間・継続間でのキャッシュ再利用を狙う。
 */
function buildSectionMessageContent(
  input: GenerateWriteInput,
  contextFiles: ResolvedContextFile[],
  sectionIndex: number,
  previousTail: string,
): LlmContentBlock[] {
  const prefix = buildInvariantPrefix(input, contextFiles);
  const variable = buildVariablePart(input, sectionIndex, previousTail);

  const blocks: LlmContentBlock[] = [
    { type: "text", text: prefix, cache_control: { type: "ephemeral" } },
  ];
  if (variable) {
    blocks.push({ type: "text", text: variable });
  }
  return blocks;
}

/** 出力全体がコードフェンスで囲まれている場合のみ剥がす（防御的救済） */
export function stripEnclosingCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return match ? match[1] : text;
}

function errorOutcome(message: string): ToolExecutionOutcome {
  return {
    result: { error: message },
    display: { summary: "error", display: `✗ ${message}` },
  };
}

function generateFailureOutcome(
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

/** 子 LLM 呼び出し（セクション分割・max_tokens 継続つき）を行うための入力 */
export type ChildGenerationParams = {
  generate: NonNullable<ToolExecutionContext["generate"]>;
  /** 子の system prompt（呼び出し元ごとに異なる役割文を渡す） */
  systemPrompt: string;
  instruction: string;
  sections: string[];
  contextFiles: ResolvedContextFile[];
  /** 生成合計サイズの上限（呼び出し元ごとに異なる） */
  totalCharLimit: number;
};

export type ChildGenerationResult =
  | { ok: true; text: string; sectionCount: number; continuations: number }
  | { ok: false; error: string; completedSections: number };

/**
 * 親の会話履歴を引き継がない子 LLM 呼び出しを、セクションごとに
 * （`max_tokens` 継続つきで）実行し、結果を連結して返す。
 * `generate_and_write` と `run_isolated_task` の共通基盤。
 */
export async function runChildGeneration(
  params: ChildGenerationParams,
): Promise<ChildGenerationResult> {
  const {
    generate,
    systemPrompt,
    instruction,
    sections,
    contextFiles,
    totalCharLimit,
  } = params;
  const sectionCount = Math.max(sections.length, 1);
  const sectionTexts: string[] = [];
  let totalContinuations = 0;
  // 継続上限はモデルプロファイルから解決する（軽量モデルは可視出力が短く上限に届きやすい）
  const continuationsPerSection = resolveModelProfile(generate.model)
    .continuations.generatePerSection;
  const genInput: GenerateWriteInput = {
    purpose: "",
    path: "",
    instruction,
    sections,
    contextPaths: [],
    marker: null,
  };

  for (let i = 0; i < sectionCount; i += 1) {
    const generatedSoFar = sectionTexts.join("\n\n");
    const previousTail = generatedSoFar.slice(-PREVIOUS_TAIL_CHAR_LIMIT);
    const firstMessageContent = buildSectionMessageContent(
      genInput,
      contextFiles,
      i,
      previousTail,
    );

    let sectionText = "";
    let continuations = 0;

    try {
      let messages: LlmMessage[] = [
        { role: "user", content: firstMessageContent },
      ];
      for (;;) {
        const turn = await generate.provider.runTurn({
          apiKey: generate.apiKey,
          model: generate.model,
          system: systemPrompt,
          messages,
          tools: [],
          maxTokens: generate.maxTokens,
          signal: generate.signal,
          providerParams: generate.providerParams,
        });
        sectionText += turn.text;

        const totalChars =
          generatedSoFar.length + (generatedSoFar ? 2 : 0) + sectionText.length;
        if (totalChars > totalCharLimit) {
          return {
            ok: false,
            error: `生成合計サイズが上限（${totalCharLimit} 文字）を超えました`,
            completedSections: sectionTexts.length,
          };
        }

        if (turn.stopReason !== "max_tokens") break;
        if (continuations >= continuationsPerSection) {
          return {
            ok: false,
            error: `セクション ${i + 1} の生成が継続上限（${continuationsPerSection} 回）でも完了しませんでした`,
            completedSections: sectionTexts.length,
          };
        }
        continuations += 1;
        totalContinuations += 1;
        messages = [
          { role: "user", content: firstMessageContent },
          { role: "assistant", content: sectionText },
          { role: "user", content: CONTINUE_PROMPT },
        ];
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "子 LLM 呼び出しに失敗しました";
      return {
        ok: false,
        error: `生成に失敗しました: ${message}`,
        completedSections: sectionTexts.length,
      };
    }

    const cleaned = stripEnclosingCodeFence(sectionText).trim();
    if (!cleaned) {
      return {
        ok: false,
        error: `セクション ${i + 1} の生成結果が空でした`,
        completedSections: sectionTexts.length,
      };
    }
    sectionTexts.push(cleaned);
  }

  return {
    ok: true,
    text: sectionTexts.join("\n\n"),
    sectionCount,
    continuations: totalContinuations,
  };
}

/**
 * generate_and_write の実行本体。
 * 親の tool 引数には本文を載せず、サーバ内の子 LLM 呼び出しで
 * セクションごとに本文を生成（max_tokens 継続つき）し、
 * 全セクション完了後に 1 回でファイルへ書き込む（途中失敗ではファイルを残さない）。
 */
export async function executeGenerateAndWrite(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): Promise<ToolExecutionOutcome> {
  const generate = context.generate;
  if (!generate) {
    return errorOutcome(
      "generate_and_write を実行するための LLM 設定がありません",
    );
  }

  const parsed = parseGenerateWriteInput(input);
  if ("error" in parsed) return errorOutcome(parsed.error);

  const targetResolved = resolveToolTargetPath(
    context.projectRoot,
    context.workScopeKey,
    parsed.path,
    {
      skillId: context.skillId,
      skillDirAbsolute: context.skillDirAbsolute,
      preferSkillIfExists: false,
      forWrite: true,
    },
  );
  if ("error" in targetResolved) return errorOutcome(targetResolved.error);
  if (targetResolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへの書込はできません: ${targetResolved.relativePath}`,
    );
  }
  // レッスン `.meta.json` は検査つき書込（write_file）だけを通す。
  // 生成書込は創作長文向けで、厳密 JSON のメタに使う理由が無い
  if (isLessonMetaWritePath(targetResolved)) {
    return errorOutcome(
      `.meta.json は generate_and_write では書けません。write_file で全体を書いてください: ${targetResolved.relativePath}`,
    );
  }

  const contextFiles = resolveGenerateContextFiles(
    context,
    parsed.contextPaths,
  );
  if ("error" in contextFiles) return errorOutcome(contextFiles.error);

  const startedAt = Date.now();
  const childResult = await runChildGeneration({
    generate,
    systemPrompt: GENERATOR_SYSTEM_PROMPT,
    instruction: parsed.instruction,
    sections: parsed.sections,
    contextFiles,
    totalCharLimit: GENERATE_TOTAL_CHAR_LIMIT,
  });
  if (!childResult.ok) {
    return generateFailureOutcome(
      childResult.error,
      childResult.completedSections,
    );
  }
  const sectionCount = childResult.sectionCount;
  const totalContinuations = childResult.continuations;

  // 読取上限で切り詰めた参照ファイルは、親と実行ログの双方から見えるようにする
  // （品質低下の原因が参照材料の欠落かを切り分けるため）。切り詰めなしなら何も足さない。
  const truncatedContextPaths = contextFiles
    .filter((file) => file.truncated)
    .map((file) => file.displayPath);

  const output = childResult.text;
  const durationMs = Date.now() - startedAt;

  const truncationNote =
    truncatedContextPaths.length > 0
      ? `（参照ファイルを読取上限 ${GENERATE_CONTEXT_FILE_CHAR_LIMIT} 文字で切り詰め: ${truncatedContextPaths.join("・")}）`
      : "";

  /** 完了ゲート: 残るプレースホルダー・未充填区間を tool_result で明示する */
  const templateStatusOf = (content: string) => {
    const scan = scanTemplateResiduals(content);
    return {
      complete: templateResidualCount(scan) === 0,
      remainingPlaceholders: scan.fillTokens,
      emptySections: scan.emptySections,
    };
  };

  const summaryResult = (
    templateStatus: ReturnType<typeof templateStatusOf>,
  ) => ({
    sections: sectionCount,
    continuations: totalContinuations,
    durationMs,
    templateStatus,
    ...(truncatedContextPaths.length > 0 ? { truncatedContextPaths } : {}),
  });

  if (parsed.marker) {
    return writeIntoMarkerSection({
      context,
      target: targetResolved,
      marker: parsed.marker,
      output,
      summaryResult: (content) => summaryResult(templateStatusOf(content)),
      truncationNote,
      sectionCount,
      totalContinuations,
    });
  }

  // 額縁テンプレートを丸ごと上書きしそうな場合は中間ファイル置き場へ退避する
  const decision = resolveFramedWriteTarget({
    absolutePath: targetResolved.absolutePath,
    relativePath: targetResolved.relativePath,
    workScopeKey: context.workScopeKey,
    projectRoot: context.projectRoot,
  });

  fs.mkdirSync(path.dirname(decision.absolutePath), { recursive: true });
  fs.writeFileSync(decision.absolutePath, output, "utf-8");
  const bytes = Buffer.byteLength(output, "utf-8");
  const commonResult = summaryResult(templateStatusOf(output));

  if (decision.kind === "divert") {
    return framedWriteDivertOutcome(decision, {
      label: "🪄 生成書込",
      bytes,
      extraResult: commonResult,
    });
  }

  return {
    result: {
      path: decision.relativePath,
      bytes,
      ...commonResult,
    },
    display: {
      summary: `${bytes} bytes`,
      display: `🪄 生成書込: ${decision.relativePath}（${bytes} bytes・${sectionCount} セクション・継続 ${totalContinuations} 回）${truncationNote}`,
    },
  };
}

/**
 * `marker` 指定時の書き込み。対象ファイルの当該区間だけを 1 回で置き換え、
 * マーカー自体と区間外（額縁）を保持する。
 * 区間が見つからない場合は対象を変更せず、生成本文を退避先へ書き込む
 * （生成をやり直させないため）。
 */
function writeIntoMarkerSection(params: {
  context: ToolExecutionContext;
  target: { absolutePath: string; relativePath: string };
  marker: string;
  output: string;
  summaryResult: (content: string) => Record<string, unknown>;
  truncationNote: string;
  sectionCount: number;
  totalContinuations: number;
}): ToolExecutionOutcome {
  const { context, target, marker, output } = params;

  const existing = fs.existsSync(target.absolutePath)
    ? fs.readFileSync(target.absolutePath, "utf-8")
    : null;
  const spliced =
    existing === null ? null : spliceMarkerSection(existing, marker, output);

  if (spliced === null) {
    const divert = resolveDivertTarget({
      relativePath: target.relativePath,
      workScopeKey: context.workScopeKey,
      projectRoot: context.projectRoot,
    });
    const available = existing ? findMarkerSectionNames(existing) : [];
    const notice =
      `${target.relativePath} に区間 ${marker} が見つかりませんでした。` +
      (available.length > 0
        ? `このファイルの区間は ${available.join(" / ")} です。`
        : existing === null
          ? "ファイルが存在しません。額縁を copy_file で配置してから差し込んでください。"
          : "このファイルに区間マーカーはありません。") +
      (divert
        ? `生成本文は ${divert.relativePath} へ書き込みました。区間名を確かめて replace_between（from_path）で差し込んでください。`
        : "");

    if (!divert) {
      return {
        result: { error: notice, recoverable: true },
        display: { summary: "error", display: `✗ ${notice}` },
      };
    }

    fs.mkdirSync(path.dirname(divert.absolutePath), { recursive: true });
    fs.writeFileSync(divert.absolutePath, output, "utf-8");
    const bytes = Buffer.byteLength(output, "utf-8");
    return {
      result: {
        path: divert.relativePath,
        bytes,
        diverted: true,
        markerNotFound: marker,
        requestedPath: target.relativePath,
        availableMarkers: available,
        notice,
        ...params.summaryResult(output),
      },
      display: {
        summary: "退避",
        display: `🪄 生成書込: ${divert.relativePath}（${bytes} bytes）\n↪ ${notice}`,
        tags: ["diverted"],
      },
    };
  }

  fs.writeFileSync(target.absolutePath, spliced, "utf-8");
  const bytes = Buffer.byteLength(spliced, "utf-8");
  const insertedChars = output.length;

  return {
    result: {
      path: target.relativePath,
      marker,
      bytes,
      insertedChars,
      ...params.summaryResult(spliced),
    },
    display: {
      summary: `${insertedChars} 文字`,
      display: `🪄 生成差し込み: ${target.relativePath} の ${marker} 区間（${insertedChars} 文字・${params.sectionCount} セクション・継続 ${params.totalContinuations} 回）${params.truncationNote}`,
    },
  };
}
