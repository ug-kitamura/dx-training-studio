import fs from "node:fs";
import path from "node:path";
import {
  CONTENTS_DIR_NAME,
  resolveToolTargetPath,
  type ResolveToolPathOptions,
  type ToolPathError,
} from "@/lib/agent/tools/fs-guard";
import { detectNetworkAccessHint } from "@/lib/agent/tools/script-sandbox";
import { normalizeMarkerName } from "@/lib/agent/tools/replace-feedback";
import { isPathInsideWorkDir } from "@/lib/agent/skill-io-boundary";
import { isContentFolderName } from "@/lib/contents-loader";
import type { LlmMessage, ToolCall } from "@/lib/agent/llm/types";
import type { ConfirmKind } from "@/lib/agent/tools/confirm-kind";

export type { ConfirmKind };

/** スクリプト実行確認の表示ペイロード */
export type ConfirmScriptInfo = {
  /** 何のために実行するか（モデル申告） */
  purpose: string;
  /** 実行されるコード全文（折りたたみ表示用） */
  code: string;
  /** 書き込み予定パスと、既存ファイル（上書き）かどうか */
  writes: Array<{ path: string; exists: boolean }>;
  /** ネットワークアクセスの兆候を静的検出したか（警告表示用、ブロックはしない） */
  networkWarning: boolean;
  /** run_skill_script のスクリプトパス（表示用） */
  scriptPath?: string;
  /** run_skill_script の引数 */
  args?: string[];
};

/** web 検索確認の表示ペイロード */
export type ConfirmSearchInfo = {
  /** 外部へ送信される検索クエリ全文 */
  query: string;
  /** 何のために検索するか（モデル申告） */
  purpose: string;
};

/** inline_html_assets 確認の表示ペイロード */
export type ConfirmInlineAssetsInfo = {
  /** 上書き対象のパス（プロジェクト相対） */
  targets: string[];
};

/** 正本ツリーで新しく作られる階層 */
export type ConfirmCreatedFolder = {
  /** どの階層か */
  level: "series" | "course" | "lesson";
  /** フォルダ名（ユーザーが打ち間違いを読んで判別できるよう原文のまま） */
  name: string;
};

/** コンテンツフォルダ作成確認の表示ペイロード */
export type ConfirmCreateFolderInfo = {
  /** 新しく作られる階層。上位（シリーズ）から順に並ぶ */
  folders: ConfirmCreatedFolder[];
};

/** generate_and_write 確認の表示ペイロード */
export type ConfirmGenerateInfo = {
  /** 何のために生成するか（モデル申告） */
  purpose: string;
  /** 生成指示（折りたたみ表示用） */
  instruction: string;
  /** セクション分割の指示 */
  sections: string[];
  /** 子プロンプトへ渡される参照ファイル */
  contextPaths: string[];
  /**
   * 差し込み先の区間名（`generate_and_write` の marker）。
   * 設定されている場合、書き込みはファイル全体の上書きではなく当該区間への差し込みになる。
   */
  marker?: string;
};

export type ConfirmRequirement = {
  kind: ConfirmKind;
  /** 表示用の対象パス */
  path: string;
  /** 書込ツールで、既存ファイルへの上書きかどうか */
  isNew: boolean;
  /** スクリプト実行確認（kind: run-script / run-skill-script）の表示情報 */
  script?: ConfirmScriptInfo;
  /** web 検索確認（kind: web-search）の表示情報 */
  search?: ConfirmSearchInfo;
  /** 生成書込確認（kind: generate-write）の表示情報 */
  generate?: ConfirmGenerateInfo;
  /** インライン化確認（kind: inline-assets）の表示情報 */
  inlineAssets?: ConfirmInlineAssetsInfo;
  /** コンテンツフォルダ作成確認（kind: create-content-folder）の表示情報 */
  createFolder?: ConfirmCreateFolderInfo;
};

export type ConfirmGateOptions = ResolveToolPathOptions & {
  /**
   * 上書き確認をスキップするパス（表示用パス。リポジトリルート相対）。
   * AI が今セッションで作成したファイル、またはユーザーが一度許可したファイル。
   */
  skipOverwritePaths?: ReadonlySet<string>;
  /**
   * web 検索が利用可能か（検索 API キーが設定されているか）。
   * false のとき web_search は確認ではなく人手フォールバック（web-search-manual）を提示する。
   */
  searchAvailable?: boolean;
};

const READ_TOOL_NAMES = new Set([
  "list_files",
  "glob_files",
  "search_content",
  "read_file",
]);
const WRITE_TOOL_NAMES = new Set([
  "write_file",
  "mkdir",
  "replace_in_file",
  "replace_between",
  "append_file",
]);

function extractPathInput(call: ToolCall): string | null {
  const value = call.input?.path;
  return typeof value === "string" && value.trim() ? value : null;
}

export function normalizeConfirmPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function shouldSkipOverwrite(
  relativePath: string,
  skipOverwritePaths?: ReadonlySet<string>,
): boolean {
  if (!skipOverwritePaths || skipOverwritePaths.size === 0) return false;
  const normalized = normalizeConfirmPath(relativePath);
  if (skipOverwritePaths.has(normalized)) return true;
  // input が作業フォルダ相対（notes.md）で set が contents/<階層>/notes.md の場合など
  for (const skipped of skipOverwritePaths) {
    if (skipped === normalized) return true;
    if (
      skipped.endsWith(`/${normalized}`) ||
      normalized.endsWith(`/${skipped}`)
    ) {
      return true;
    }
  }
  return false;
}

/** 正本ツリーの階層順（上位から） */
const CONTENT_FOLDER_LEVELS = ["series", "course", "lesson"] as const;

/**
 * 正本ツリーへの書込で**新しく生まれる構造の階層**を、上位から順に列挙する。
 *
 * 対象は `contents/` 直下から 3 段（シリーズ・コース・レッスン）だけ。
 * レッスンより深いディレクトリはローダーが走査しないため確認しない。
 * `_` / `.` 始まりも構造として解釈されない（`isContentFolderName`）ので確認しない。
 *
 * 既に全段が存在する場合は空配列（＝確認不要。上書き確認の判定へ落ちる）。
 */
function collectCreatedContentFolders(
  projectRoot: string,
  relativePath: string,
): ConfirmCreatedFolder[] {
  // 末尾のファイル名を除いたディレクトリ部分
  const dirSegments = relativePath.split("/").slice(1, -1).filter(Boolean);

  const created: ConfirmCreatedFolder[] = [];
  let dir = path.resolve(projectRoot, CONTENTS_DIR_NAME);
  for (const [index, level] of CONTENT_FOLDER_LEVELS.entries()) {
    const name = dirSegments[index];
    if (!name) break;
    dir = path.resolve(dir, name);
    if (!isContentFolderName(name)) continue;
    if (!fs.existsSync(dir)) created.push({ level, name });
  }
  return created;
}

function resolveWriteConfirm(
  projectRoot: string,
  workScopeKey: string,
  inputPath: string,
  options: ConfirmGateOptions,
  requireExistsForOverwrite: boolean,
): ConfirmRequirement | null {
  const { skipOverwritePaths, ...skillOptions } = options;
  const resolved = resolveToolTargetPath(
    projectRoot,
    workScopeKey,
    inputPath,
    {
      ...skillOptions,
      preferSkillIfExists: false,
      // 規約に反するパスは実行時にパスガードが拒否する。確認は出さない
      forWrite: true,
    },
  );
  if ("error" in resolved) return null;
  if (resolved.insideSkill) return null;
  if (!resolved.insideProject) return null;

  // 新しいシリーズ・コース・レッスンが生まれる書込は、上書き判定より先に確認する
  // （両者は排他: 階層が無ければファイルも存在しない）
  if (resolved.zone === "contents") {
    const folders = collectCreatedContentFolders(
      projectRoot,
      resolved.relativePath,
    );
    if (folders.length > 0) {
      return {
        kind: "create-content-folder",
        path: resolved.relativePath,
        isNew: true,
        createFolder: { folders },
      };
    }
  }

  const exists = fs.existsSync(resolved.absolutePath);
  if (exists && requireExistsForOverwrite) {
    if (shouldSkipOverwrite(resolved.relativePath, skipOverwritePaths)) {
      return null;
    }
    if (isPathInsideWorkDir(resolved.relativePath, workScopeKey)) {
      return null;
    }
    return { kind: "overwrite", path: resolved.relativePath, isNew: false };
  }
  return null;
}

/**
 * ツール呼び出しがユーザー確認を要するかどうかを判定する。
 * - 正本ツリーに新しいシリーズ・コース・レッスンが生まれる書込は確認必要
 *   （`create-content-folder`。3 階層まとめて 1 回。上書き確認とは排他）
 * - それ以外のプロジェクト内の新規書込・L1/L2 発見/読取は確認不要
 * - 実行中スキル配下の読取は確認不要（書込は実行時に拒否）
 * - プロジェクト内の既存ファイルへの上書きは確認必要（`overwrite`）
 *   ただし AI 作成済み／一度許可済みパス（skipOverwritePaths）は不要
 * - 書込許可ルート（`contents/` と `contents-work/`）の外はパスガードが拒否する
 */
const SCRIPT_CODE_DISPLAY_CHAR_LIMIT = 20_000;

function resolveScriptWrites(
  projectRoot: string,
  workScopeKey: string,
  writesInput: unknown,
  options: ConfirmGateOptions,
): Array<{ path: string; exists: boolean }> {
  const raw = Array.isArray(writesInput) ? writesInput : [];
  const writes: Array<{ path: string; exists: boolean }> = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || !entry.trim()) continue;
    const resolved = resolveToolTargetPath(
      projectRoot,
      workScopeKey,
      entry,
      {
        ...options,
        preferSkillIfExists: false,
      },
    );
    if ("error" in resolved) continue;
    writes.push({
      path: resolved.relativePath,
      exists: fs.existsSync(resolved.absolutePath),
    });
  }
  return writes;
}

/**
 * run_script / run_skill_script の確認要求を組み立てる。
 * スクリプト実行は毎回確認する（skipOverwritePaths によるスキップはしない）。
 */
function resolveScriptConfirm(
  projectRoot: string,
  workScopeKey: string,
  call: ToolCall,
  options: ConfirmGateOptions,
): ConfirmRequirement | null {
  const purpose =
    typeof call.input?.purpose === "string" ? call.input.purpose : "";

  if (call.name === "run_script") {
    const code = typeof call.input?.code === "string" ? call.input.code : "";
    if (!code.trim()) return null; // broken tool_use 経路で処理される
    const writes = resolveScriptWrites(
      projectRoot,
      workScopeKey,
      call.input?.writes,
      options,
    );
    return {
      kind: "run-script",
      path: writes[0]?.path ?? "(スクリプト実行)",
      isNew: false,
      script: {
        purpose,
        code: code.slice(0, SCRIPT_CODE_DISPLAY_CHAR_LIMIT),
        writes,
        networkWarning: detectNetworkAccessHint(code),
      },
    };
  }

  const scriptPathInput =
    typeof call.input?.script_path === "string" ? call.input.script_path : "";
  if (!scriptPathInput.trim()) return null;
  const resolved = resolveToolTargetPath(
    projectRoot,
    workScopeKey,
    scriptPathInput,
    { ...options, preferSkillIfExists: true },
  );
  if ("error" in resolved) return null; // 実行時に拒否される
  let code = "";
  try {
    code = fs
      .readFileSync(resolved.absolutePath, "utf-8")
      .slice(0, SCRIPT_CODE_DISPLAY_CHAR_LIMIT);
  } catch {
    // 存在しない場合は preflight で拒否される
  }
  const args = Array.isArray(call.input?.args)
    ? call.input.args.filter((arg): arg is string => typeof arg === "string")
    : [];
  return {
    kind: "run-skill-script",
    path: resolved.relativePath,
    isNew: false,
    script: {
      purpose,
      code,
      writes: [],
      networkWarning: detectNetworkAccessHint(code),
      scriptPath: resolved.relativePath,
      args,
    },
  };
}

/**
 * generate_and_write の確認要求を組み立てる。
 * 子 LLM 呼び出し（API トークン消費）を伴うため、書込先が新規でも毎回確認する
 * （skipOverwritePaths によるスキップはしない）。
 * 書込許可ルート外はパスガードが実行時に拒否するため、確認要求は出さない。
 */
function resolveGenerateConfirm(
  projectRoot: string,
  workScopeKey: string,
  call: ToolCall,
  options: ConfirmGateOptions,
): ConfirmRequirement | null {
  const inputPath = extractPathInput(call);
  const instruction =
    typeof call.input?.instruction === "string" ? call.input.instruction : "";
  if (!inputPath || !instruction.trim()) return null; // broken tool_use 経路で処理される

  const resolved = resolveToolTargetPath(
    projectRoot,
    workScopeKey,
    inputPath,
    { ...options, preferSkillIfExists: false },
  );
  if ("error" in resolved) return null; // 実行時に拒否される
  if (resolved.insideSkill) return null; // 実行時に拒否される
  if (!resolved.insideProject) return null; // 実行時に拒否される

  const exists = fs.existsSync(resolved.absolutePath);

  const toStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter(
          (entry): entry is string =>
            typeof entry === "string" && !!entry.trim(),
        )
      : [];

  const marker =
    typeof call.input?.marker === "string"
      ? (normalizeMarkerName(call.input.marker) ?? undefined)
      : undefined;

  return {
    kind: "generate-write",
    path: resolved.relativePath,
    isNew: !exists,
    generate: {
      purpose:
        typeof call.input?.purpose === "string" ? call.input.purpose : "",
      instruction: instruction.slice(0, SCRIPT_CODE_DISPLAY_CHAR_LIMIT),
      sections: toStringArray(call.input?.sections),
      contextPaths: toStringArray(call.input?.context_paths),
      ...(marker ? { marker } : {}),
    },
  };
}

/**
 * run_isolated_task の確認要求を組み立てる。
 * generate_and_write と同じく子 LLM 呼び出し（API トークン消費）を伴うため毎回確認する。
 * path は任意（省略時は結果テキストをそのまま返す。書込を伴わないため上書き区別は無い）。
 */
function resolveIsolatedTaskConfirm(
  projectRoot: string,
  workScopeKey: string,
  call: ToolCall,
  options: ConfirmGateOptions,
): ConfirmRequirement | null {
  const instruction =
    typeof call.input?.instruction === "string" ? call.input.instruction : "";
  if (!instruction.trim()) return null; // broken tool_use 経路で処理される

  const toStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter(
          (entry): entry is string =>
            typeof entry === "string" && !!entry.trim(),
        )
      : [];

  const inputPath = extractPathInput(call);
  const generateInfo = {
    purpose: typeof call.input?.purpose === "string" ? call.input.purpose : "",
    instruction: instruction.slice(0, SCRIPT_CODE_DISPLAY_CHAR_LIMIT),
    sections: toStringArray(call.input?.sections),
    contextPaths: toStringArray(call.input?.context_paths),
  };

  if (!inputPath) {
    return {
      kind: "isolated-task",
      path: "(独立実行タスク)",
      isNew: false,
      generate: generateInfo,
    };
  }

  const resolved = resolveToolTargetPath(
    projectRoot,
    workScopeKey,
    inputPath,
    {
      ...options,
      preferSkillIfExists: false,
    },
  );
  if ("error" in resolved) return null; // 実行時に拒否される
  if (resolved.insideSkill) return null; // 実行時に拒否される
  if (!resolved.insideProject) return null; // 実行時に拒否される

  const exists = fs.existsSync(resolved.absolutePath);

  return {
    kind: "isolated-task",
    path: resolved.relativePath,
    isNew: !exists,
    generate: generateInfo,
  };
}

export function resolveConfirmRequirement(
  projectRoot: string,
  workScopeKey: string,
  call: ToolCall,
  options: ConfirmGateOptions = {},
): ConfirmRequirement | null {
  if (call.name === "run_script" || call.name === "run_skill_script") {
    return resolveScriptConfirm(projectRoot, workScopeKey, call, options);
  }

  if (call.name === "generate_and_write") {
    return resolveGenerateConfirm(projectRoot, workScopeKey, call, options);
  }

  if (call.name === "run_isolated_task") {
    return resolveIsolatedTaskConfirm(
      projectRoot,
      workScopeKey,
      call,
      options,
    );
  }

  if (call.name === "inline_html_assets") {
    // 対象が複数でも確認は 1 回にまとめる（差し込み・展開を分割実行させないため）
    const raw = Array.isArray(call.input?.paths) ? call.input.paths : [];
    const targets = raw.filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0,
    );
    if (targets.length === 0) return null;
    return {
      kind: "inline-assets",
      path: targets.join(" / "),
      isNew: false,
      inlineAssets: { targets },
    };
  }

  if (call.name === "web_search") {
    const query =
      typeof call.input?.query === "string" ? call.input.query.trim() : "";
    if (!query) return null;
    const purpose =
      typeof call.input?.purpose === "string" ? call.input.purpose : "";
    // 検索 API キーが未設定なら、検索可否の確認ではなく人手フォールバックを提示する。
    // キーがあれば従来どおり「検索してよいか」の確認を出す（サーキットブレーカー中も同様）。
    return {
      kind:
        options.searchAvailable === false ? "web-search-manual" : "web-search",
      path: query,
      isNew: false,
      search: { query, purpose },
    };
  }

  if (call.name === "copy_file") {
    const from =
      typeof call.input?.from === "string" && call.input.from.trim()
        ? call.input.from
        : null;
    const to =
      typeof call.input?.to === "string" && call.input.to.trim()
        ? call.input.to
        : null;
    if (!from || !to) return null;

    // コピー元が読取許可ゾーン外の場合は実行時にパスガードが拒否する。
    // 確認は書込先についてのみ行う。
    return resolveWriteConfirm(projectRoot, workScopeKey, to, options, true);
  }

  const isRead = READ_TOOL_NAMES.has(call.name);
  const isWrite = WRITE_TOOL_NAMES.has(call.name);
  if (!isRead && !isWrite) return null;

  const inputPath = extractPathInput(call);
  if (!inputPath) return null;

  // 読取は確認不要。読取許可ゾーン外はパスガードが実行時に拒否する
  if (isRead) return null;

  const requireOverwrite =
    call.name === "write_file" ||
    call.name === "replace_in_file" ||
    call.name === "replace_between" ||
    call.name === "append_file" ||
    call.name === "copy_file";
  return resolveWriteConfirm(
    projectRoot,
    workScopeKey,
    inputPath,
    options,
    requireOverwrite ||
      call.name === "replace_in_file" ||
      call.name === "replace_between" ||
      call.name === "append_file",
  );
}

/** 成功した書込系 tool_result から、上書きスキップ用パスを収集する */
export function collectWrittenPathsFromToolResult(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  const record = result as Record<string, unknown>;
  const paths: string[] = [];
  if (typeof record.path === "string" && record.path.trim()) {
    paths.push(normalizeConfirmPath(record.path));
  }
  if (typeof record.to === "string" && record.to.trim()) {
    paths.push(normalizeConfirmPath(record.to));
  }
  if (Array.isArray(record.writes)) {
    for (const entry of record.writes) {
      if (typeof entry === "string" && entry.trim()) {
        paths.push(normalizeConfirmPath(entry));
      }
    }
  }
  return paths;
}

/** 過去ターンの tool_result から AI が書いたパスを復元する */
export function seedSkipOverwritePathsFromHistory(
  messages: LlmMessage[],
): Set<string> {
  const paths = new Set<string>();
  for (const message of messages) {
    if (typeof message.content === "string") continue;
    for (const block of message.content) {
      if (block.type !== "tool_result") continue;
      try {
        const parsed: unknown = JSON.parse(block.content);
        for (const path of collectWrittenPathsFromToolResult(parsed)) {
          // エラー結果は path だけ付くことがあるので、成功っぽいキーがあるものに限定
          if (
            parsed &&
            typeof parsed === "object" &&
            ("bytes" in parsed ||
              "replacements" in parsed ||
              "replacedChars" in parsed ||
              "insertedChars" in parsed ||
              "to" in parsed ||
              ("writes" in parsed && !("error" in parsed)) ||
              ("path" in parsed && !("error" in parsed)))
          ) {
            paths.add(path);
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return paths;
}

export type { ToolPathError };
