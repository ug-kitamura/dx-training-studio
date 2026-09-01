# agent-chat-history Specification

## Purpose

Agent ビューの会話履歴を `contents/` 配下の `session.json`（FS 不可時は `localStorage`）で永続化し、複数セッションの作成・切替・削除を提供する。ペイン1〜3 のフォーカス階層と 1 対 1 で対応する会話スコープと、履歴 UI の要件を規定する。
## Requirements
### Requirement: localStorage によるセッション永続化

Agent ビューの会話は、**フォーカス階層単位**で永続化されなければならない（SHALL）。ローカル dev では `contents/` 配下の当該階層の `session.json`（`AgentChatStorage` 形式）を正本としなければならない（SHALL）。保存先はフォーカス階層と 1 対 1 で対応しなければならない（SHALL）:

| フォーカス | 保存先 |
|---|---|
| レッスン | `contents/<シリーズ>/<コース>/<レッスン>/session.json` |
| コース | `contents/<シリーズ>/<コース>/session.json` |
| シリーズ | `contents/<シリーズ>/session.json` |
| なし（シリーズ 0 件） | `contents/session.json` |

FS 書き込み不可環境では `localStorage` キー `dx-training-studio-agent-chat-v2` 内の当該スコープエントリを正本としなければならない（SHALL）。各セッションは `id`、`title`、`messages`、`activeSkillId`、`createdAt`、`updatedAt` を含めなければならない（SHALL）。**スコープあたり**のセッション数上限は 10 でなければならない（SHALL）。上限超過時は `updatedAt` が最も古いセッションを削除しなければならない（SHALL）。

永続化の debounce 保存は、**会話内容**（messages・activeSkillId 等の意味的スナップショット）が前回保存から変化した場合にのみ実行されなければならない（SHALL）。保存処理そのものが React state（`chatStorage` オブジェクト参照の更新等）を変化させるだけで、追加の保存を連鎖的にトリガーしてはならない（MUST NOT）。

`messages` は user / assistant テキストに加え、tool call 履歴（tool 名・入力・要約 result）および logical turn 構造を含めてよい（MAY）。`contents/` 配下に既に存在するレッスン単位の `session.json` は読み込み可能でなければならない（SHALL）。

#### Scenario: 初回起動時に空セッションを作成する

- **WHEN** 当該スコープの `session.json` も v2 `localStorage` エントリも存在しない

- **THEN** 空のセッション 1 件が作成され、アクティブセッションとして表示される

#### Scenario: リロード後に会話を復元する

- **WHEN** ユーザーがメッセージ送信後にページをリロードする

- **THEN** 直前のフォーカス階層の直前アクティブセッションの messages と activeSkillId が復元される

#### Scenario: メッセージ変更時に自動保存する

- **WHEN** messages または activeSkillId が変更される

- **THEN** 現在のアクティブセッションが debounce 後に正本ストアに保存される

- **AND** 保存内容が前回と同一の場合、追加の PUT は発行されない

#### Scenario: 保存ループが発生しない

- **WHEN** Agent ビューが idle 状態で会話内容に変更がない

- **THEN** `PUT /api/agent/session` は連続して発行されない

#### Scenario: セッション上限で古いセッションを削除する

- **WHEN** 当該スコープで 11 件目のセッションが作成される

- **THEN** `updatedAt` が最も古いセッションが削除され、10 件以内に収まる

#### Scenario: 既存のレッスン単位の履歴が読める

- **WHEN** `contents/<シリーズ>/<コース>/<レッスン>/session.json` が既に存在する

- **THEN** 読み込みはエラーにならず、履歴が失われない

### Requirement: 履歴選択 UI

Agent ビュー内トップ（チャットメッセージ領域の直上）にサブヘッダーが表示され、**左に履歴ドロップダウン**、**右に新規ボタン**が提供されなければならない（SHALL）。履歴ドロップダウンには保存済みセッションが `updatedAt` 降順で一覧表示されなければならない（SHALL）。各項目には title、メッセージ数、更新日時が表示されなければならない（SHALL）。項目選択でアクティブセッションが切り替わらなければならない（SHALL）。セッションタイトルのヘッダー表示は `pane4-side-panel` に従い、本要件のスコープ外とする（SHALL）。

#### Scenario: 履歴から別セッションに切り替える

- **WHEN** ユーザーが履歴ドロップダウンから別セッションを選択する
- **THEN** 選択したセッションの messages と activeSkillId が表示される

#### Scenario: 新規セッションを作成する

- **WHEN** ユーザーが「新規」ボタンをクリックする
- **THEN** 現在のセッションが保存され、空の新セッションがアクティブになる

#### Scenario: サブヘッダーの配置

- **WHEN** Agent ビューが表示されている
- **THEN** 履歴ドロップダウンはビュー内トップ左にある
- **AND** 新規ボタンはビュー内トップ右にある

### Requirement: セッション削除

現在のアクティブセッションを削除する操作が提供されなければならない（SHALL）。削除前に確認ダイアログが表示されなければならない（SHALL）。削除後は別セッションに切り替えるか、セッションが 0 件の場合は新規空セッションを作成しなければならない（SHALL）。削除は**当該フォーカス階層の** `session.json`（または FS 不可時 `localStorage`）に反映されなければならない（SHALL）。

#### Scenario: 現在セッションを削除する

- **WHEN** ユーザーが `/clear` または同等 UI で現在セッションの削除を確認する
- **THEN** 当該セッションが永続化ストアから削除され、別セッションまたは空セッションが表示される

### Requirement: フォーカス階層のセッションスコープ

Agent 会話履歴は**フォーカス階層**（シリーズ / コース / レッスン / なし）単位で分離されなければならない（SHALL）。フォーカスが変わった場合、切替先スコープの `AgentChatStorage` を load し、当該スコープの sessions を表示しなければならない（SHALL）。切替元スコープの進行中 state は flush して保存しなければならない（SHALL）。

**レッスンの切替はセッションスコープを変更しなければならない（SHALL）。** これは移植時の「レッスン選択の切替はセッションスコープを変更してはならない」から反転した要件であり、案件フォルダの廃止に伴う意図的な変更である。

フォーカス階層は、下の階層が存在すればその先頭へ降り、存在しなければその階層で止まる規則で決まらなければならない（SHALL）。この規則により、下の階層が生まれた時点で上位スコープの `session.json` は UI から到達できなくなる。ファイルは削除してはならない（MUST NOT）が、到達手段を提供する必要はない。

#### Scenario: レッスン切替でセッションが変わる

- **WHEN** ユーザーがペイン2 でレッスン A からレッスン B へ切り替える

- **THEN** レッスン B の会話履歴（または空セッション）が表示される

- **AND** レッスン A の会話は表示されない

- **AND** レッスン A の進行中 state は保存されている

#### Scenario: レッスン A に戻ると A の会話が復元される

- **WHEN** ユーザーがレッスン A → B → A と選択を切り替える

- **THEN** レッスン A に戻った時点で A の保存済み会話が表示される

#### Scenario: コースにレッスンが無い場合はコース単位で会話する

- **WHEN** ユーザーがレッスンを 1 つも持たないコースを選択する

- **THEN** フォーカスはコースで止まり、`contents/<シリーズ>/<コース>/session.json` が正本になる

#### Scenario: シリーズにコースが無い場合はシリーズ単位で会話する

- **WHEN** ユーザーがコースを 1 つも持たないシリーズを選択する

- **THEN** フォーカスはシリーズで止まり、`contents/<シリーズ>/session.json` が正本になる

#### Scenario: シリーズが 0 件でも会話できる

- **WHEN** `contents/` にシリーズが 1 つも存在しない

- **THEN** `contents/session.json` が正本になり、会話を開始できる

#### Scenario: 下の階層が生まれると上位スコープへ到達できなくなる

- **WHEN** シリーズにフォーカスして会話した後、そのシリーズにコースを作成する

- **THEN** フォーカスは自動的にコース（またはさらにレッスン）へ降りる

- **AND** `contents/<シリーズ>/session.json` は削除されずに残る

### Requirement: セッション title を自動生成する

セッションで初めて user メッセージが送信確定されると、即時に `deriveSessionTitle`（最大 40 字、末尾に `…` なし）をプレースホルダーとして設定しなければならない（SHALL）。初回 assistant 応答が **正常完了** した後、`agent-session-title-generation` に従い LLM タイトル生成を試みなければならない（SHALL）。LLM 生成に成功した場合はプレースホルダーを上書きしなければならない（SHALL）。LLM 生成に失敗した場合または API キー未設定の場合はプレースホルダーを維持しなければならない（SHALL）。

#### Scenario: 送信直後にプレースホルダータイトルが設定される

- **WHEN** 新規セッションで user が初メッセージを送信する
- **THEN** セッション title が `deriveSessionTitle` の結果になる

#### Scenario: 初回応答後に LLM タイトルで上書きされる

- **WHEN** 初回 user メッセージに対する assistant 応答が完了する
- **AND** タイトル生成 API が成功する
- **THEN** セッション title が LLM 生成タイトルに更新される

#### Scenario: LLM 失敗時はプレースホルダーを維持

- **WHEN** 初回 assistant 応答が完了する
- **AND** タイトル生成 API が失敗する
- **THEN** セッション title は `deriveSessionTitle` のままである

### Requirement: セッションタイトル手動編集

履歴ドロップダウンの各セッション項目に、削除ボタンの左側にタイトル編集ボタン（`Pencil` アイコン、社内コンテキスト編集と同スタイル）が提供されなければならない（SHALL）。クリック時にタイトル編集モーダルが開かなければならない（SHALL）。保存時のタイトルは trim 後 1 文字以上 40 文字以内でなければならない（SHALL）。保存後は当該レッスンの `session.json`（または FS 不可時 `localStorage`）に反映されなければならない（SHALL）。編集対象がアクティブセッションの場合、Pane4 ヘッダーのタイトルも即時更新されなければならない（SHALL）。

#### Scenario: 履歴からタイトルを編集する

- **WHEN** ユーザーが履歴ドロップダウンで編集ボタンをクリックし、新しいタイトルを保存する
- **THEN** 当該セッションの `title` が更新され永続化される
- **AND** 履歴一覧と Pane4 ヘッダー（アクティブ時）に反映される

#### Scenario: 空タイトルは保存できない

- **WHEN** ユーザーが trim 後空のタイトルで保存を試みる
- **THEN** 保存は行われない

### Requirement: 履歴ドロップダウンのタイトル表示

履歴ドロップダウンのタイトル行は、利用可能な横幅に収まる場合は全文を表示しなければならない（SHALL）。収まらない場合は CSS `text-overflow: ellipsis` により省略表示してよい（MAY）。永続化された `title` 文字列に表示用の `…` を付与してはならない（MUST NOT）。

#### Scenario: 横幅に収まる場合は全文表示

- **WHEN** Pane4 幅がタイトル全文を表示するのに十分である
- **THEN** 履歴ドロップダウンにタイトル全文が表示される
- **AND** 末尾に省略記号は付かない

#### Scenario: 横幅不足時は CSS で省略

- **WHEN** Pane4 幅がタイトル全文を表示するには不足している
- **THEN** 履歴ドロップダウンで CSS により末尾が省略表示される

