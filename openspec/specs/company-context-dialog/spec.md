# company-context-dialog Specification

## Purpose

GlobalHeader から開く社内コンテキスト管理ダイアログ（一覧・CRUD・タグ入力・鮮度アラート・AI 整形）の UI 要件を定義する。
## Requirements
### Requirement: GlobalHeader から社内コンテキストダイアログを開く

`GlobalHeader` に「社内コンテキスト」ボタンが存在し、クリックで管理ダイアログを開かなければならない（SHALL）。配置は DX トレーニング曼陀羅ボタンと設定ボタンの間でなければならない（SHALL）。

#### Scenario: ボタンからダイアログを開く

- **WHEN** ユーザーが GlobalHeader の「社内コンテキスト」をクリックする
- **THEN** 社内コンテキスト管理ダイアログが表示される

### Requirement: 社内コンテキストの CRUD UI

管理ダイアログは `context_items` の一覧表示・新規作成・編集・削除を提供しなければならない（SHALL）。各アイテムのフィールドは `title`, `body`（Markdown）, `tags`, `source_url`（必須）, `source_last_updated_at`（任意）でなければならない（SHALL）。UI ラベルは次を用いなければならない（SHALL）: `body` → **本文**, `source_url` → **ソース URL**, `source_last_updated_at` → **ソース最終更新日（任意）**。UI パターンは `MetaDialogField` と shadcn の `Dialog` を用い、既存のメタ編集ダイアログに倣わなければならない（SHALL）。

#### Scenario: 新規アイテムを保存する

- **WHEN** ユーザーが必須フィールドを入力して保存する
- **THEN** `POST /api/context/items` が呼ばれ一覧が更新される

#### Scenario: source_url 未入力で保存不可

- **WHEN** ユーザーが `source_url` を空のまま保存しようとする
- **THEN** バリデーションエラーが表示される

#### Scenario: 日本語ラベルが表示される

- **WHEN** ユーザーが新規追加フォームを開く
- **THEN** 本文・ソース URL・ソース最終更新日（任意）のラベルが表示される

### Requirement: タグ入力は補完とインライン追加

タグ入力 UI は既存タグ（`GET /api/context/tags`）のオートコンプリートと、新規タグのインライン追加を両方サポートしなければならない（SHALL）。1 アイテムに **1〜3 個** のタグを付与できなければならない（SHALL）。保存時に tags が空の場合はバリデーションエラーを表示しなければならない（SHALL）。

#### Scenario: 既存タグから選択

- **WHEN** ユーザーがタグ入力欄で文字を入力する
- **AND** 既存タグに一致するものがある
- **THEN** 候補が表示され選択できる

#### Scenario: 新規タグを追加

- **WHEN** ユーザーが未登録のタグ名を入力して確定する
- **THEN** そのタグがアイテムの `tags` に追加される

#### Scenario: タグ未入力で保存不可

- **WHEN** ユーザーが tags を空のまま保存しようとする
- **THEN** バリデーションエラーが表示される

### Requirement: 鮮度アラートとフィルタ

`source_last_updated_at` が未入力、または現在日から 1 年以上前のアイテムには一覧でアラート表示しなければならない（SHALL）。「原典更新日が古い・未入力」で一覧をフィルタできなければならない（SHALL）。

#### Scenario: 1 年超でアラート

- **WHEN** アイテムの `source_last_updated_at` が 400 日以上前である
- **THEN** 一覧で鮮度アラートが表示される

#### Scenario: 未入力でアラート

- **WHEN** アイテムの `source_last_updated_at` が NULL である
- **THEN** 一覧で鮮度アラートが表示される

### Requirement: AI整形ボタン

作成・編集フォームに **「AI整形」** ボタンを配置しなければならない（SHALL）。クリック時、現在の **本文** 欄のテキスト（貼り付け長文を想定）を `POST /api/context/format` に送り、返却値で **タイトル**・**本文**（要約 Markdown）・**ソース最終更新日**（原文から取得できた場合のみ）・**タグ**（1〜3 個）の各欄を更新しなければならない（SHALL）。**ソース URL** は AI 整形では変更してはならない（MUST NOT）。ボタンにはツールチップで「要約・タグ提案・Markdown 整形」を示してよい（MAY）。

#### Scenario: AI整形で各欄が更新される

- **WHEN** ユーザーが長文を本文欄に貼り付け「AI整形」をクリックする
- **AND** API が成功する
- **THEN** タイトル・本文・タグ欄が更新される
- **AND** 原文に更新日が記載されていればソース最終更新日欄が更新される
- **AND** ソース URL 欄は変更されない

#### Scenario: DB 未接続時

- **WHEN** `DATABASE_URL` が未設定で AI整形以外の保存を試みる
- **THEN** 接続エラーメッセージが表示される

### Requirement: ダイアログ表示時に一覧を読み込む

`CompanyContextDialog` は `open` が `true` になったとき、親コンポーネントから `onOpenChange` が呼ばれなくても `GET /api/context/items` および `GET /api/context/tags` によるデータ読み込みを実行しなければならない（SHALL）。GlobalHeader ボタン等、親 state だけで `open` が true になる経路でも一覧が表示されなければならない（SHALL）。

#### Scenario: ヘッダーボタンから開いたとき一覧が表示される

- **WHEN** ページリロード後、ユーザーが GlobalHeader の「社内コンテキスト」をクリックする
- **AND** DB に 1 件以上の `context_items` が存在する
- **THEN** 管理ダイアログの一覧に当該アイテムが表示される

#### Scenario: 保存後に閉じて再度開いても一覧が表示される

- **WHEN** ユーザーがアイテムを保存してダイアログを閉じる
- **AND** 再度ヘッダーボタンからダイアログを開く
- **THEN** 保存済みアイテムが一覧に表示される

### Requirement: 一覧キーワード検索

管理ダイアログの一覧モードにはキーワード検索 UI を配置しなければならない（SHALL）。検索は `title`, `body`, `tags`, `source_url` を対象とし、大文字小文字を区別しない部分一致でフィルタしなければならない（SHALL）。「原典更新日が古い・未入力のみ」フィルタと併用できなければならない（SHALL）。

#### Scenario: タイトルで検索する

- **WHEN** ユーザーがキーワード欄にアイテムタイトルの一部を入力して検索する
- **THEN** 一致するアイテムのみが一覧に表示される

#### Scenario: 検索と鮮度フィルタを併用する

- **WHEN** ユーザーがキーワード検索と「原典更新日が古い・未入力のみ」を両方有効にする
- **THEN** 両条件を満たすアイテムのみが表示される

### Requirement: AI整形でキー未設定のとき設定ダイアログを開く

「AI整形」実行時に `POST /api/context/format` が AI API キー未設定を理由に HTTP 401 を返した場合、`CompanyContextDialog` はエラーメッセージの表示に加えてワークスペース設定ダイアログを開かなければならない（SHALL）。この判定はサーバーとクライアントが共有する単一のキー未設定エラー定数との一致で行わなければならない（SHALL）——文言の重複定義に依存してはならない（MUST NOT）。

#### Scenario: キー未設定で AI整形を実行する

- **WHEN** AI API キーが未設定の状態でユーザーが「AI整形」をクリックする
- **THEN** `POST /api/context/format` は 401 とキー未設定エラーメッセージを返す
- **AND** ワークスペース設定ダイアログが開く

#### Scenario: キー以外の理由の 401 では設定ダイアログを開かない

- **WHEN** AI整形がキー未設定以外の理由で失敗する
- **THEN** エラーメッセージのみが表示され、設定ダイアログは開かない

