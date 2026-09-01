import fs from "node:fs";
import path from "node:path";
import { parseWorkScope, workScopeBaseDir } from "@/lib/work-scope";
import { isPathInsideWorkDir } from "@/lib/agent/skill-io-boundary";
import { findMarkerSectionNames } from "@/lib/agent/tools/replace-feedback";
import type { ToolExecutionOutcome } from "@/lib/agent/tools/execution-types";

/**
 * 額縁テンプレート（区間マーカーを持つ既存ファイル）への丸ごと上書きを防ぐ安全網。
 *
 * `write_file` / `generate_and_write` / `run_isolated_task` はいずれも書込先の
 * 既存内容を読まずに全文置換するため、額縁を成果物先に置いたあとで直接書くと
 * `<head>` や CDN 読み込みごと消える。ここで書き込み直前に判定し、額縁だった
 * 場合は中間ファイル置き場へ退避させる（エラーにせず、生成物を失わせない）。
 *
 * 判定はファイル内容の形だけを見る。スキル ID・スキル名・実行モデル名には
 * 依存しない（経路やスキルによって振る舞いが変わらないことが要件）。
 */

/** 中間ファイル置き場のフォルダ名（EBEX が束縛する具体名。契約・スキル側は役割語で書く） */
export const WORK_DIR_NAME = "_work";

/** 退避先ファイル名を作るときにパス区切りを置き換える文字列 */
const PATH_FLATTEN_SEPARATOR = "__";

export type FramedWriteTarget = {
  /** 実ファイルシステム上の絶対パス */
  absolutePath: string;
  /** 表示用パス（`contents/<フォーカス階層>/...`） */
  relativePath: string;
};

export type FramedWriteDivert = {
  kind: "divert";
  /** モデルが要求した元の書込先（額縁側。変更しない） */
  requested: FramedWriteTarget;
  /** 額縁が持つ区間マーカー名（差し込み先の候補として案内に使う） */
  markerNames: string[];
} & FramedWriteTarget;

export type FramedWriteDecision =
  | ({ kind: "write" } & FramedWriteTarget)
  | FramedWriteDivert;

export type ResolveFramedWriteTargetParams = {
  /** 書込先の絶対パス */
  absolutePath: string;
  /** 書込先の表示用パス（`contents/<フォーカス階層>/...`） */
  relativePath: string;
  /** 作業スコープ（`serializeWorkScope` の出力） */
  workScopeKey: string;
  /** リポジトリルート */
  projectRoot: string;
};

/**
 * 表示用パス（`contents/<フォーカス階層>/a/b.html`）から作業フォルダ相対（`a/b.html`）を得る。
 * 作業フォルダ配下でない場合は null。
 */
function toProjectRelative(
  relativePath: string,
  workScopeKey: string,
): string | null {
  const normalized = relativePath.replace(/\\/g, "/").trim();
  const scope = parseWorkScope(workScopeKey);
  if (!scope) return null;
  const prefix = workScopeBaseDir(scope) + "/";
  if (!normalized.startsWith(prefix)) return null;
  const rest = normalized.slice(prefix.length);
  return rest || null;
}

/**
 * 書込先が既存の額縁テンプレートかを判定する。
 * 条件は「既存ファイルであり、区間マーカー組を 1 つ以上含む」のみ。
 * 区間の数・充填状態・拡張子は条件に含めない。
 */
function detectMarkerNames(absolutePath: string): string[] {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    // 未作成のパスは保護対象外（新規作成は壊すものが無い）
    return [];
  }
  if (!stat.isFile()) return [];

  let content: string;
  try {
    content = fs.readFileSync(absolutePath, "utf-8");
  } catch {
    return [];
  }
  return findMarkerSectionNames(content);
}

/**
 * プロジェクト相対パスを中間ファイル置き場の 1 ファイル名へ平坦化する。
 * 同一の元パスに対して常に同一の結果を返す（モデルが退避先を推測できるように）。
 */
export function deriveDivertRelativePath(projectRelativePath: string): string {
  const flattened = projectRelativePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .join(PATH_FLATTEN_SEPARATOR);
  return `${WORK_DIR_NAME}/${flattened}`;
}

/**
 * 元の書込先に対応する退避先を求める。プロジェクト配下でない場合は null。
 * 額縁判定とは独立に使える（marker 指定の区間が見つからない場合の退避にも使う）。
 */
export function resolveDivertTarget(params: {
  relativePath: string;
  workScopeKey: string;
  projectRoot: string;
}): FramedWriteTarget | null {
  const projectRelative = toProjectRelative(
    params.relativePath,
    params.workScopeKey,
  );
  if (!projectRelative) return null;

  const divertRelative = deriveDivertRelativePath(projectRelative);
  const scope = parseWorkScope(params.workScopeKey);
  if (!scope) return null;
  const baseRelative = workScopeBaseDir(scope);
  const projectDirAbsolute = path.resolve(params.projectRoot, baseRelative);
  return {
    absolutePath: path.resolve(projectDirAbsolute, divertRelative),
    relativePath: `${baseRelative}/${divertRelative}`,
  };
}

/**
 * 書込先を解決する。額縁テンプレートであれば中間ファイル置き場へ退避させる。
 * 呼び出し側は返された `absolutePath` へ書き込むだけでよい。
 */
export function resolveFramedWriteTarget(
  params: ResolveFramedWriteTargetParams,
): FramedWriteDecision {
  const { absolutePath, relativePath, workScopeKey, projectRoot } = params;

  const asWrite: FramedWriteDecision = {
    kind: "write",
    absolutePath,
    relativePath,
  };

  // 中間ファイル置き場は退避先そのもの。ここを保護すると退避が自己参照的に連鎖する
  if (isPathInsideWorkDir(relativePath, workScopeKey)) return asWrite;

  const projectRelative = toProjectRelative(relativePath, workScopeKey);
  if (!projectRelative) return asWrite;

  const markerNames = detectMarkerNames(absolutePath);
  if (markerNames.length === 0) return asWrite;

  const divert = resolveDivertTarget({
    relativePath,
    workScopeKey,
    projectRoot,
  });
  if (!divert) return asWrite;

  return {
    kind: "divert",
    absolutePath: divert.absolutePath,
    relativePath: divert.relativePath,
    requested: { absolutePath, relativePath },
    markerNames,
  };
}

/**
 * 退避が起きたことと次の 1 手を、モデルへ返す案内文にする。
 * エラーではなく成功として返すため、文面も「どうすれば差し込めるか」に絞る。
 */
export function framedWriteDivertNotice(decision: FramedWriteDivert): string {
  const markers = decision.markerNames.join(" / ");
  return (
    `${decision.requested.relativePath} は差し込み区間（${markers}）を持つ額縁テンプレートのため、` +
    `丸ごと上書きせず ${decision.relativePath} へ書き込みました。` +
    `額縁へ反映するには replace_between を start_marker: "<!-- ${decision.markerNames[0]}_START -->"、` +
    `end_marker: "<!-- ${decision.markerNames[0]}_END -->"、from_path: "${decision.relativePath}" で呼んでください。`
  );
}

/**
 * 退避を「成功」として返す tool_result を組み立てる。
 * 3 つの書込経路で結果の形を揃えるため、共通部分をここに集約する。
 * ツール固有の情報（セクション数・所要時間等）は `extraResult` で足す。
 */
export function framedWriteDivertOutcome(
  decision: FramedWriteDivert,
  options: {
    label: string;
    bytes: number;
    extraResult?: Record<string, unknown>;
  },
): ToolExecutionOutcome {
  const notice = framedWriteDivertNotice(decision);
  return {
    result: {
      path: decision.relativePath,
      bytes: options.bytes,
      diverted: true,
      requestedPath: decision.requested.relativePath,
      markerNames: decision.markerNames,
      notice,
      ...options.extraResult,
    },
    display: {
      summary: "退避",
      display: `${options.label}: ${decision.relativePath}（${options.bytes} bytes）\n↪ ${notice}`,
      tags: ["diverted"],
    },
  };
}
