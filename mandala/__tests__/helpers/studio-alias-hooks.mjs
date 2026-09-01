/**
 * Studio の `@/...` エイリアス（tsconfig paths）を Node の解決に教えるフック。
 * parity テストが Studio のローダーを素の Node で実行するために使う。
 *
 * 仕事は2つある。
 *   1. `@/...` を Studio のソースへ向ける
 *   2. Studio のソースが import する npm パッケージを **site/ 側の依存**として解決する
 *      （下の `ALLOWED_PACKAGES`）
 */
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const studioRoot = process.env.STUDIO_ROOT;

/**
 * Studio 側ローダーの依存閉包で必要になる npm パッケージの許可リスト。
 *
 * ⚠ ここに載せた名前だけを `site/node_modules` から解決する。**generic に
 * 「bare specifier は全部 site から」とはしない**——site と Studio は依存セットが
 * 重なっており（react 等）、同名で版が大きく違うパッケージを黙って別物として
 * 使ってしまうと、事故ったときに気づけないため。
 *
 * ⚠ 許可リストに無いパッケージは解決せずに落ちる。それは**意図した挙動**で、
 * Studio 側ローダーに新しい依存が生えたことに気づくための仕掛け。落ちたときは
 * 「許可リストに足す」か「その依存を持ち込まない形にローダーを直す」かを判断する。
 *
 * ⚠ 版ズレを既知の近似として受け入れている。site の zod は 4.3.6（Nextra 4.6.x が
 * zod 4.4.x と衝突するため `package.json` の overrides で固定・上げられない）、
 * Studio の実依存は 4.4.3。つまりこのテストは Studio が実際に使っていない版で
 * ローダーを走らせる。受け入れる根拠は、このテストが見張っているのが**走査規則の
 * ずれ**（`_` / `.` 始まりの除外・`order` 並び・slug の扱い）であって zod の挙動では
 * なく、`lib/schema.ts` が使う API も z.enum / z.object / .optional() / .default() /
 * z.array / z.boolean / safeParse と 4.x 系で安定した中核だけであること。
 * nextra#5008 が直って overrides を外せれば、版は自然に揃う。
 */
const ALLOWED_PACKAGES = new Set(["zod"]);

/** `zod` も `zod/mini` も `zod` として判定する */
function packageNameOf(specifier) {
  const segments = specifier.split("/");
  return specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0];
}

export async function resolve(specifier, context, next) {
  if (studioRoot && specifier.startsWith("@/")) {
    const base = path.join(studioRoot, specifier.slice(2));
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, "index.ts"),
    ];
    const found = candidates.find(
      (c) => fs.existsSync(c) && fs.statSync(c).isFile(),
    );
    return next(pathToFileURL(found ?? base).href, context);
  }

  if (ALLOWED_PACKAGES.has(packageNameOf(specifier))) {
    // parentURL をこのフック自身（site/__tests__/helpers/ 配下）に差し替えると、
    // Node の既定解決が site/node_modules から探す。パスを自前で組み立てると
    // exports マップ（zod は import / require で実体が違う）を素通りしてしまうので、
    // 解決そのものは Node に任せる。
    return next(specifier, { ...context, parentURL: import.meta.url });
  }

  return next(specifier, context);
}
