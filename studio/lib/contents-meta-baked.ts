import { createRequire } from "node:module";
import path from "node:path";

/**
 * デプロイ先で読めない `.meta.json` の代わりに、ビルド時の焼き込みを返す
 * （`studio-demo-deployment` spec「正本はビルド時に焼き込む」）。
 *
 * ⚠ 効かせるのは Vercel 上だけ。ローカルでは `.meta.json` が無いことに
 * 意味がある（`loadContentsFolder` の id 自己修復・`reconcileOrderFiles` の
 * 新規生成がそこで働く）ため、焼き込みで蓋をすると再採番が止まる。
 * 環境で分岐する前例は `next.config.ts` の `outputFileTracingRoot` と
 * `app/page.tsx` の cookie 読み飛ばし。
 *
 * ⚠ JSON は静的 import しない。`contents-loader` 経由で Node の parity プローブ
 * （`--experimental-strip-types`）に載ると `ERR_IMPORT_ATTRIBUTE_MISSING` になる。
 * `createRequire` で読み、同梱は `next.config.ts` の `outputFileTracingIncludes` が担う。
 * スキルカタログは API ルート直下の静的 import で同梱しているが、こちらは
 * ローダーのホットパスに乗るため形を変える。
 */
function bakedFallbackEnabled(): boolean {
  return Boolean(process.env.VERCEL);
}

const requireJson = createRequire(import.meta.url);

let cachedSnapshot: Record<string, Record<string, unknown>> | undefined;

function loadBakedSnapshot(): Record<string, Record<string, unknown>> {
  if (cachedSnapshot === undefined) {
    cachedSnapshot = requireJson("./contents-meta.generated.json") as Record<
      string,
      Record<string, unknown>
    >;
  }
  return cachedSnapshot;
}

/**
 * `contents/` からの相対パスを焼き込み辞書のキーへ直す。
 * `contents/` の外を指していたら null（テストの一時ディレクトリ等を拾わないため）。
 */
function snapshotKey(contentsDir: string, dir: string): string | null {
  const rel = path.relative(contentsDir, dir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

/**
 * 焼き込み済みメタを返す。該当が無ければ null（呼び出し側は従来どおり空として扱う）。
 *
 * 呼び出し側が結果を書き換える経路（保存 API の土台・id 自己修復）があるため、
 * **複製を返す**——キャッシュをそのまま渡すと、1リクエストの書き換えが以後の
 * リクエストへ漏れる。
 */
export function readBakedMeta(
  contentsDir: string,
  dir: string,
): Record<string, unknown> | null {
  if (!bakedFallbackEnabled()) return null;
  const key = snapshotKey(contentsDir, dir);
  if (key === null) return null;
  const meta = loadBakedSnapshot()[key];
  return meta ? structuredClone(meta) : null;
}
