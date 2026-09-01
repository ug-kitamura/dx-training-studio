# agent-session-title-generation Specification

## Purpose
TBD - created by archiving change pane4-header-redesign. Update Purpose after archive.
## Requirements
### Requirement: セッションタイトル生成 API

システムは `POST /api/agent/session/title` を提供しなければならない（SHALL）。リクエスト body は `messages` 配列（`role`: `user` | `assistant`、`content`: string）を含めなければならない（SHALL）。レスポンスは `{ title: string }` を返さなければならない（SHALL）。生成タイトルは **日本語**・**30 文字程度を目標**・**最大 40 文字**・**引用符なし** の単一行でなければならない（SHALL）。API は既存の AI API キー解決（`resolveAiApiKey` / `resolveLlmProvider`）を用いなければならない（SHALL）。ツール呼び出しは行ってはならない（MUST NOT）。

保存・永続化される `title` 文字列に省略記号 `…` を **付与してはならない**（MUST NOT）。Pane4 ヘッダー等 UI での長いタイトルの省略は CSS `truncate` 等の表示層のみで行わなければならない（SHALL）。

#### Scenario: 会話からタイトルを生成する

- **WHEN** クライアントが user と assistant のメッセージ 1 往復を含む `messages` を POST する
- **AND** 有効な AI API キーが設定されている
- **THEN** 会話の主旨を要約した短い `title` が返される

#### Scenario: API キー未設定時は 401

- **WHEN** AI API キーが未設定の状態でリクエストする
- **THEN** 401 と既存の AI キーエラーメッセージが返される

#### Scenario: 不正 body は 400

- **WHEN** `messages` が空または assistant メッセージを含まない
- **THEN** 400 が返される

#### Scenario: 保存タイトルに省略記号を含めない

- **WHEN** プレースホルダーまたは LLM 生成タイトルが 40 文字を超える内容に基づく
- **THEN** 永続化される `title` は 40 文字に切り詰められ、末尾に `…` が付かない
- **AND** Pane4 ヘッダーは横幅が足りる場合は全文を表示する

### Requirement: 初回応答後にクライアントがタイトルを非同期更新する

`AgentChatPane` は、スキル invoke のストリーミングが **正常完了** した後、アクティブセッションのタイトルがまだ自動生成前（`DEFAULT_SESSION_TITLE` または `deriveSessionTitle` 由来のプレースホルダー）である場合、`POST /api/agent/session/title` を **非同期** に呼び出さなければならない（SHALL）。取得成功時はセッション `title` を更新し永続化しなければならない（SHALL）。タイトル生成の失敗はユーザーにエラー表示してはならない（MUST NOT）。プレースホルダータイトルは維持されなければならない（SHALL）。

#### Scenario: 初回応答完了後にタイトルが更新される

- **WHEN** 新規セッションで user が初メッセージを送信し assistant 応答が完了する
- **AND** タイトル生成 API が成功する
- **THEN** ヘッダーのセッションタイトルが LLM 生成タイトルに更新される
- **AND** `session.json`（または localStorage）に保存される

#### Scenario: API 失敗時はプレースホルダーを維持

- **WHEN** タイトル生成 API が失敗する
- **THEN** `deriveSessionTitle` によるプレースホルダーが表示されたままである
- **AND** チャット UI にエラーは表示されない

#### Scenario: 2 回目以降のメッセージでは再生成しない

- **WHEN** セッションタイトルがすでに LLM 生成済みである
- **AND** ユーザーが追加メッセージを送信し応答が完了する
- **THEN** タイトル生成 API は呼び出されない

