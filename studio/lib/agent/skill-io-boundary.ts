import { parseWorkScope, workScopeBaseDir } from "@/lib/work-scope";

/** 作業フォルダ（フォーカス中のコンテンツフォルダ）の表示用プレフィックス */
function scopePrefix(workScopeKey: string): string | null {
  const scope = parseWorkScope(workScopeKey);
  if (!scope) return null;
  return `${workScopeBaseDir(scope)}/`;
}

export type OutputDestinationChoice = "same-folder" | "project-root";

export type OutputDestinationOption = {
  id: OutputDestinationChoice;
  label: string;
  /** プロジェクト根からの相対ディレクトリ（'' は直下） */
  relativeDir: string;
};

/**
 * パスが作業フォルダの `_work/` 配下か（`contents/<フォーカス階層>/_work/...`）。
 * `_work/` はスキルが差し込み用の断片を書き溜める中間ファイル置き場であり、
 * 上書き確認の対象から恒常的に除外するために使う。
 */
export function isPathInsideWorkDir(
  pathLike: string,
  workScopeKey: string,
): boolean {
  const normalized = pathLike.replace(/\\/g, "/").trim();
  if (!normalized) return false;
  const base = scopePrefix(workScopeKey);
  if (!base) return false;
  return normalized.startsWith(`${base}_work/`);
}

/**
 * パスが書込許可ルートの内側か（作業フォルダ相対・`contents/`・`contents-work/`）。
 */
export function isPathInsideWriteRoots(pathLike: string): boolean {
  const normalized = pathLike.replace(/\\/g, "/").trim();
  if (!normalized) return false;
  if (normalized.includes("..")) return false;
  if (/^[a-zA-Z]:\//.test(normalized)) return false;
  if (normalized.startsWith("/") || normalized.startsWith("~")) return false;

  // 明示プレフィックス付きは 2 ルートのみ、それ以外の相対は作業フォルダ基準で内側
  return true;
}

/**
 * テキスト中から、書込許可ルートの外を指しそうなパス断片を拾う（ヒューリスティック）。
 */
export function findOutsideProjectPathHints(text: string): string[] {
  if (!text.trim()) return [];

  const candidates = new Set<string>();
  const patterns = [
    /\b([A-Za-z]:[\\/][^\s)'"`]+)/g,
    /(~\/[^\s)'"`]+)/g,
    /(?<![A-Za-z0-9_/.-])(\.\.\/[^\s)'"`]+)/g,
  ];

  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const raw = (match[1] ?? match[0]).replace(/[.,;:]+$/, "");
      if (!raw) continue;
      if (!isPathInsideWriteRoots(raw)) {
        candidates.add(raw);
      }
    }
  }

  return [...candidates];
}

export function listDefaultOutputDestinations(
  workScopeKey: string,
  currentFileRelativePath?: string | null,
): OutputDestinationOption[] {
  const options: OutputDestinationOption[] = [];
  const current = currentFileRelativePath?.replace(/\\/g, "/").trim();

  if (current) {
    const slash = current.lastIndexOf("/");
    const sameDir = slash === -1 ? "" : current.slice(0, slash);
    options.push({
      id: "same-folder",
      label:
        sameDir === ""
          ? "開いているファイルと同じフォルダ（プロジェクト直下）"
          : `開いているファイルと同じフォルダ（${sameDir}/）`,
      relativeDir: sameDir,
    });
  }

  options.push({
    id: "project-root",
    label: `作業フォルダ直下（${workScopeBaseDir(parseWorkScope(workScopeKey) ?? {})}/）`,
    relativeDir: "",
  });

  // same-folder が直下と同じなら重複除去
  if (
    options.length === 2 &&
    options[0].id === "same-folder" &&
    options[0].relativeDir === ""
  ) {
    return [options[0]];
  }

  return options;
}
