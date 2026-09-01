# agent-invoke-api Specification

## Purpose

DX Training Studio の Agent ビュー向け API を定義する。`POST /api/agent/invoke` によるスキル実行・ストリーミング応答、`GET /api/agent/config` によるモデル表示名の取得、会話履歴と `@` 参照ファイルの Anthropic API への受け渡しを規定する。
## Requirements
### Requirement: スキル実行 API
`POST /api/agent/invoke` エンドポイントが存在し、指定されたスキルを Anthropic API で実行しなければならない（SHALL）。

#### Scenario: スキルを実行してストリーミング応答を返す
- **WHEN** `{ skillId: "create-draft", variables: { ... }, messages: [...] }` で invoke を呼ぶ
- **THEN** Anthropic API が呼び出され、`text/event-stream` 形式で応答が返される

#### Scenario: 存在しないスキル ID
- **WHEN** 存在しない skillId で invoke を呼ぶ
- **THEN** HTTP 404 とエラーメッセージが返される

#### Scenario: API キー未設定
- **WHEN** AI API キーが未設定の状態で invoke を呼ぶ
- **THEN** HTTP 401 と設定を促すエラーメッセージが返される

### Requirement: 既存 API キー解決の流用
スキル実行 API は既存の `resolveAiApiKey()` を使用して API キーを解決しなければならない（SHALL）。モデルは **`x-ai-model` リクエストヘッダーを優先**し、ヘッダーが無いとき **`process.env.AI_MODEL`**、それも無いとき **`claude-sonnet-5`** を用いなければならない（SHALL）。`gpt-5-nano` 等の未対応 slug がサーバーに到達した場合、HTTP 400 と「このモデルは未対応です」を返さなければならない（SHALL）。

#### Scenario: WorkspaceSettings の API キーを使用する
- **WHEN** WorkspaceSettings に AI API キーが設定されている
- **THEN** そのキーで Anthropic API が呼び出される

#### Scenario: x-ai-model ヘッダーを優先する
- **WHEN** クライアントが `x-ai-model: claude-sonnet-5` を送信する
- **AND** 環境変数 `AI_MODEL` が別の値に設定されている
- **THEN** Anthropic API 呼び出しは `claude-sonnet-5` を用いる

#### Scenario: 未対応モデルを拒否する
- **WHEN** クライアントが `x-ai-model: gpt-5-nano` を送信する
- **THEN** HTTP 400 と「このモデルは未対応です」が返される

### Requirement: チャット履歴の受け渡し
invoke リクエストは `messages` 配列（role + content）を受け取り、Anthropic API の messages パラメータに渡さなければならない（SHALL）。

#### Scenario: 会話履歴を含めて実行する
- **WHEN** messages に過去 2 ターン分の user/assistant メッセージが含まれる
- **THEN** Anthropic API 呼び出しにその履歴が含まれる

### Requirement: @ 参照ファイルの添付解決
invoke リクエストの user メッセージに含まれる `@path` トークンをサーバー側で解析し、許可されたパスのファイル内容を読み込んで Anthropic messages に添付しなければならない（SHALL）。

#### Scenario: 有効な @ 参照を添付する
- **WHEN** user メッセージに `@contents/series/course/lesson.md` が含まれ、ファイルが存在する
- **THEN** ファイル内容が user メッセージのコンテキストとして Anthropic API に渡される

#### Scenario: 存在しない @ 参照
- **WHEN** user メッセージに存在しない `@path` が含まれる
- **THEN** HTTP 400 とエラーメッセージが返される

#### Scenario: 許可外パスを拒否する
- **WHEN** user メッセージに `contents/` 以外の `@path`、または `../` を含むパスが含まれる
- **THEN** HTTP 400 とエラーメッセージが返される

### Requirement: Agent 設定 API
`GET /api/agent/config` エンドポイントが存在し、Agent ビュー表示用の設定情報を JSON で返してよい（MAY）。**モデル表示名の SSoT はクライアント側のワークスペース設定** とし、フッター表示に本 API の `modelLabel` を必須としない（MUST NOT）。本 API は後方互換のため存続してよい（MAY）。

#### Scenario: モデル情報を取得する
- **WHEN** クライアントが `GET /api/agent/config` を呼ぶ
- **THEN** `{ model, modelLabel }` 形式の JSON が返される

#### Scenario: カスタム AI_MODEL を反映する
- **WHEN** 環境変数 `AI_MODEL` が `claude-opus-4-6` に設定されている
- **THEN** レスポンスの `model` は `claude-opus-4-6` である

#### Scenario: 未登録モデルの表示名
- **WHEN** `model` に表示名マップ未登録の slug が設定されている
- **THEN** `modelLabel` は `model` と同じ slug 文字列が返される

### Requirement: create-draft invoke 変数

`POST /api/agent/invoke` で `skillId: "create-draft"` を実行する際、クライアントは `variables` に `lessonMeta`（JSON 文字列）および `availableTags`（JSON 文字列）を含めなければならない（SHALL）。`lessonMeta` には選択中レッスンの現在値（`status`, `tags`, `description`, `estimated_minutes`, `author`）が含まれなければならない（SHALL）。社内コンテキストは `variables.contextItems` ではなく tool result 経由で AI に渡されなければならない（SHALL）。`contextItems` variable を渡してはならない（MUST NOT）。

#### Scenario: lessonMeta が invoke に渡される

- **WHEN** 選択中レッスンの status が `open`、tags が `[git, branch]` である

- **AND** create-draft で invoke が実行される

- **THEN** リクエスト body の `variables.lessonMeta` に当該 status と tags が JSON として含まれる

#### Scenario: contextItems variable を渡さない

- **WHEN** create-draft で invoke が実行される

- **THEN** リクエスト body の `variables` に `contextItems` キーが含まれない

### Requirement: tool use 対応の invoke

`POST /api/agent/invoke` は LLM API に `tools` パラメータを渡せなければならない（SHALL）。スキル frontmatter の `tools:` 宣言に基づき tool schema を解決しなければならない（SHALL）。1 リクエスト内で tool 実行ループを完結させ、クライアントは 1 回の POST で最終応答まで受け取れなければならない（SHALL）。

SSE ストリームは次のイベントを送出しなければならない（SHALL）: `text_delta` / `tool_start` / `tool_end`（summary・display・result・tags 付き）/ `confirm_required`（実行前確認）/ `token_usage`（ターンごとの outputTokens）/ `logical_turn` / `done` / `error`。

#### Scenario: tool 付き invoke がストリームを返す

- **WHEN** スキル実行で model が tool_use を返す

- **THEN** サーバーが tool を実行し、最終 assistant テキストまで `text/event-stream` で返す

#### Scenario: 拡張 SSE イベント

- **WHEN** tool 実行が発生する

- **THEN** SSE ストリームに `tool_start` / `tool_end` イベントが含まれ、`tool_end` には summary・display・result が含まれる

- **AND** クライアントは折りたたみ UI 用に要約を表示できる

#### Scenario: 確認要求イベント

- **WHEN** 確認が必要なツール（書込等）が呼び出される

- **THEN** SSE に `confirm_required` イベント（toolUseId・kind・path 等）が送出され、クライアントの決裁後にループが継続する

### Requirement: フォーカススコープの受け渡し

invoke リクエストは対象の**フォーカススコープ**（`contents/` 内の相対パス。シリーズ / コース / レッスンのいずれか、またはシリーズ 0 件時の空）を受け取れなければならない（SHALL）。スコープの識別子にレッスン ID のような導出値を使ってはならない（MUST NOT）——名前の連結は名前に区切り文字が含まれると曖昧になるため。ファイル系ツールを宣言するスキルの実行時、書込境界は `contents-work/` + `contents/` に設定されなければならない（SHALL）。フォーカス対象のディレクトリが実行中に消失した場合は HTTP 409 で停止しなければならない（SHALL）。

#### Scenario: フォーカススコープ付き invoke

- **WHEN** フォーカススコープ付きで invoke が実行される

- **THEN** ツール実行の書込境界が `contents-work/` + `contents/` に設定される

#### Scenario: スコープ対象の消失時は 409

- **WHEN** invoke 実行中にフォーカス対象のディレクトリが外部で削除される

- **THEN** HTTP 409 とエラーメッセージで停止する

#### Scenario: シリーズが 0 件でも invoke できる

- **WHEN** `contents/` にシリーズが存在せず、スコープが空の状態で invoke が実行される

- **THEN** 書込境界は `contents-work/` + `contents/` のまま実行される

