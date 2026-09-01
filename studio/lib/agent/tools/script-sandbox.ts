import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** スクリプト実行の制限時間（無限ループ対策） */
export const SCRIPT_TIMEOUT_MS = 30_000;
/** tool_result へ返す stdout / stderr の文字数上限（履歴汚染防止） */
export const SCRIPT_OUTPUT_CHAR_LIMIT = 4_000;
/** 子プロセスの stdout/stderr バッファ上限 */
const SCRIPT_MAX_BUFFER_BYTES = 4 * 1024 * 1024;

const TEMP_SCRIPT_DIR_NAME = "dx-studio-scripts";

export type ScriptSandboxTarget =
  | { kind: "code"; code: string }
  | { kind: "file"; scriptPathAbsolute: string; args?: string[] };

export type ScriptSandboxOptions = {
  /**
   * 作業フォルダ（フォーカス中のコンテンツフォルダ）。cwd になり、
   * 明示プレフィックスのない相対パスの基準にもなる。
   */
  projectDirAbsolute: string;
  /**
   * fs 書込を追加で許可するディレクトリ（作業ツリー `contents-work/`）。
   * 書込許可ルートが 2 つあるため、宣言できる writes と実際に書ける場所を一致させる。
   */
  extraWriteDirsAbsolute?: string[];
  /** fs 読取を追加で許可するディレクトリ（実行中スキル） */
  skillDirAbsolute?: string;
  timeoutMs?: number;
  /** ユーザー中断シグナル。abort で子プロセスを即 kill する */
  signal?: AbortSignal;
};

export type ScriptRunResult =
  | { ok: true; stdout: string; durationMs: number }
  | {
      ok: false;
      error: string;
      stderr?: string;
      exitCode?: number | null;
      timedOut?: boolean;
      /** ユーザー中断による打ち切り（タイムアウトとは区別する） */
      aborted?: boolean;
    };

export type SyntaxCheckResult = { ok: true } | { ok: false; error: string };

const NETWORK_HINT_PATTERN =
  /require\(\s*["'](?:node:)?(?:https?|net|tls|dgram|http2)["']\s*\)|\bfetch\s*\(|XMLHttpRequest|WebSocket/;

/**
 * ネットワークアクセスの兆候をコードから静的に検出する（確認ダイアログの警告表示用）。
 * 誤検出があり得るため、ブロックには使わない。
 */
export function detectNetworkAccessHint(code: string): boolean {
  return NETWORK_HINT_PATTERN.test(code);
}

export function truncateScriptOutput(text: string): string {
  if (text.length <= SCRIPT_OUTPUT_CHAR_LIMIT) return text;
  return `${text.slice(0, SCRIPT_OUTPUT_CHAR_LIMIT)}\n…（${text.length} 文字中先頭 ${SCRIPT_OUTPUT_CHAR_LIMIT} 文字に切り詰め）`;
}

type ExecOutcome = {
  error:
    | (Error & { killed?: boolean; code?: unknown; signal?: string | null })
    | null;
  stdout: string;
  stderr: string;
};

function execNode(
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
    signal?: AbortSignal;
  },
): Promise<ExecOutcome> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeout,
        maxBuffer: SCRIPT_MAX_BUFFER_BYTES,
        windowsHide: true,
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.env ? { env: options.env } : {}),
      },
      (error, stdout, stderr) => {
        resolve({
          error: error as ExecOutcome["error"],
          stdout: stdout ?? "",
          stderr: stderr ?? "",
        });
      },
    );
  });
}

/**
 * サンドボックス子プロセスへ継承させる環境変数のホワイトリスト。
 * node 実行そのものに必要な最小項目のみとし、サーバプロセスの秘密情報
 * （API キー等）は渡さない。
 */
const ENV_ALLOWLIST = [
  "PATH",
  "SystemRoot",
  "windir",
  "TEMP",
  "TMP",
  "HOME",
  "TMPDIR",
  "LANG",
  "LC_ALL",
];

/** allowlist 済みの継承項目 + サンドボックス専用の追加変数から env を組み立てる */
function buildSandboxEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  // NODE_ENV は Next.js の型拡張で必須のため明示的に継承する（allowlist の対象外）
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV ?? "development",
  };
  for (const key of ENV_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...extra };
}

let permissionModelSupported: boolean | null = null;

/**
 * 実行環境の Node が Permission Model（`--permission`）を受理するか検査する。
 * 初回のみ実プロセスで確認し、以降はキャッシュする。
 */
export async function checkPermissionModelSupport(): Promise<boolean> {
  if (permissionModelSupported !== null) return permissionModelSupported;
  const outcome = await execNode(["--permission", "-e", "process.exit(0)"], {
    timeout: 10_000,
  });
  permissionModelSupported =
    !outcome.error || !/bad option/i.test(outcome.stderr);
  return permissionModelSupported;
}

/** テスト用: サポート判定キャッシュをリセットする */
export function resetPermissionModelSupportCache(): void {
  permissionModelSupported = null;
}

export const PERMISSION_MODEL_UNSUPPORTED_ERROR =
  "実行環境の Node.js が Permission Model（--permission）に対応していないため、スクリプトを実行できません。Node.js のバージョンを更新してください。";

/**
 * CommonJS スクリプトの構文を実行せずに検査する（`node --check`）。
 */
export async function checkScriptSyntax(
  code: string,
): Promise<SyntaxCheckResult> {
  const scriptPath = await writeTempScript(code);
  try {
    const outcome = await execNode(["--check", scriptPath], {
      timeout: 10_000,
    });
    if (!outcome.error) return { ok: true };
    const message = outcome.stderr.replaceAll(scriptPath, "script.cjs").trim();
    return {
      ok: false,
      error: truncateScriptOutput(message || "構文エラーです"),
    };
  } finally {
    removeQuietly(scriptPath);
  }
}

async function writeTempScript(code: string): Promise<string> {
  const dir = path.join(os.tmpdir(), TEMP_SCRIPT_DIR_NAME);
  await fs.promises.mkdir(dir, { recursive: true });
  const scriptPath = path.join(dir, `${crypto.randomUUID()}.cjs`);
  await fs.promises.writeFile(scriptPath, code, "utf-8");
  return scriptPath;
}

function removeQuietly(filePath: string): void {
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // 一時ファイルの削除失敗は無視する
  }
}

/** ディレクトリ自身と配下すべてを許可する Permission Model 用パターン */
function directoryPermissionPatterns(dirAbsolute: string): string[] {
  const normalized = path.resolve(dirAbsolute);
  return [normalized, path.join(normalized, "*")];
}

/**
 * `--allow-fs-read` と `DX_STUDIO_SKILL_DIR` の両方がここを経由することで、
 * 読取許可と env が別々の変数から組み立てられて食い違う事故を防ぐ。
 */
function resolveSkillDirForSandbox(
  options: Pick<ScriptSandboxOptions, "skillDirAbsolute">,
): string | undefined {
  const raw = options.skillDirAbsolute?.trim();
  return raw ? path.resolve(raw) : undefined;
}

function buildPermissionArgs(
  scriptPathAbsolute: string,
  options: ScriptSandboxOptions,
): string[] {
  const extraWriteDirs = options.extraWriteDirsAbsolute ?? [];
  const readTargets = [
    ...directoryPermissionPatterns(options.projectDirAbsolute),
    ...extraWriteDirs.flatMap(directoryPermissionPatterns),
    scriptPathAbsolute,
  ];
  const resolvedSkillDir = resolveSkillDirForSandbox(options);
  if (resolvedSkillDir) {
    readTargets.push(...directoryPermissionPatterns(resolvedSkillDir));
  }
  const writeTargets = [
    ...directoryPermissionPatterns(options.projectDirAbsolute),
    ...extraWriteDirs.flatMap(directoryPermissionPatterns),
  ];

  // パスにカンマが含まれても壊れないよう、フラグを 1 対象ずつ繰り返す
  return [
    "--permission",
    ...readTargets.map((target) => `--allow-fs-read=${target}`),
    ...writeTargets.map((target) => `--allow-fs-write=${target}`),
  ];
}

function describeRunFailure(outcome: ExecOutcome): ScriptRunResult {
  const error = outcome.error;
  const stderr = truncateScriptOutput(outcome.stderr.trim());
  // ユーザー中断（AbortSignal 経由）はタイムアウトより先に判定する。
  // abort も killed を立てるため、順序を誤ると timeout と混同する。
  if (error?.name === "AbortError" || error?.code === "ABORT_ERR") {
    return {
      ok: false,
      error: "スクリプトの実行がユーザー操作により中断されました（打ち切り）",
      stderr: stderr || undefined,
      aborted: true,
    };
  }
  if (error?.killed) {
    return {
      ok: false,
      error:
        "スクリプトの実行がタイムアウトしました（制限時間超過のため強制終了）",
      stderr: stderr || undefined,
      timedOut: true,
    };
  }
  const exitCode = typeof error?.code === "number" ? error.code : null;
  const firstLine =
    outcome.stderr
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "不明なエラー";
  return {
    ok: false,
    error: `スクリプト実行エラー: ${firstLine.slice(0, 200)}`,
    stderr: stderr || undefined,
    exitCode,
  };
}

/**
 * スクリプトをサンドボックス（Node 子プロセス + Permission Model）で実行する。
 * - fs 読取: プロジェクト + スキル dir + スクリプト自身のみ
 * - fs 書込: プロジェクトのみ
 * - `cwd` はプロジェクトに固定、タイムアウト・出力サイズ上限あり
 */
export async function runScriptInSandbox(
  target: ScriptSandboxTarget,
  options: ScriptSandboxOptions,
): Promise<ScriptRunResult> {
  const supported = await checkPermissionModelSupport();
  if (!supported) {
    return { ok: false, error: PERMISSION_MODEL_UNSUPPORTED_ERROR };
  }

  let scriptPath: string;
  let ownsTempScript = false;
  let args: string[] = [];
  if (target.kind === "code") {
    scriptPath = await writeTempScript(target.code);
    ownsTempScript = true;
  } else {
    scriptPath = path.resolve(target.scriptPathAbsolute);
    args = target.args ?? [];
  }

  const resolvedSkillDir = resolveSkillDirForSandbox(options);
  const sandboxEnv = buildSandboxEnv({
    DX_STUDIO_PROJECT_DIR: path.resolve(options.projectDirAbsolute),
    ...(resolvedSkillDir ? { DX_STUDIO_SKILL_DIR: resolvedSkillDir } : {}),
  });

  const startedAt = Date.now();
  try {
    const outcome = await execNode(
      [...buildPermissionArgs(scriptPath, options), scriptPath, ...args],
      {
        cwd: options.projectDirAbsolute,
        timeout: options.timeoutMs ?? SCRIPT_TIMEOUT_MS,
        env: sandboxEnv,
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    if (outcome.error) {
      return describeRunFailure(outcome);
    }
    return {
      ok: true,
      stdout: truncateScriptOutput(outcome.stdout.trim()),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (ownsTempScript) removeQuietly(scriptPath);
  }
}
