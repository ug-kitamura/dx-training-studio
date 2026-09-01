import path from "node:path";

/**
 * projectRoot = ユーザーの作業データの基準ルート。
 * `contents/` / `contents-work/` はここを基準に解決する。
 *
 * アプリは入れ物 `dx-training-studio/` 直下の `studio/` にあり、
 * 正本（`contents/` `images/` `contents-work/` `local-db/`）と
 * `.claude/` は入れ物直下＝cwd の親にある（兄弟構成）。
 *
 * dx-training-studio は単体起動のみのため、EBEX の二層ルート
 * （`.ebex.host` 検出）は持たず、常に cwd（= `studio/`）の親を返す。
 * パス基準には `process.cwd()` を直接使わず、必ず本関数を経由すること
 * （EBEX との diff 同期と、将来ルート規則を変える際の一点変更のため）。
 */
export function getProjectRoot(): string {
  return path.resolve(process.cwd(), "..");
}
