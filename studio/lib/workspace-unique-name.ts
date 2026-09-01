function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitFileName(fileName: string): { base: string; ext: string } {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) {
    return { base: fileName, ext: "" };
  }
  return {
    base: fileName.slice(0, dot),
    ext: fileName.slice(dot),
  };
}

/** `{base}-{最大連番+1}{ext}` を返す共通ループ（max+1。欠番は埋めない） */
function resolveUniqueName(
  existingNames: string[],
  base: string,
  ext: string,
): string {
  let maxN = 1;
  const numberedPattern = new RegExp(
    `^${escapeRegExp(base)}-(\\d+)${escapeRegExp(ext)}$`,
  );

  for (const name of existingNames) {
    if (name === `${base}${ext}`) {
      maxN = Math.max(maxN, 1);
      continue;
    }
    const match = name.match(numberedPattern);
    if (match) {
      maxN = Math.max(maxN, Number.parseInt(match[1] ?? "0", 10));
    }
  }

  return `${base}-${maxN + 1}${ext}`;
}

/**
 * 重複しないファイル名を返す（max+1）。
 * ⚠ lib/image-slug.ts の resolveUniqueImageFileName（欠番埋め・async）とは別セマンティクス。
 */
export function resolveUniqueFileName(
  existingNames: string[],
  desiredName: string,
): string {
  if (!existingNames.includes(desiredName)) {
    return desiredName;
  }
  const { base, ext } = splitFileName(desiredName);
  return resolveUniqueName(existingNames, base, ext);
}

export function resolveUniqueFolderName(
  existingNames: string[],
  desiredName: string,
): string {
  if (!existingNames.includes(desiredName)) {
    return desiredName;
  }
  return resolveUniqueName(existingNames, desiredName, "");
}
