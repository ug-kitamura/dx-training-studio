# dx-training-studio / studio

DX ツールトレーニング用の **3ペイン Next.js 16 × shadcn/ui ワークスペース**。
起動方法・画面構成は [`readme.md`](readme.md) を参照。

アプリは入れ物 `dx-training-studio/` 直下の `studio/` にあり、公開サイト `../mandala/` と兄弟。正本データ（`../contents/` `../images/` `../contents-work/` `../local-db/`）は入れ物直下にあり、`lib/project-root.ts` の `getProjectRoot()`（cwd の親を返す）を**必ず経由して**解決する——`process.cwd()` を直接パス基準に使わない。

## アーキテクチャ

- **状態の SSoT**: `components/workspace/Workspace.tsx`
- **ペイン**: `ContentTreePane`（3階層ツリー＋右クリックメニュー＋下部ミニ曼陀羅）, `MarkdownEditorPane`（エディタ・メタ）, `Pane4Shell`（Agent + `ImageManagerPane`。⚠ 名前の 4 は旧構成の名残で画面の番号ではない）
- **ツリーの部品**: メタ編集は `CourseMetaDialog` / `LessonMetaDialog` / `WorkspaceMetaDialog`、名前入力は `NameDialog`、コンテキストメニューは `components/ui/context-menu.tsx`（EBEX から移植）
- **画像**: 正本 `../images/<file>`、staging `../images/{uploaded|ai|web}/`（`lib/image-path.ts`, `lib/image-store.ts`）
- **AI 画像**: 骨子は `<!-- プロンプト -->`、Agent・画像ペインの AI タブで生成。契約は `../contracts/image-slot-contract.md`
- **設定**: `lib/workspace-settings.ts`、GlobalHeader 歯車 → `WorkspaceSettingsDialog`
- **データ**: シリーズ/コース/レッスンの正本は入れ物直下の `../contents/` ディレクトリ（`lib/contents-loader.ts` が読む）。ワークスペース名・アイコンは `lib/workspace-meta.ts` の定数
- **変更履歴**: 正本は `../contents/changelog.md`（⚠ 公開サイトの生成物 `../mandala/content/changelog.md` と 1 文字違い）。編集入口はホーム選択時のエディタ・メタペイン（`WorkspaceChangelogSection`、GitHub リンクの下）。手動編集が一次手段で、AI 下書き（`/api/content/changelog/draft`）は**新規エントリだけ**を返しクライアントが先頭へ挿入する——既存行に触れない担保は構造で。書式の検証・整形はどこでもしない（人の作法）。規約の SSoT は `lib/changelog-entry.ts` の `CHANGELOG_PROMISE_TEXT`
- **スキーマ**: `lib/schema.ts`（Zod）

## UI 編集方針

- **メタ編集**は `metaDialogLayout.tsx` の `MetaDialogField` / `META_DIALOG_*` と shadcn の `Label` + `Input` / `Select` を組み合わせる（`LessonMetaPanel`, `LessonListPane` を参照）
- **業務 Dialog**（追加・削除・プレビュー・曼陀羅など）は既存コンポーネントのパターンを踏襲する
- **shadcn 部品の追加**は `npx shadcn@latest add <name> --diff`。設定は `components.json`
- **`--overwrite` は明示許可なしに使わない**（独自 variant が消える）

## コード生成ルール

`components/` を編集するときは以下を守る。

- 子要素の間隔は親で管理（`flex flex-col gap-*`。`space-y-*` は使わない）
- shadcn 部品の見た目を呼び出し側で打ち消さない（色・サイズの `className` 上書きは避け、必要なら部品側に variant を足す）
- 色は役割付きトークン（`bg-primary` 等）。`bg-blue-500` のような色番号は使わない
- 正方形は `size-N`（`w-N h-N` ではない）
- shadcn **base** 版: トリガーの合成は `asChild` ではなく `render`
- shadcn で足りるなら自前の `div` で代替しない
- 派生 state を Effect で複製しない。props 追従の Effect+setState より `key` でリマウント。ユーザー操作の副作用はイベントハンドラに置く

## 技術スタック

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn（base-nova）
- lucide-react
- zod
- CodeMirror
- React Flow (@xyflow/react)

## コマンド

```bash
npm run dev           # 開発サーバー
npm run build         # 本番ビルド
npm run lint          # ESLint
npm run test          # Vitest
npm run format        # Prettier（整形）
npm run format:check  # Prettier（チェックのみ）
```
