/**
 * 本文の画像参照をサイト用に解決する。
 *
 * 正本の参照は `images/<file>`（`lib/image-path.ts` の正本パス）。
 * ローカルモードでは正本画像を `public/images/` へコピーし、参照を `/images/<file>` へ書き換える。
 */
import fs from "node:fs";
import path from "node:path";

export type ImageSource = "local" | "blob";

/** markdown 本文中の `images/<file>` 参照（`![...](images/x.png)` と `<img src="images/x.png">`） */
const IMAGE_REF_PATTERN =
  /(!\[[^\]]*\]\(|<img[^>]+src=["'])images\/([^)"']+)(\)|["'])/g;

export type ImageRewriteResult = {
  body: string;
  /** 本文が参照した正本画像のファイル名 */
  referenced: string[];
};

/** 本文の `images/<file>` を `<publicPrefix>/<file>` に書き換える */
export function rewriteImageRefs(
  body: string,
  publicPrefix = "/images",
): ImageRewriteResult {
  const referenced: string[] = [];
  const rewritten = body.replace(
    IMAGE_REF_PATTERN,
    (_match, head: string, file: string, tail: string) => {
      const decoded = decodeURIComponent(file);
      referenced.push(decoded);
      return `${head}${publicPrefix}/${file}${tail}`;
    },
  );
  return { body: rewritten, referenced: [...new Set(referenced)] };
}

export type ImageCopyResult = {
  copied: string[];
  missing: string[];
};

/**
 * 参照された正本画像を `public/images/` へコピーする。
 * 実体が無いものは missing として返す（呼び出し側がビルドを止める）。
 */
export function copyCanonicalImages(
  fileNames: readonly string[],
  canonicalDir: string,
  publicImagesDir: string,
): ImageCopyResult {
  const copied: string[] = [];
  const missing: string[] = [];

  for (const name of fileNames) {
    const source = path.join(canonicalDir, name);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      missing.push(name);
      continue;
    }
    const target = path.join(publicImagesDir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    copied.push(name);
  }

  return { copied, missing };
}

export class BlobModeNotImplementedError extends Error {
  constructor() {
    super(
      [
        'site.config.json の imageSource が "blob" ですが、Blob モードは未実装です。',
        '現在の Blob は access:"private" のため公開サイトから参照できません。',
        'public 化の手順が決まるまでは "local" を使ってください。',
      ].join("\n"),
    );
    this.name = "BlobModeNotImplementedError";
  }
}

/** 画像モードに応じた本文書き換え。Blob モードは未実装で止める */
export function resolveImagesForMode(
  body: string,
  mode: ImageSource,
): ImageRewriteResult {
  if (mode === "blob") throw new BlobModeNotImplementedError();
  return rewriteImageRefs(body);
}
