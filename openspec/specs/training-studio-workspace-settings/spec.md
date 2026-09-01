# training-studio-workspace-settings Specification

## Purpose
TBD - created by archiving change pane4-ai-generation-and-settings. Update Purpose after archive.
## Requirements
### Requirement: GlobalHeader に設定入口を置く

`GlobalHeader` は DX トレーニング曼陀羅ボタンの右隣に設定ボタン（Lucide `Settings`、ghost icon）を配置しなければならない（SHALL）。クリックで設定ダイアログを開かなければならない（SHALL）。ヘッダー高さ `h-12` を維持しなければならない（SHALL）。

#### Scenario: 設定ボタンからダイアログが開く

- **WHEN** ユーザーが設定ボタンをクリックする
- **THEN** 設定ダイアログが表示される

### Requirement: AI API キーをマスク入力で保存する

設定ダイアログは **AI API キー**（Claude 等の AI 呼び出し用）を password 入力（マスク表示）で編集でき、保存操作で `localStorage` の `dx-training-studio-settings` に **`aiApiKey`** として格納しなければならない（SHALL）。入力欄の placeholder は **`AI API key`** としなければならない（SHALL）。サーバーはキーを永続化してはならない（MUST NOT）。各キー行に **表示トグル**（目アイコン、`password` ↔ `text`）と **リセット**（当該フィールドの draft を空文字にする）を提供しなければならない（SHALL）。一括クリアのみの操作に限定してはならない（MUST NOT）。ダイアログにはキーがブラウザ内のみに保存される旨を表示しなければならない（SHALL）。

クライアントは AI 系 API 呼び出し時 **`x-ai-api-key`** ヘッダーでキーを渡してよい（MAY）。サーバーはキー解決時 **ダイアログ由来のヘッダーを優先**し、ヘッダーが無い（ダイアログ未入力）ときのみ **`process.env.AI_API_KEY`（`.env.local`）** を参照しなければならない（SHALL）。

#### Scenario: 保存後に AI 生成が可能になる

- **WHEN** ユーザーが有効な AI API キーを保存する
- **AND** AI タブで生成を実行する
- **THEN** サーバー経由の Claude API 呼び出しが行われる

#### Scenario: ダイアログ入力時はダイアログが優先される

- **WHEN** `AI_API_KEY` が `.env.local` に設定されている
- **AND** ダイアログに別のキーが保存されている
- **AND** ユーザーが AI タブで生成を実行する
- **THEN** サーバーはダイアログ由来のキーのみを用いる

#### Scenario: ダイアログ未入力時は env を参照する

- **WHEN** ダイアログに AI API キーが未入力である
- **AND** `AI_API_KEY` が `.env.local` に設定されている
- **AND** ユーザーが AI タブで生成を実行する
- **THEN** サーバーは `AI_API_KEY` を用いる

#### Scenario: AI キーを表示トグルできる

- **WHEN** ユーザーが AI API キー行の表示ボタンを押す
- **THEN** 入力がマスクなしで表示される
- **AND** 再度押すとマスク表示に戻る

#### Scenario: AI キーをリセットできる

- **WHEN** ユーザーが AI API キー行のリセットを実行する
- **THEN** 入力欄の draft が空になる
- **AND** 保存前は保存済みキーは変更されない

### Requirement: テーマをライト・ダーク・システムで切り替える

設定ダイアログはテーマとして `light`・`dark`・`pink`・`system` のいずれかを選択でき、保存時に `<html>` へ `dark` class または `pink` class を適用または除去しなければならない（SHALL）。`dark` と `pink` を同時に適用してはならない（MUST NOT）。`system` は `prefers-color-scheme` に従わなければならない（SHALL）。`pink` は `prefers-color-scheme` を参照してはならない（MUST NOT）。設定は `dx-training-studio-settings` に永続化し、起動時に復元しなければならない（SHALL）。`dx-training-studio-settings` が未保存の初回起動時、コード既定のテーマは `system` でなければならない（SHALL）。

テーマ選択肢の並びは「ライト」「ダーク」「ピンク」「システム」でなければならない（SHALL）。localStorage から読み込むとき、`pink` を有効値として正規化しなければならない（SHALL）。

#### Scenario: ダーク選択で UI が暗色になる

- **WHEN** ユーザーがテーマを `dark` に保存する
- **THEN** ワークスペース UI がダークトークンで描画される

#### Scenario: システムは OS 設定に追従する

- **WHEN** ユーザーがテーマを `system` に保存する
- **AND** OS がダークモードである
- **THEN** ワークスペース UI はダークで描画される

#### Scenario: 初回起動の既定はシステム

- **WHEN** `dx-training-studio-settings` が存在しない
- **THEN** `DEFAULT_WORKSPACE_SETTINGS.theme` は `system` である
- **AND** ワークスペースは OS の明暗設定に従って描画される

#### Scenario: ピンク選択で UI が桜色になる

- **WHEN** ユーザーがテーマを `pink` に保存する
- **THEN** ワークスペース UI がピンクトークンで描画される
- **AND** `<html>` に `dark` class は付与されない

#### Scenario: 保存済みのピンクが復元される

- **WHEN** `dx-training-studio-settings` の `theme` が `pink` である状態で起動する
- **THEN** テーマは `pink` として復元され、既定値へ戻されない

#### Scenario: テーマ選択肢はダークとシステムの間にピンクを置く

- **WHEN** ユーザーが設定ダイアログのテーマ選択肢を表示する
- **THEN** 選択肢は「ライト」「ダーク」「ピンク」「システム」の順で並ぶ

### Requirement: ペイン既定幅を設定できる

設定ダイアログはツリーペイン・Pane4 の既定幅（px）を `pane-layout.ts` の min/max 内で編集でき、**2 ペイン分の数値入力を横 1 行**（レスポンシブ時は折り返し可）に配置しなければならない（SHALL）。保存時に `settings.paneDefaults` へ格納しなければならない（SHALL）。「今のレイアウトに適用」は現在値をワークスペース幅 state および `dx-training-studio-pane-widths` に書き込まなければならない（SHALL）。「既定幅に戻す」（リセット）は `paneDefaults` をコード既定に戻す操作として、`ghost` より視認しやすいスタイル（例: `outline`）で提供しなければならない（SHALL）。初回起動で `pane-widths` が無いときは `paneDefaults` を読み込まなければならない（SHALL）。コード既定の pane4 幅は **500** でなければならない（SHALL）。ツリーペインのコード既定は **350** でなければならない（SHALL）。旧3ペイン形式（pane1 / pane2）で保存された `paneDefaults` / `pane-widths` は読み捨ててコード既定へフォールバックしなければならない（SHALL）——エラーにしてはならない（MUST NOT）。旧範囲で保存された値（例: pane4 = 600 超）は min/max へ clamp して扱わなければならない（SHALL）。

#### Scenario: 初回起動で paneDefaults を読む

- **WHEN** `dx-training-studio-pane-widths` が存在しない
- **AND** ユーザーが以前 paneDefaults を 350/500 に保存している
- **THEN** 初回 fit は保存済み paneDefaults を用いる

#### Scenario: 既定幅リセットで pane4 が 500

- **WHEN** ユーザーが設定ダイアログで「既定幅に戻す」を実行する
- **THEN** pane4 の paneDefaults は 500 になり、ツリーペインは 350 になる

#### Scenario: 旧3ペイン形式は既定値へフォールバック

- **WHEN** `dx-training-studio-pane-widths` に旧形式（pane1 / pane2 / pane4）が保存された状態で起動する
- **THEN** エラーにならず、ツリーペイン 350 / pane4 500 のコード既定（または保存済みの新形式 paneDefaults）が使われる

### Requirement: 編集モードの CodeMirror はテーマに追従する

テーマが `dark` または `system` かつ OS がダークのとき、レッスン編集 CodeMirror は **Cursor 現在のエディタに近い**ダーク向け Markdown 配色で表示しなければならない（SHALL）。ライトテーマ時は現行のライト配色を用いなければならない（SHALL）。詳細な色要件は `training-studio-workspace-dark-mode` を参照する（SHALL）。

レッスン切替でキャッシュ済み EditorState を復元したときも、復元直後に**現在のテーマ**を反映しなければならない（SHALL）——キャッシュした時点のテーマ配色（例: ライト表示中にダーク配色の本文）を表示してはならない（MUST NOT）。

#### Scenario: ダークテーマでエディタ背景が暗色

- **WHEN** テーマが `dark` である
- **AND** ユーザーが編集モードを開く
- **THEN** CodeMirror の背景がダーク配色である
- **AND** Markdown 要素が識別可能なコントラストである

#### Scenario: レッスン切替のキャッシュ復元でテーマが追従する

- **WHEN** ダークテーマでレッスン A の編集ビューを開いた後、ライトテーマへ切り替え、レッスン B を経由して再びレッスン A（キャッシュ復元）に戻る
- **THEN** レッスン A の本文はライト配色で表示される

### Requirement: Pixabay API キーをマスク入力で保存する

設定ダイアログは Pixabay API キーを password 入力（マスク表示）で編集でき、保存操作で `localStorage` の `dx-training-studio-settings` に格納しなければならない（SHALL）。サーバーはキーを永続化してはならない（MUST NOT）。各キー行に **表示トグル**と **リセット**（draft を空にする）を提供しなければならない（SHALL）。ダイアログにはキーがブラウザ内のみに保存される旨を表示しなければならない（SHALL）。

Web タブの検索 API 呼び出し時、クライアントは `x-pixabay-api-key` ヘッダーでキーを渡してよい（MAY）。サーバーはキー解決時 **ダイアログ由来のヘッダーを優先**し、ヘッダーが無い（ダイアログ未入力）ときのみ **`process.env.PIXABAY_API_KEY`（`.env.local`）** を参照しなければならない（SHALL）。

#### Scenario: 保存後に Web 検索が可能になる

- **WHEN** ユーザーが有効な Pixabay API キーを保存する
- **AND** AI API キーも設定されている
- **AND** Web タブで検索を実行する
- **THEN** サーバー経由の Pixabay API 呼び出しが行われる

#### Scenario: Pixabay キー未設定で検索拒否

- **WHEN** Pixabay API キーが環境変数にもダイアログにも未設定である
- **AND** ユーザーが Web タブで検索を試みる
- **THEN** 検索 API は 401 等で失敗する
- **AND** 設定を促すメッセージが表示される

#### Scenario: Pixabay キーを表示とリセットできる

- **WHEN** ユーザーが Pixabay API キー行の表示およびリセットを操作する
- **THEN** AI API キー行と同様にマスク切替と draft クリアができる

### Requirement: 環境変数テンプレートを提供する

リポジトリは **`dx-training-studio/studio/.env.example`** をコミットし、`AI_API_KEY`・`PIXABAY_API_KEY`・**`BLOB_READ_WRITE_TOKEN`** のプレースホルダを含めなければならない（SHALL）。**`.env.local`** は git 追跡対象外としなければならない（SHALL）。`BLOB_READ_WRITE_TOKEN` は設定ダイアログでは編集せず、`.env.local` のみで設定する（SHALL）。readme は `.env.example` をコピーして `.env.local` を作成する手順を記載しなければならない（SHALL）。

#### Scenario: 新規開発者が env を設定できる

- **WHEN** 開発者が `studio/.env.example` を `studio/.env.local` にコピーしキーを記入する
- **AND** `npm run dev` で起動する
- **THEN** 設定ダイアログ未入力でも AI / Web API が env キーで動作する

### Requirement: 画像の管理モードを設定できる

設定ダイアログは **画像の管理** として **ローカル** / **ストレージ** の 2 択を提供し、選択値を `dx-training-studio-settings` の **`imageStorage`**（`local` | `storage`）として永続化しなければならない（SHALL）。未設定時の既定値は **ストレージ**（`storage`）としなければならない（SHALL）。**ストレージ** 選択時、保存前に `GET /api/images/storage-check` で接続を検証し、失敗時は **「ストレージに接続できません」** を表示して保存を拒否しなければならない（SHALL）。

#### Scenario: 既定はストレージ

- **WHEN** ユーザーが初めて設定ダイアログを開く
- **AND** `imageStorage` が未保存である
- **THEN** 画像の管理はストレージが選択されている

#### Scenario: ローカルに切り替えて保存できる

- **WHEN** ユーザーが画像の管理をローカルに変更して保存する
- **THEN** `imageStorage` が `local` として永続化される
- **AND** 以降の正本 promote・一覧・プレビューは fs を用いる

#### Scenario: ストレージ保存時に接続確認する

- **WHEN** ユーザーが画像の管理をストレージにして保存する
- **AND** Blob 接続が成功する
- **THEN** `imageStorage` が `storage` として永続化される

#### Scenario: トークンなしでストレージ保存を拒否する

- **WHEN** ユーザーが画像の管理をストレージにして保存する
- **AND** `BLOB_READ_WRITE_TOKEN` が未設定である
- **THEN** 「ストレージに接続できません」が表示される
- **AND** 設定は保存されない

### Requirement: 編集エリアのデフォルトフォントサイズを設定できる

設定ダイアログは Pane3 編集モード（raw）の **デフォルトフォントサイズ**（px、整数）を `pane-layout` 等と同様に min/max 内で編集し、`dx-training-studio-settings` に **`editorFontSizePx`** として永続化しなければならない（SHALL）。未設定時は **14** px を既定としなければならない（SHALL）。保存後、次回以降の編集モード初期表示および Ctrl+ホイール調整の基準値として用いなければならない（SHALL）。

#### Scenario: デフォルトフォントを保存して反映する

- **WHEN** ユーザーがデフォルトフォントサイズを 16 に設定して保存する
- **AND** 編集モードでレッスンを開く
- **THEN** エディタ本文のフォントサイズが 16 px 相当で表示される

#### Scenario: 未設定時は 14 px

- **WHEN** `editorFontSizePx` が settings に存在しない
- **AND** ユーザーが編集モードを開く
- **THEN** フォントサイズは 14 px 相当である

### Requirement: AI モデルを設定ダイアログで選択する

設定ダイアログは **横幅** セクションと **API** セクションの間に **AI モデル** セクションを配置しなければならない（SHALL）。選択肢は次の 5 件とし、**この順序**で表示しなければならない（SHALL）:

| slug | 表示ラベル | 保存 |
|------|-----------|------|
| `gpt-5-nano` | GPT 5 nano | 不可（未対応） |
| `claude-haiku-4-5` | Claude Haiku 4.5 | 可 |
| `claude-sonnet-5` | Claude Sonnet 5 | 可（デフォルト） |
| `claude-opus-5` | Claude Opus 5 | 可 |
| `claude-fable-5` | Claude Fable 5 | 可 |

各 slug は Anthropic API の model ID と一致しなければならない（SHALL）。未設定時の既定値は `claude-sonnet-5` でなければならない（SHALL）。保存操作で **`aiModel`** を `dx-training-studio-settings` に格納しなければならない（SHALL）。クライアントは AI 系 API 呼び出し時 **`x-ai-model`** ヘッダーで slug を渡さなければならない（SHALL）。サーバーは **`x-ai-model` ヘッダーを優先**し、ヘッダーが無いときのみ **`process.env.AI_MODEL`** を参照し、それも無いときは **`claude-sonnet-5`** を用いなければならない（SHALL）。一覧に存在しない slug（削除済みの `claude-sonnet-4-6` / `claude-opus-4-7` / `claude-opus-4-8` を含む）が渡された場合、既定値 `claude-sonnet-5` にフォールバックしなければならない（SHALL）。

#### Scenario: デフォルトは Claude Sonnet 5

- **WHEN** ユーザーが初めて設定ダイアログを開く
- **AND** `aiModel` が未保存である
- **THEN** Claude Sonnet 5 が選択されている

#### Scenario: Claude Sonnet 5 を保存できる

- **WHEN** ユーザーが Claude Sonnet 5 を選択して保存する
- **THEN** `aiModel` が `claude-sonnet-5` として永続化される
- **AND** 設定ダイアログが閉じる

#### Scenario: Claude Haiku 4.5 を保存できる

- **WHEN** ユーザーが Claude Haiku 4.5 を選択して保存する
- **THEN** `aiModel` が `claude-haiku-4-5` として永続化される
- **AND** 設定ダイアログが閉じる

#### Scenario: GPT 5 nano は保存できない

- **WHEN** ユーザーが GPT 5 nano を選択して保存を試みる
- **THEN** 「このモデルは未対応です」というエラーが表示される
- **AND** 設定は永続化されない
- **AND** 設定ダイアログは閉じない

#### Scenario: 保存済みモデルが AI API に渡される

- **WHEN** ユーザーが Claude Opus 5 を保存している
- **AND** AI タブで生成を実行する
- **THEN** リクエストに `x-ai-model: claude-opus-5` が含まれる

#### Scenario: 削除済みモデルの保存値はデフォルトにフォールバックする

- **WHEN** ユーザーが過去に `claude-opus-4-8` を `aiModel` として保存している
- **AND** モデル一覧から `claude-opus-4-8` が削除された状態でアプリを開く
- **THEN** 設定ダイアログには既定値の Claude Sonnet 5 が選択されている

### Requirement: 社内コンテキストの管理モードを設定できる

設定ダイアログは **ストレージ** セクション内に **画像の管理** および **社内コンテキストの管理** の 2 サブセクションを **1行2列（横並び）** で配置しなければならない（SHALL）——左に画像の管理、右に社内コンテキストの管理。接続エラーメッセージは各列の下に表示する。**社内コンテキストの管理** は **ローカル** / **データベース** の 2 択を提供し、選択値を `dx-training-studio-settings` の **`contextStorage`**（`local` | `database`）として永続化しなければならない（SHALL）。未設定時の既定値は **データベース**（`database`）としなければならない（SHALL）。

**データベース** 選択時、保存前に `GET /api/context/db-check` で接続を検証し、失敗時は **「データベースに接続できません」** を表示して保存を拒否しなければならない（SHALL）。**ローカル** 選択時は `DATABASE_URL` の接続チェックを行ってはならない（MUST NOT）。

#### Scenario: ストレージ2サブセクションが横に並ぶ

- **WHEN** 設定ダイアログを開いてストレージセクションを表示する
- **THEN** 「画像の管理」と「社内コンテキストの管理」が同じ行に左右で並ぶ

#### Scenario: 既定はデータベース

- **WHEN** ユーザーが初めて設定ダイアログを開く
- **AND** `contextStorage` が未保存である
- **THEN** 社内コンテキストの管理はデータベースが選択されている

#### Scenario: ローカルに切り替えて保存できる

- **WHEN** ユーザーが社内コンテキストの管理をローカルに変更して保存する
- **THEN** `contextStorage` が `local` として永続化される
- **AND** 以降の context API 呼び出しは `contextMode=local` を用いる

#### Scenario: データベース保存時に接続確認する

- **WHEN** ユーザーが社内コンテキストの管理をデータベースにして保存する
- **AND** Neon 接続が成功する
- **THEN** `contextStorage` が `database` として永続化される

#### Scenario: DATABASE_URL なしでデータベース保存を拒否する

- **WHEN** ユーザーが社内コンテキストの管理をデータベースにして保存する
- **AND** `DATABASE_URL` が未設定である
- **THEN** 「データベースに接続できません」が表示される
- **AND** 設定は保存されない

#### Scenario: ローカル保存時は db-check 不要

- **WHEN** ユーザーが社内コンテキストの管理をローカルにして保存する
- **AND** `DATABASE_URL` が未設定である
- **THEN** 設定は正常に保存される

