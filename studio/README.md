# DX Training Studio

DX ツールトレーニングのコンテンツ計画・作成・編集・翻訳・デプロイを支援する3ペイン統合スタジオ。  
シリーズ → コース → レッスンの階層構造でコンテンツを管理し、マークダウン編集・画像アセット管理・進捗トラッキングを一画面で行える。

> [!NOTE]
> 本アプリは入れ物 `dx-training-studio/` 直下の **`studio/`** にあります。正本 `../contents/` の原稿を**受講者向けの公開サイト**に変換する仕組みは、兄弟の独立した npm プロジェクト **`../mandala/`**（DX Training Mandala）にあります。どちらも正本を読み取るだけで、互いに独立して起動します。
> 起動・検索・設定・デプロイ・既知の制約は **[`../mandala/README.md`](../mandala/README.md)** を参照してください。

## スタジオ画面

<img width="1562" height="843" alt="image" src="https://github.com/user-attachments/assets/1413b816-231e-485f-b821-7817a62da551" />

## 起動する

```bash
cd dx-training-studio/studio
npm install
npm run dev
```

ブラウザで `http://localhost:3001` を開く。

Windows では入れ物直下の **`start-studio-dev.bat`** を推奨（Playwright Chromium の確認後に `npm run dev` を実行）。本番相当の起動は `start-studio.bat`（ビルド → `npm run start`）。

AI タブで Tailwind 図解を生成する場合は、初回のみ `npx playwright install chromium` が必要です（`start-studio-dev.bat` に含まれます）。

## ペイン構成

画面は左から3ペイン。

| ペイン | 役割 |
|---|---|
| **ツリー** | シリーズ → コース → レッスンの3階層ツリー（右クリックメニューで CRUD・複製・エクスプローラ / DnD 並び替え / レッスン行にステータスボタン / 下部にミニ曼陀羅） |
| **エディタ・メタ** | マークダウンエディタ（編集 / プレビュー / Git 差分）と、選択階層のメタビュー |
| **Agent・画像** | AI Agent チャット（デフォルト）と画像アセットマネージャー（Used / Upload / AI / Web）の切替 |

> [!NOTE]
> コード上の識別子には `Pane4Shell` / `clampPaneWidth("pane4")` のように **4** が残っている。これは旧4ペイン構成の名残で、**画面の番号とは対応しない**。この readme はペインを役割名で呼ぶ。

ツリーの操作は右クリックに集約されている: properties（メタ編集）/ add series・add course・add lesson / rename / copy・paste（複製。`id` は自動再採番・`slug` は空で作られる）/ open explorer / delete。

GlobalHeader に **言語切替**（英語ビュー ⇄ 日本語ビュー）、**DXトレーニング曼陀羅**、**社内コンテキスト**、**設定（歯車）** がある。設定では **AI モデル**、AI API キー、Pixabay API キー、**画像の管理（ローカル / ストレージ）**、**社内コンテキストの管理（ローカル / データベース）**、テーマ（ライト／ダーク／システム）、ペイン既定幅、エディタの編集フォントサイズを変更できる。

### API キー（`.env.local`）

```bash
cp .env.example .env.local
# AI_API_KEY / PIXABAY_API_KEY / BLOB_READ_WRITE_TOKEN（ストレージモード時）/ DATABASE_URL（DB モード時）を設定
```

**設定ダイアログにキーがある場合はダイアログを優先**します。ダイアログ未入力のときのみ `.env.local` の `AI_API_KEY` / `PIXABAY_API_KEY` を参照します。画像ストレージのトークンは **常に `.env.local` の `BLOB_READ_WRITE_TOKEN`** のみです。

### AI モデル（⚙ AI モデル）

| slug | 表示名 | 保存 |
|------|--------|------|
| `gpt-5-nano` | GPT 5 nano | 未対応（保存拒否） |
| `claude-haiku-4-5` | Claude Haiku 4.5 | ✓ |
| `claude-sonnet-5` | Claude Sonnet 5 | ✓（既定） |
| `claude-opus-4-8` | Claude Opus 4.8 | ✓ |
| `claude-fable-5` | Claude Fable 5 | ✓ |

- slug は Anthropic API の model ID と一致
- Agent チャット・AI 画像・Web 検索・社内コンテキスト整形など **全 AI 呼び出し**で使用
- 未設定時は `claude-sonnet-5`（正本は `lib/ai-models.ts` の `DEFAULT_AI_MODEL`）

### 画像ストレージ（⚙ 画像の管理）

| モード | 正本の保存先 | git |
|--------|-------------|-----|
| **ストレージ**（既定） | Vercel Blob（Private） | 正本は Blob 上（`images/` は git 除外） |
| **ローカル** | `images/<filename>` | 正本を fs に保存（`images/*` は git 除外のまま） |

- staging（`images/{uploaded,ai,web}/`）は **常にローカル**
- ストレージモードでトークン未設定のときは「ストレージに接続できません」と表示
- 既存のローカル正本を Blob へ上げる: `npm run upload-images-to-blob`（`--dry-run` 可）

### 社内コンテキスト（⚙ 社内コンテキストの管理）

| モード | 保存先 | git |
|--------|--------|-----|
| **データベース**（既定） | Vercel Neon `context_items` | DB 上（`DATABASE_URL` 要） |
| **ローカル** | `local-db/context-items.json` | `local-db/*` は git 除外（`.gitkeep` のみ追跡） |

- 1 ファイルに `{ "nextId": number, "items": ContextItem[] }` 形式で保存（Ctrl+F 検索しやすい）
- 初回アクセス時に空 store を自動作成
- データベースモード保存時のみ Neon 接続を検証（`DATABASE_URL` 未設定時は保存不可）
- **Neon ↔ local の同期は行わない**（画像の管理と同様、モード切替は保存先の切替のみ）
- ローカルモードでは JSON をエディタで直接編集可能（100 件未満想定）

### エディタのモード

| モード | 内容 |
|---|---|
| 編集 | CodeMirror による Markdown 編集（シンタックスハイライト） |
| プレビュー | `react-markdown` によるレンダリング |
| 差分 | Git HEAD と現在の content を unified diff 表示（`LessonDiffView`） |

エディタの編集と **Agent チャット**は横並びで表示できる（Cursor 型レイアウト）。

### Agent・画像ペインの切替

- **Agent**（デフォルト）: 設定で選んだ AI モデルで応答。スキル呼び出し（`/`）、ファイル参照（`@`）、草稿のエディタ上書き。折りたたみ復帰時は前回のビューを復元
- **画像**: Used / Upload / AI / Web の 4 タブ（従来の画像マネージャー）

### 画像管理

- **Used**: promote 済み正本一覧 + 参照中だがファイル欠落の行。シリーズ／コース／レッスンでフィルタ可能（フィルタ ON 時は未使用を非表示）
- **Upload**: ドラッグ＆ドロップ / ペースト → `images/uploaded/`（staging）→ 挿入で `images/<filename>` へ promote
- **AI**: プロンプト入力 → Claude + Playwright で PNG 生成 → `images/ai/`（staging）→ 挿入で promote（要 `AI_API_KEY`）。`<!-- -->` 内カーソルでプロンプト自動同期。**自動入力**ボタンは常に Claude でプロンプトを再構成
- **Web**: 説明文プロンプト → Claude + Pixabay で最大 3 枚取得 → `images/web/`（staging）→ 挿入で promote（要 `AI_API_KEY` + `PIXABAY_API_KEY`）。同期・自動入力の挙動は AI タブと同様

削除は staging を `images/trash/` へ move（ローカル）。**ローカルモード**の正本削除も trash へ move。**ストレージモード**の正本削除は Blob から物理削除。

Markdown の画像パスは正本形式 `images/<filename>` のみ。staging は `images/{uploaded|ai|web}/` に保存する。詳細は [`../contracts/image-slot-contract.md`](../contracts/image-slot-contract.md)。

## 英語ビューと翻訳

**日本語が正本、英語は派生**。翻訳は常に日本語 → 英語の一方通行で、英語側を編集しても日本語正本には戻らない。

### 言語切替

切替の入口は **GlobalHeader に1つだけ**（曼陀羅ボタンの左・「英語ビューに切り替える」/「日本語ビューに戻る」）。ペインごとの切替は持たない——常時見えていることが「選択を変えてもモードが保たれる」の説明になっている。

英語モードの射程は **コンテンツの名前を出す場所は全部**（ツリー・曼陀羅・パンくず・エディタペインのタイトル）。`name_en` が未設定のユニットは**日本語名にフォールバック**する（止めると名無しだらけでナビが死ぬ）。

| ファイル | 中身 |
|---|---|
| `contents.md` | 日本語本文（正本） |
| `contents.en.md` | 英訳本文。1行目に原文ハッシュ行 `<!-- source: sha256:… -->` |
| `.meta.json` | 日本語と英語（`name_en` / `description_en` / `catch_en` / `target_en` / `author_en`）が同居。`en_source_hash` が原文ハッシュ |

### 翻訳の鮮度

原文ハッシュと現在の原文を突き合わせて、**未翻訳 / 翻訳が古い / 最新**の3状態を判定する（正本は `lib/translation/freshness.ts`）。

- **古いことの伝え方は1か所だけ**: 英語ビュー本文上部の赤字1行（`StaleTranslationNotice`）
- 日本語ビューには出さない。**公開サイトにも一切出さない**——受講者は対処できない（鮮度維持はトレーナーの責務）
- 公開サイトで未翻訳のページは本文が `Coming soon` になる。日本語へフォールバックしない

### 翻訳の規則

規則の正本は [`../contracts/translation-contract.md`](../contracts/translation-contract.md) **1 か所**。Studio の翻訳 API も翻訳スキル（`dx-training-translate`）も同じ契約を読む。⚠ **規則の複製を他所に持たない**——契約自身がそう定めており、更新は人が行う。

`author` / `author_en` は翻訳が書かない（人名のローマ字表記は本人の流儀）。`id` / `order` / `slug` などの構造情報も翻訳の対象外。

## 技術スタック

- **Next.js 16** / **React 19** / **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**（base-nova）
- **CodeMirror 6**（Markdown エディタ）
- **react-markdown** + **remark-gfm** + **rehype-highlight**（プレビュー）
- **React Flow (@xyflow/react)** + **dagre**（曼陀羅）
- **@dnd-kit**（ドラッグ＆ドロップ）
- **Zod**（スキーマ検証）

## ディレクトリ構成

**入れ物 `dx-training-studio/` 直下**（アプリの外。正本とプロジェクト共通）:

```
dx-training-studio/
  start-studio.bat / start-studio-dev.bat      Studio 起動（本番相当 / 開発）
  start-mandala.bat / start-mandala-dev.bat    公開サイト起動（本番相当 / 開発）
  studio/                  本アプリ（この readme のある場所）
  mandala/                 公開サイト（独立した npm プロジェクト）
                           → 手順書は mandala/README.md
  contents/                シリーズ / コース / レッスンの正本（フォルダ階層 + contents.md）
    <シリーズ>/
      .meta.json           シリーズメタ・並び順
      <コース>/
        .meta.json         コースメタ
        <レッスン>/
          .meta.json       レッスンメタ（slug / status / 著者 など）
          contents.md      レッスン本文（Markdown のみ）
  images/                  正本は git 追跡（staging と動画は除外）
    <file>.png             正本
    uploaded/ ai/ web/     staging
    trash/                 削除退避
  contents-work/           計画書・run 記録・Agent の会話（→ 「データ構造」）
    plans/                 計画書（git 追跡）
    runs/                  create 1実行分（git 除外）
    sessions/              Agent の会話（git 除外）
  local-db/                社内コンテキスト（ローカルモード、git 除外）
  contracts/               画像スロット・コンテキスト整形の契約
  docs/
    handoff.md             引き継ぎ（次にやること・未決事項）
    grill-me/              仕様検討の記録
  .claude/skills/          Agent 用スキル（dx-training-create 等）
  openspec/                仕様・変更管理
```

**`studio/` 内**（本アプリ）:

```
app/
  page.tsx                 contents/ 読み込み
  layout.tsx               レイアウト・TooltipProvider
  globals.css              カラートークン定義
  api/
    agent/                 Agent 呼び出し・セッション・スキル・設定
    content/               シリーズ / コース / レッスンの CRUD・保存
    context/               社内コンテキスト CRUD・検索・整形
    lesson-diff/           レッスン content の HEAD vs 現在 diff
    images/                アップロード・promote・一覧・配信・AI 生成・Web 検索
components/
  workspace/               ワークスペース UI（Workspace.tsx が状態 SSoT）
  ui/                      shadcn 部品（components.json で管理）
lib/
  agent/                   Agent ループ・LLM・ツール・スキルローダー
  project-root.ts          正本の基準ルート解決（cwd の親＝入れ物。一点変更ポイント）
  schema.ts                Zod スキーマ
  contents-loader.ts       contents/ 読み書き
  workspace-meta.ts        ワークスペース名・アイコン（定数）
  workspace-settings.ts    設定（localStorage）
  lesson-*.ts              エディタ・差分・保存など
  image-*.ts               画像パス解決・ストア・参照抽出
scripts/
  render-diagram.mjs       Playwright HTML→PNG
  upload-local-images-to-blob.mjs
  check-context-db.mjs / migrate-context-db.mjs
```

AI 向けの編集ルールは [`CLAUDE.md`](CLAUDE.md) を参照。

## 開発コマンド

| コマンド | 役割 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー起動 |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run test:watch` | Vitest（ウォッチ） |
| `npm run format` | Prettier（整形） |
| `npm run format:check` | Prettier（チェックのみ） |
| `npm run upload-images-to-blob` | ローカル正本画像を Vercel Blob へアップロード（`--dry-run` 可） |
| `npm run check:context-db` | Neon 接続・`context_items` テーブル確認 |
| `npm run migrate:context-db` | 社内コンテキスト DB マイグレーション |

**ポート**: Studio = 3001 / 公開サイト（`../mandala/`）= 3002。

> [!IMPORTANT]
> **dev サーバーは同一プロジェクトで1台まで**（Next 16）。検証用に立てたら必ず止める（放置すると `.next` が EBUSY でロックされ起動できなくなる）。
> **テストの前に dev サーバーを止める** — 動かしたまま `npm run test` を回すと `compileCss`（`inline-html-assets.test.ts`）がタイムアウトで落ちる（実装の異常ではなくマシン負荷）。

shadcn 部品の追加: `npx shadcn@latest add <name> --diff`（設定は `components.json`）

## Vercel にデプロイ（デモ）

リポジトリ [`AI_Driven_School`](https://github.com/ug-kitamura/AI_Driven_School) のサブディレクトリとして Vercel に公開する。デモ URL: [https://ai-driven-school.vercel.app](https://ai-driven-school.vercel.app)

### プロジェクト設定

Vercel ダッシュボード → **Settings** → **Build and Deployment**

| 項目 | 値 |
|---|---|
| Root Directory | `dx-training-studio/studio` |
| Framework Preset | Next.js |
| Build Command | `npm run build` |
| Output Directory | デフォルト（Override しない） |
| Install Command | `npm install` |
| **Include files outside the root directory in the Build Step** | **Disabled** |

**Include files outside… を Enabled にすると**、monorepo 全体がビルドに含まれ post-build で ENOENT になることがある。**必ず Disabled** にする。

### 環境変数（任意）

デモで UI と既存コンテンツの閲覧だけなら未設定でよい。AI / Web タブも試す場合は `AI_API_KEY` / `PIXABAY_API_KEY` を Vercel の Environment Variables に追加する（設定ダイアログの値が優先）。

### Vercel 上の制限

デモ・プレビュー用途を想定。以下はローカルと異なる。

| 機能 | Vercel |
|---|---|
| ワークスペース UI・プレビュー・既存 `images/` | 動作 |
| マークダウン編集 | セッション内のみ（リロードで初期値に戻る） |
| Git 差分モード | 不可（`.git` がデプロイに含まれない） |
| AI 画像生成（Playwright） | 不可 |
| アップロード・編集の永続化 | 不可 |

`main` への push で Production デプロイが走る。設定変更後は **Deployments → Redeploy**（Build Cache OFF 推奨）。

## データ構造

### 論理モデル

```
Series（シリーズ）
  └─ Course（コース）
       ├─ target              受講対象者
       ├─ style               受講形態（self-study / lecture / hands-on）
       ├─ cross_series_prev   別シリーズの前コース ID（同シリーズ内の前後は order が表す）
       ├─ cross_series_next   別シリーズの次コース ID
       ├─ is_start / is_goal  カリキュラムの入口・到達点の宣言（曼陀羅に Start / Goal を出す）
       └─ Lesson（レッスン）
            ├─ status        open / in_progress / done
            ├─ content       マークダウン本文（frontmatter なし）
            └─ ...
```

ステータスは下位から自動集計される（`computeStatus`）。

- すべて `open` → `open`
- すべて `done` → `done`
- それ以外 → `in_progress`

### ファイル配置（`contents/`）

```
contents/
  <シリーズ名>/
    .meta.json
    <コース名>/
      .meta.json
      <レッスン名>/
        .meta.json         ← レッスンメタの正本
        contents.md        ← レッスン本文の正本（frontmatter なし）
```

ローカル開発ではレッスン編集・CRUD は API 経由で `contents/` に永続化される。`.meta.json` はアプリが管理するため、Agent は原則書き込めない（例外はレッスン階層の `.meta.json` のみ・検査つき）。

## 仕様・設計の詳細

- 引き継ぎ（次にやること・未決事項）→ [`../docs/handoff.md`](../docs/handoff.md)
- 仕様検討の記録 → [`../docs/grill-me/`](../docs/grill-me/)
- 公開サイトの手順書 → [`../mandala/README.md`](../mandala/README.md)
- OpenSpec 正本 → [`../openspec/specs/`](../openspec/specs/)
