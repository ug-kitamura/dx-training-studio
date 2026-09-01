/**
 * ワークスペースの表示名とアイコン（GlobalHeader の見出し）。
 *
 * かつては `data/workspace.json` に置いていたが、UI からの編集経路が無く
 * ビルド時 import しかしていないため、設定ファイルである必然性が無かった。
 * 名前を変えるときはここを直す。
 */
export type WorkspaceMeta = {
  name: string;
  /** lucide のアイコン名 */
  icon: string;
};

export const WORKSPACE_META: WorkspaceMeta = {
  name: "DX Training Studio",
  icon: "graduation-cap",
};
