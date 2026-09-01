# agent-tool-loop Specification

## Purpose
TBD - created by archiving change refactor-create-draft-tool-loop. Update Purpose after archive.
## Requirements
### Requirement: 副作用は tool 経由のみ

Agent スキル実行において、DB 検索・ファイル書き込み等の副作用は LLM tool use 経由でのみ実行されなければならない（SHALL）。クライアントまたは invoke 前処理が assistant / user メッセージを regex で解析し副作用を起こしてはならない（MUST NOT）。チャット本文に `検索キーワード:` / `選択確定:` 等の機械可読プロトコル行を要求してはならない（MUST NOT）。

#### Scenario: テキストプロトコル行に依存しない

- **WHEN** `create-draft` スキルが実行される

- **THEN** 社内コンテキスト検索は `search_company_context` tool の呼び出しによってのみ実行される

- **AND** クライアントはメッセージ本文から検索クエリを regex 抽出しない

#### Scenario: 自然言語のみでユーザーが承認する

- **WHEN** ユーザーが「いいです」「お願いします」等の自然文で承認する

- **THEN** AI が意図を解釈し、必要な tool を呼び出す

- **AND** クライアントは短い承認トークンを regex マッチしない

### Requirement: tool 定義の配置

各 tool の schema と executor は `lib/agent/tools/` 配下に配置されなければならない（SHALL）。invoke route と将来の adapter（MCP 等）は同一 executor を呼び出さなければならない（SHALL）。

#### Scenario: 共有 executor を invoke から呼ぶ

- **WHEN** invoke route が `search_company_context` tool を実行する

- **THEN** `lib/agent/tools/` 内の executor が `GET /api/context/items/search` と同等の検索ロジックを用いる

### Requirement: スキル frontmatter の tools 宣言

スキル frontmatter は `tools:` 配列で当該スキルが使用可能な tool 名を宣言できなければならない（SHALL）。invoke route は宣言された tool のみを Anthropic API に渡さなければならない（SHALL）。`tools` 未宣言のスキルは tool なしで実行されなければならない（SHALL）。

#### Scenario: create-draft が tool subset を宣言する

- **WHEN** `create-draft/SKILL.md` の frontmatter に `tools: [search_company_context, select_company_context]` が定義されている

- **AND** create-draft で invoke が実行される

- **THEN** Anthropic API 呼び出しには当該 2 tool のみが含まれる

### Requirement: server-side agent loop

`POST /api/agent/invoke` は 1 回の HTTP リクエスト内で agent loop を実行しなければならない（SHALL）。model が tool_use を返した場合、サーバーは tool を実行し tool_result を messages に追加してから model を再呼び出ししなければならない（SHALL）。最終 assistant テキストまたはエラーで loop を終了しなければならない（SHALL）。loop 上限（既定 24 ターン）は設定可能でなければならない（SHALL）。

ツール実行は EBEX 式の防御を備えなければならない（SHALL）:

- 壊れた tool_use（入力パース失敗・必須パラメータ欠落）は実行せず、recoverable なエラー結果と修正ガイダンスをモデルへ返す。max_tokens による途中切断が原因の場合はその旨の注記を付す
- 同一のツールエラーが許容回数（既定 2 回）を超えて連続した場合、HTTP 422 でループを停止する
- `AbortSignal` が中断を示した場合、残りのツールを実行せずループを終える
- ツール実行前にフォーカススコープ対象ディレクトリの存在を検査し、消失時は HTTP 409 で停止する

テキストとツール呼び出しのまとまりは `logical_turn` としてクライアントへ通知されなければならない（SHALL）。ツール実行は `ToolExecutionContext`（projectRoot・フォーカススコープ・実行中スキル・signal・search / generate 設定・dx 固有の contextMode）を介して行われなければならない（SHALL）。

#### Scenario: 検索 tool 実行後に会話が継続する

- **WHEN** model が `search_company_context` の tool_use を返す

- **THEN** サーバーが tool を実行し tool_result を messages に追加する

- **AND** 同一 HTTP リクエスト内で model が再呼び出される

- **AND** 最終応答がクライアントにストリームされる

#### Scenario: スコープ対象の消失時は停止する

- **WHEN** ツール実行前にフォーカススコープ対象のディレクトリが存在しない

- **THEN** HTTP 409 で停止する

### Requirement: tool result の最小化

tool result は token 節約のため必要最小限のフィールドのみ含めなければならない（SHALL）。`search_company_context` の result では各 item に DB の `id` および表示用 1 始まり index `i` を含めなければならない（SHALL）。各 item の `body` は空文字でなければならない（SHALL）。`select_company_context` の result では選択 item の `body` および `hasBody`（`body` が空でない場合 `true`）を含めなければならない（SHALL）。

#### Scenario: 検索 result は summary のみ

- **WHEN** `search_company_context` が 3 件を返す

- **THEN** tool_result 内の各 item に `id`, `i`, `title`, `url`, `tags`, `updated` 等のメタが含まれる

- **AND** 各 item の `body` は空文字である

#### Scenario: 選択 result は body と hasBody を含む

- **WHEN** `select_company_context` が `ids: [42]` で実行される

- **AND** id 42 の item に body テキストがある

- **THEN** tool_result には当該 item のみが含まれる

- **AND** 当該 item の `hasBody` は `true` である

#### Scenario: 空 body item の選択成功

- **WHEN** `select_company_context` が `ids: [42]` で実行される

- **AND** id 42 の item の body が空である

- **THEN** tool_result に当該 item が含まれる

- **AND** 当該 item の `hasBody` は `false` である

- **AND** tool_result に選択失敗エラーは含まれない

### Requirement: create-draft 専用 tools

`create-draft` スキルは少なくとも次の tool を使用しなければならない（SHALL）:

- `search_company_context({ query: string })` — 社内コンテキストを検索し summary 一覧（各 item に `id` と表示用 `i`）を返す
- `select_company_context({ ids: number[] })` — 指定 id の item を repository から取得し body 付きで返す。空配列 `[]` は選択なしを意味する

`select_company_context` は server-side session や直前 search の in-memory 結果に依存してはならない（MUST NOT）。

#### Scenario: 再検索

- **WHEN** ユーザーが自然言語で別キーワードでの再検索を依頼する

- **AND** AI が `search_company_context` を新 query で呼び出す

- **THEN** 新しい検索結果が tool_result として messages に追加される

#### Scenario: DB 未接続

- **WHEN** `search_company_context` 実行時に DB が未接続である

- **THEN** tool_result にエラー情報が含まれる

- **AND** AI はユーザーに接続エラーを伝えられる

#### Scenario: invoke 跨ぎで select が成功する

- **WHEN** 前回の invoke で `search_company_context` が実行され messages 履歴に `id: 42` を含む tool_result が保存されている

- **AND** 新しい invoke で AI が `select_company_context` を `{ ids: [42] }` で呼び出す

- **THEN** id 42 の item が repository から取得され tool_result に含まれる

- **AND** 「先に search を実行してください」エラーは返されない

#### Scenario: 存在しない id

- **WHEN** `select_company_context` が `{ ids: [99999] }` で実行される

- **AND** id 99999 の item が存在しない

- **THEN** tool_result にエラー情報が含まれる

- **AND** `items` は空配列である

### Requirement: メッセージ履歴における tool 記録

Agent 会話の永続化において、tool_use と tool_result は messages 履歴の一部として保存されなければならない（SHALL）。別途スキル専用の並行状態（例: `createDraftContext`, `lastSearchResults` session）を保持してはならない（MUST NOT）。`select_company_context` は messages 履歴内の search tool result に含まれる `id` を参照して item を取得できなければならない（SHALL）。

#### Scenario: セッション復元後に検索結果が復元される

- **WHEN** create-draft 対話中に `search_company_context` が実行された

- **AND** ユーザーがページをリロードする

- **THEN** 保存済み messages から検索結果 tool_result が復元表示される

#### Scenario: セッション復元後に select が id 参照で動作する

- **WHEN** ページリロード前に search tool result が messages に保存されている

- **AND** リロード後の新 invoke で `select_company_context({ ids: [...] })` が呼ばれる

- **THEN** 指定 id の item が repository から取得される

### Requirement: LLM provider adapter 層

agent loop は LLM プロバイダ固有 API を直接呼び出してはならない（MUST NOT）。`lib/agent/llm/` に共通型（`LlmMessage`, `ToolCall`, `ToolResult` 等）と provider adapter interface を定義し、tool loop は adapter 経由でのみ LLM と通信しなければならない（SHALL）。tool executor（`lib/agent/tools/`）は adapter と独立し、プロバイダ非依存でなければならない（SHALL）。

#### Scenario: 初回実装は Anthropic adapter のみ

- **WHEN** `x-ai-model: claude-sonnet-5` で invoke が実行される

- **THEN** Anthropic adapter が tool use 付き stream を実行する

#### Scenario: 未実装 provider は adapter 層で拒否

- **WHEN** `x-ai-model: gpt-5-nano` 等、adapter 未実装の slug で invoke が実行される

- **THEN** HTTP 400 と「このモデルは未対応です」が返される

- **AND** invoke route が OpenAI / Gemini API を直接呼び出すことはない

#### Scenario: 将来 adapter 追加時に tool loop を変更しない

- **WHEN** 将来 OpenAI または Gemini adapter が追加される

- **THEN** `lib/agent/tools/` の executor と agent loop ロジックは変更なしで再利用できる

