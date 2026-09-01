# context-local-backend Specification

## Purpose

`local-db/context-items.json` による社内コンテキストのローカル永続化、ID 採番、CRUD・タグ OR 検索・全文検索のリポジトリ層を定義する。
## Requirements
### Requirement: local-db ディレクトリ構成

システムはプロジェクトルート配下の `local-db/` に社内コンテキストのローカル永続化を置かなければならない（SHALL）。正本は **`local-db/context-items.json`** 1 ファイルとし、次の形式でなければならない（SHALL）:

- `nextId` — 次に採番する ID（number）
- `items` — `ContextItem` 配列（Neon と同型フィールド）

`local-db/*` は git 追跡対象外とし、`local-db/.gitkeep` のみ追跡してよい（MAY）。

#### Scenario: 初回アクセスで store が自動作成される

- **WHEN** `contextMode` が `local` である
- **AND** `local-db/context-items.json` が存在しない
- **THEN** `{ "nextId": 1, "items": [] }` のファイルが作成される

#### Scenario: gitignore でデータが除外される

- **WHEN** 開発者が `local-db/context-items.json` を作成する
- **THEN** 当該ファイルは git の追跡対象外である

### Requirement: ローカルリポジトリで CRUD とタグ検索を提供する

`lib/context-local/repository.ts` は Neon リポジトリと同一の `ContextRepository` インターフェースで、作成・一覧・取得・更新・削除・タグ OR 検索・既存タグ一覧・全文検索を提供しなければならない（SHALL）。各 `items` 要素は `ContextItem` 型でなければならない（SHALL）。

#### Scenario: 新規作成で ID 採番と store 更新

- **WHEN** ローカルリポジトリで新規アイテムを作成する
- **THEN** `nextId` が ID として使われる
- **AND** `items` 配列に追加される
- **AND** `nextId` が 1 増加する

#### Scenario: タイトル更新

- **WHEN** ID `42` のアイテムの `title` を更新する
- **THEN** `context-items.json` 内の当該要素が上書きされる

#### Scenario: タグ OR 検索

- **WHEN** アイテム A が `tags: ["環境構築"]`、アイテム B が `tags: ["セキュリティ"]` を持つ
- **AND** `tags=環境構築,セキュリティ` で一覧する
- **THEN** A と B の両方が返される

#### Scenario: 削除で items から除去される

- **WHEN** ID `5` のアイテムを削除する
- **THEN** `items` から ID `5` の要素が存在しなくなる

### Requirement: ローカル全文検索

ローカルリポジトリの `searchItems(query)` は `lib/context-search.ts` の `tokenizeSearchQuery` を用い、各アイテムの `title`・`body`・`tags`（空白結合）に対し大文字小文字を区別しない部分一致で検索しなければならない（SHALL）。`query` は呼び出し前に `normalizeSearchQuery` 相当で引用符が除去された後の文字列であることを前提とする（SHALL）。結果は `updated_at DESC, id DESC` で並べなければならない（SHALL）。空クエリは空配列を返さなければならない（SHALL）。

#### Scenario: body に一致

- **WHEN** アイテム B の `body` に「ブランチ戦略」が含まれる
- **AND** `searchItems("ブランチ")` が呼ばれる
- **THEN** B が返される

#### Scenario: 括弧付き query でも body に一致

- **WHEN** アイテム B の `body` に「ブランチ戦略」が含まれる
- **AND** `searchItems("「ブランチ」")` が呼ばれる（API 経由で正規化済み）
- **THEN** B が返される

#### Scenario: 空クエリ

- **WHEN** `searchItems("")` が呼ばれる
- **THEN** 空配列が返される

### Requirement: ローカル書き込みは atomic とする

`context-items.json` への書き込みは、一時ファイルへの書き込み後に rename（または同等の atomic 操作）で置換しなければならない（SHALL）。

#### Scenario: 更新中に不完全 JSON が残らない

- **WHEN** アイテム更新の書き込みが成功する
- **THEN** `context-items.json` はパース可能な完全な JSON である

### Requirement: 旧分割形式からの自動移行

`local-db/context-items.json` が存在せず、旧形式（`context-meta.json` および/または `context-items/{id}.json`）が存在する場合、システムは初回アクセス時に内容を読み取り `context-items.json` を生成しなければならない（SHALL）。移行後も旧ファイルの自動削除を行ってはならない（MUST NOT）。

#### Scenario: 分割ファイルから単一 JSON へ移行

- **WHEN** `context-items/1.json` と `context-meta.json` が存在する
- **AND** `context-items.json` が存在しない
- **AND** ローカルリポジトリが初回アクセスされる
- **THEN** `context-items.json` が作成される
- **AND** `items` に旧 `1.json` の内容が含まれる

#### Scenario: 移行後は単一ファイルのみ更新

- **WHEN** 移行済みの `context-items.json` が存在する
- **AND** ローカルリポジトリで CRUD が実行される
- **THEN** `context-items.json` のみが更新される

