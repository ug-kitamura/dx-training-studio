# company-context-api Specification

## Purpose

社内コンテキスト（`context_items`）の REST API（CRUD・タグ一覧・DB 接続確認・AI 整形）とエラーレスポンス契約を定義する。
## Requirements
### Requirement: DB 接続確認 API

`GET /api/context/db-check` は Neon への接続可否を検証しなければならない（SHALL）。失敗時は「データベースに接続できません」を返さなければならない（SHALL）。この API は ⚙ 設定で **データベース** モード保存前の接続確認に用いられ、ローカルモード選択時はクライアントから呼ばれなくてよい（MAY）。

#### Scenario: 接続成功

- **WHEN** `DATABASE_URL` が有効である
- **AND** `GET /api/context/db-check` が呼ばれる
- **THEN** レスポンスは成功する

#### Scenario: 接続失敗

- **WHEN** `DATABASE_URL` が未設定である
- **AND** `GET /api/context/db-check` が呼ばれる
- **THEN** レスポンスは失敗する
- **AND** エラーメッセージは「データベースに接続できません」である

### Requirement: context_items CRUD API

次のエンドポイントを提供しなければならない（SHALL）:

- `GET /api/context/items` — 一覧（クエリ `tags` で OR フィルタ、省略時は全件）
- `POST /api/context/items` — 作成（`title`, `body`, `tags`, `source_url`, `source_last_updated_at` 任意）
- `GET /api/context/items/[id]` — 単体取得
- `PATCH /api/context/items/[id]` — 更新
- `DELETE /api/context/items/[id]` — 削除

上記および `GET /api/context/items/search`・`GET /api/context/tags` はクエリ（または POST body）で **`contextMode`**（`local` | `database`）を受け取り、バックエンド選択に用いなければならない（SHALL）。未指定時は `database` としなければならない（SHALL）。

`source_url` は必須でなければならない（SHALL）。`tags` は **1〜3 個** の非空文字列配列でなければならない（SHALL）。作成・更新時に `updated_by` を設定しなければならない（SHALL）。

`POST /api/context/format` はストレージモードに依存せず、永続化を行わない（SHALL）。

#### Scenario: タグでフィルタ一覧

- **WHEN** `GET /api/context/items?tags=環境構築,xyz&contextMode=local` が呼ばれる
- **THEN** `tags` が `環境構築` または `xyz` を含むアイテムが JSON 配列で返される

#### Scenario: 必須フィールド不足で作成失敗

- **WHEN** `POST /api/context/items` に `source_url` が含まれない
- **THEN** レスポンスは 400 である

#### Scenario: tags 空で作成失敗

- **WHEN** `POST /api/context/items` に `tags: []` が含まれる
- **THEN** レスポンスは 400 である

#### Scenario: local モードで DATABASE_URL なしでも CRUD 可能

- **WHEN** `DATABASE_URL` が未設定である
- **AND** `POST /api/context/items?contextMode=local` が有効な body で呼ばれる
- **THEN** レスポンスは 201 である
- **AND** `local-db/context-items.json` に当該アイテムが追加される

### Requirement: タグ一覧 API

`GET /api/context/tags` は `contextMode` に応じたバックエンドから収集したユニークタグを返さなければならない（SHALL）。

#### Scenario: 既存タグを返す

- **WHEN** ローカル store に `tags: [環境構築, xyz]` のアイテムが存在する
- **AND** `GET /api/context/tags?contextMode=local` が呼ばれる
- **THEN** 応答に `環境構築` と `xyz` が含まれる

### Requirement: AI 整形 API

`POST /api/context/format` は貼り付けテキストを受け取り、Markdown に整形した `body`、1〜3 個の `suggestedTags`、`title`、および原文から取得できた場合の `source_last_updated_at`（ISO 日付文字列 `YYYY-MM-DD` または null）を返さなければならない（SHALL）。リクエストには任意で既存タグ一覧を含めてよい（MAY）。system prompt は `contracts/context-format-contract.md` の規則に従わなければならない（SHALL）。Anthropic API キーは既存の AI 画像生成と同様にワークスペース設定または環境変数から解決しなければならない（SHALL）。

#### Scenario: 整形と各フィールドが返る

- **WHEN** クライアントが長文 `rawText` を `POST /api/context/format` に送信する
- **AND** AI API が成功する
- **THEN** 応答に `body`, `suggestedTags`（1〜3 要素）, `title` が含まれる
- **AND** 原文に日付があれば `source_last_updated_at` が含まれる

#### Scenario: 既存タグを優先して提案

- **WHEN** リクエストに `existingTags: ["環境構築", "セキュリティ"]` が含まれる
- **AND** 内容が環境構築に該当する
- **THEN** `suggestedTags` は可能な限り `環境構築` 等の既存タグから選ばれる

### Requirement: 社内コンテキスト本文検索 API

`GET /api/context/items/search` を提供し、クエリ `q`（必須・空文字不可）と `contextMode` でバックエンドを選択し、`title` および `body`（およびタグ文字列）の部分一致検索を行わなければならない（SHALL）。`q` は `lib/context-search.ts` の `normalizeSearchQuery` で正規化され、**引用符**（`「」『』""''` 等）および説明文（`—` / `-` 以降）が除去された後に検索に用いられなければならない（SHALL）。応答は `{ items: ContextItem[] }` とし、各 item に `id`, `title`, `body`, `tags`, `source_url`, `source_last_updated_at` を含めなければならない（SHALL）。結果は `updated_at DESC` で並べなければならない（SHALL）。`q` 未指定または正規化後空の場合は 400 を返さなければならない（SHALL）。

#### Scenario: キーワードでヒットする

- **WHEN** `GET /api/context/items/search?q=ブランチ&contextMode=local` が呼ばれる
- **AND** `title` または `body` に「ブランチ」を含むアイテムが存在する
- **THEN** 該当アイテムが JSON 配列で返される

#### Scenario: 括弧付き q でもヒットする

- **WHEN** `GET /api/context/items/search?q=「ブランチ」&contextMode=database` が呼ばれる
- **AND** `title` または `body` に「ブランチ」を含むアイテムが存在する
- **THEN** 該当アイテムが JSON 配列で返される

#### Scenario: ヒット 0 件

- **WHEN** `GET /api/context/items/search?q=存在しない語&contextMode=database` が呼ばれる
- **THEN** 空配列 `{ items: [] }` が返される

#### Scenario: q 未指定

- **WHEN** `GET /api/context/items/search` が `q` なしで呼ばれる
- **THEN** レスポンスは 400 である

### Requirement: 社内コンテキストモーダルのキーワードフィルタ正規化

社内コンテキストダイアログのキーワードフィルタは、`lib/context-search.ts` の `normalizeSearchQuery` および `tokenizeSearchQuery` を用いてクエリを正規化しなければならない（SHALL）。各アイテムの `title`・`body`・`source_url`・`tags` に対し、正規化後トークンのいずれかが部分一致すれば表示対象としなければならない（SHALL）。

#### Scenario: モーダルと API で同一クエリが同等にヒットする

- **WHEN** DB に「NMS Git ブランチ運用ルール」が登録されている
- **AND** モーダルで `「ブランチ」` を入力してフィルタする
- **THEN** 当該アイテムが表示される

