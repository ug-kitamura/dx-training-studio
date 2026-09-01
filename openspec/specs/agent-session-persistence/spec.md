# agent-session-persistence Specification

## Purpose
TBD - created by archiving change lesson-folder-agent-sessions. Update Purpose after archive.
## Requirements
### Requirement: FS 不可時の localStorage フォールバック

`PUT /api/agent/session` が FS 書き込み不可（501 等）で失敗した場合、クライアントは `localStorage` の**単一キー**に `AgentChatStorage` を保存しなければならない（SHALL）。`GET` が 404 または FS 不可の場合、クライアントは同一エントリから読み込まなければならない（SHALL）。フォールバックのキーをフォーカス階層で分けてはならない（MUST NOT）——サーバー側の保存先が単一であるため、分けると両者で履歴が食い違う。

#### Scenario: API 失敗時に localStorage に保存する

- **WHEN** `PUT /api/agent/session` が 501 を返す
- **THEN** クライアントは `localStorage` の単一キーに `AgentChatStorage` を保存する
- **AND** UI に致命的エラーを表示しない

#### Scenario: API 404 時に localStorage から復元する

- **WHEN** `GET /api/agent/session` が 404 を返し、`localStorage` にデータがある
- **THEN** クライアントは `localStorage` のデータを Agent 状態として使用する

### Requirement: 単一保存先の session API

`GET /api/agent/session` および `PUT /api/agent/session` エンドポイントが存在し、**フォーカス階層によらず単一の保存先**を読み書きしなければならない（SHALL）。保存先は `contents-work/sessions/agent-chat.json` でなければならない（SHALL）。保存先を指定するクエリパラメータ（`lessonId`・`scope` 等）を受け取ってはならない（MUST NOT）——保存先はフォーカスに依存しない。

`agent-chat.json` のスキーマは `AgentChatStorage`（`version`, `activeSessionId`, `sessions`）でなければならない（SHALL）。1 ファイルに全セッションが入るため、run ごとの会話は `sessions` 配列の要素として区別しなければならない（SHALL）。

保存先ディレクトリが存在しない場合は作成しなければならない（SHALL）——`contents-work/` はアプリの作業データルートであり、コンテンツのディレクトリとは違って生成してよい。

#### Scenario: 保存先から読み込む

- **WHEN** `GET /api/agent/session` を呼び出し、`contents-work/sessions/agent-chat.json` が存在する
- **THEN** HTTP 200 と `AgentChatStorage` JSON が返される

#### Scenario: 保存先が存在しない

- **WHEN** `GET /api/agent/session` を呼び出し、`contents-work/sessions/agent-chat.json` が存在しない
- **THEN** HTTP 404 が返される

#### Scenario: 保存先に保存する

- **WHEN** `PUT /api/agent/session` に有効な `AgentChatStorage` を送信する
- **THEN** `contents-work/sessions/agent-chat.json` が更新される
- **AND** HTTP 200 が返される

#### Scenario: フォーカスを変えても同じ保存先を使う

- **WHEN** あるレッスンにフォーカスした状態で会話を保存し、別のシリーズへフォーカスを移してから読み込む
- **THEN** 同じ `AgentChatStorage` が返される

### Requirement: フォーカス変更でセッションを切り替えない

ペイン4 は、ペイン1〜3 のフォーカスが変わってもセッションを読み直してはならない（MUST NOT）。フォーカス階層をキーとしたコンポーネントの再マウントを行ってはならない（MUST NOT）——保存先が単一である以上、読み直しても同じ内容であり、実行中の会話の表示状態を失うだけである。

フォーカス階層は invoke の送信値・`@` 参照候補・相対パスの基準としては引き続き使わなければならない（SHALL）。

#### Scenario: 会話中にフォーカスを移す

- **WHEN** ペイン4 で会話をしている最中に、ペイン2 で別のレッスンを選ぶ
- **THEN** 表示中の会話はそのまま残る
- **AND** 実行中の処理は中断されない

#### Scenario: フォーカスは invoke に反映される

- **WHEN** フォーカスを別のレッスンへ移してから invoke を実行する
- **THEN** 新しいフォーカス階層がスコープとして送信される

