# context-db-backend Specification

## Purpose

Neon PostgreSQL 上の `context_items` テーブル、接続解決（`DATABASE_URL`）、リポジトリ層 CRUD・タグ OR 検索、マイグレーション SQL を定義する。`@neondatabase/serverless` による App Router 向け DB アクセスを含む。
## Requirements
### Requirement: context_items テーブルスキーマ

システムは Vercel Neon 上に `context_items` テーブルを作成しなければならない（SHALL）。カラムは次を含まなければならない（SHALL）: `id SERIAL PRIMARY KEY`, `title TEXT NOT NULL`, `body TEXT NOT NULL`, `tags TEXT[] NOT NULL DEFAULT '{}'`, `source_url TEXT NOT NULL`, `source_last_updated_at DATE`, `created_by TEXT`, `updated_by TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`。`tags` 列には GIN インデックスを作成しなければならない（SHALL）。

#### Scenario: マイグレーション SQL がスキーマを定義する

- **WHEN** 開発者が `lib/context-db/migrate.sql` を Neon に適用する
- **THEN** `context_items` テーブルと `idx_context_items_tags` GIN インデックスが存在する

### Requirement: Neon 接続の解決

`contextMode` が **`database`** のとき、システムは `DATABASE_URL` 環境変数から Neon 接続を解決しなければならない（SHALL）。未設定または接続不可のときは `DbConnectionError`（または同等）を送出し、メッセージ **「データベースに接続できません」** としなければならない（SHALL）。`contextMode` が `database` のとき、ローカル JSON ファイルやインメモリへの**暗黙フォールバック**を行ってはならない（MUST NOT）。`contextMode` が `local` のとき、Neon 接続を解決してはならない（MUST NOT）。

#### Scenario: DATABASE_URL 未設定で database モード

- **WHEN** `DATABASE_URL` が未設定である
- **AND** `contextMode` が `database` である
- **AND** データベースリポジトリ層が呼び出される
- **THEN** 接続エラーが送出される
- **AND** エラーメージは「データベースに接続できません」である

#### Scenario: local モードでは Neon を使わない

- **WHEN** `contextMode` が `local` である
- **AND** context CRUD API が呼び出される
- **THEN** Neon への接続試行は行われない

### Requirement: リポジトリ層で CRUD とタグ検索を提供する

`lib/context-db/repository.ts` は `context_items` の作成・一覧・取得・更新・削除およびタグ OR 検索（`tags &&`）・既存タグ一覧（`DISTINCT unnest(tags)`）を提供しなければならない（SHALL）。`body` は Markdown 文字列として保存しなければならない（SHALL）。

#### Scenario: タグ OR 検索で複数ヒット

- **WHEN** アイテム A が `tags: [環境構築]`、アイテム B が `tags: [セキュリティ]` を持つ
- **AND** `tags=環境構築,セキュリティ` で検索する
- **THEN** A と B の両方が返される

#### Scenario: created_by が取得できない

- **WHEN** サーバーが `os.userInfo().username` を取得できない
- **AND** 新規アイテムを作成する
- **THEN** `created_by` は NULL または空として保存される

### Requirement: v1 はローカル dev スコープ

`context-db-backend` の動作保証はローカル `npm run dev` に限定する（SHALL）。Vercel デプロイ環境での DB 動作は v1 の対象外とする。

#### Scenario: ローカル dev で DB 接続が動作する

- **WHEN** 開発者が `.env.local` に `DATABASE_URL` を設定し `npm run dev` で起動する
- **THEN** リポジトリ層が Neon に接続できる

### Requirement: title と body の ILIKE 検索

`lib/context-db/repository.ts` は `searchItems(query: string)` を提供し、`lib/context-search.ts` の `tokenizeSearchQuery` で分割した各トークンについて `title ILIKE` / `body ILIKE` / タグ文字列 `ILIKE` のいずれかに部分一致するアイテムを返さなければならない（SHALL）。`query` は API 層で `normalizeSearchQuery` により引用符除去された後に渡されることを前提とする（SHALL）。結果は `updated_at DESC, id DESC` で並べなければならない（SHALL）。正規化後空の場合は空配列を返さなければならない（SHALL）。

#### Scenario: title に一致

- **WHEN** アイテム A の `title` が「環境構築手順」である
- **AND** `searchItems("環境")` が呼ばれる
- **THEN** A が返される

#### Scenario: body に一致

- **WHEN** アイテム B の `body` に「ブランチ戦略」が含まれる
- **AND** `searchItems("ブランチ")` が呼ばれる
- **THEN** B が返される

#### Scenario: 括弧付き query でも title に一致

- **WHEN** アイテム C の `title` が「NMS Git ブランチ運用ルール」である
- **AND** `searchItems("「ブランチ」")` が呼ばれる（API 経由で正規化済み）
- **THEN** C が返される

#### Scenario: 空クエリ

- **WHEN** `searchItems("")` が呼ばれる
- **THEN** 空配列が返される

### Requirement: Context リポジトリのモード解決

システムは `contextMode`（`local` | `database`）に応じて `ContextRepository` 実装を解決しなければならない（SHALL）。`database` は既存 Neon 実装、`local` は `context-local-backend` の JSON 実装としなければならない（SHALL）。未指定または不正値のときは `database` を用いなければならない（SHALL）。

#### Scenario: database モードで Neon リポジトリ

- **WHEN** `contextMode` が `database` である
- **AND** `getContextRepository`（または同等）が呼ばれる
- **THEN** Neon SQL リポジトリが返される

#### Scenario: local モードで JSON リポジトリ

- **WHEN** `contextMode` が `local` である
- **AND** `getContextRepository` が呼ばれる
- **THEN** ローカル JSON リポジトリが返される

#### Scenario: 未指定時は database

- **WHEN** API 呼び出しに `contextMode` が含まれない
- **THEN** `database` として解決される

