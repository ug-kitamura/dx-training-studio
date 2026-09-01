# lesson-draft-skill Specification

## Purpose

選択中レッスンから markdown 草稿を生成する `create-draft` Agent スキルの存在・入出力・Phase 1 制約を規定する。
## Requirements
### Requirement: レッスン草稿作成スキルの存在

`create-draft` スキルが `dx-training-studio/.claude/skills/create-draft/SKILL.md` に存在しなければならない（SHALL）。選択中レッスンのメタ情報と本文を入力として受け取り、markdown 形式の草稿を生成しなければならない（SHALL）。frontmatter `variables` には `series`, `course`, `lesson`, `lessonBody`, `courseMeta`, `lessonMeta`, `availableTags` を含めなければならない（SHALL）。frontmatter `tools` には `search_company_context` と `select_company_context` を含めなければならない（SHALL）。`lessonMeta` は JSON 文字列（現在レッスンの `status`, `tags`, `description`, `estimated_minutes`, `author`）でなければならない（SHALL）。`availableTags` は JSON 文字列（ワークスペース内既存レッスン tags のユニーク配列）でなければならない（SHALL）。

#### Scenario: スキル一覧に表示される

- **WHEN** `/api/agent/skills` を呼び出す

- **THEN** `create-draft` スキルが一覧に含まれる

#### Scenario: レッスン草稿を生成する

- **WHEN** ユーザーが create-draft スキルを呼び出し、variables に `series`, `course`, `lesson`, `lessonBody`, `courseMeta`, `lessonMeta`, `availableTags` が渡される

- **THEN** AI がフロントマター付き markdown 形式のレッスン草稿を返す

### Requirement: 草稿の markdown 形式

生成される草稿は markdown 本文のみでなければならない（SHALL）。YAML frontmatter を含めてはならない（SHALL NOT）。草稿受領時、アプリはレッスン `.meta.json` のメタを次のとおり更新しなければならない（SHALL）: `description` は草稿内容に合わせて更新してよい（MAY）; `tags` は既存値を優先し、無ければ利用可能タグからの推定で補完する（`[a-z0-9-]+` 外の tag を invent してはならない（MUST NOT））; `estimated_minutes` は既存値が 0 の場合のみ本文からの推定で補完する; `status` は既存値を維持する。

#### Scenario: 本文のみの草稿が返される

- **WHEN** create-draft スキルが草稿を生成する
- **THEN** 応答は markdown 本文のみで、`---` で囲まれた YAML frontmatter を含まない

#### Scenario: 草稿受領で status が変わらない

- **WHEN** `.meta.json` に `"status": "open"` を持つレッスンへ草稿を受領する
- **THEN** 受領後も `.meta.json` の status は `open` である

#### Scenario: 草稿受領で minutes が補完される

- **WHEN** `estimated_minutes` が 0 のレッスンへ草稿を受領する
- **THEN** 本文から推定された `estimated_minutes` が `.meta.json` に書き込まれる

### Requirement: create-draft Phase 2 対話フロー

`create-draft` スキル本文は、Pane 3 Agent ビューのチャット対話で次のフェーズを実行する手順を記述しなければならない（SHALL）: (1) レッスン・コース情報から検索キーワードを自然文で提案し、ユーザーの承認後 `search_company_context` tool で検索する、(2) tool result の検索結果を markdown 表で提示し（列 `#` は表示用 `i`、select 呼び出しには tool result の `id` を使用）、ユーザーの自然言語選択意図を理解したうえで `select_company_context` tool を `{ ids: [...] }` で呼び出す、(3) `select_company_context` の tool result に item がある場合、Phase 3（盛り込み確認と草稿生成）に進む。0 件ヒット時は社内コンテキストダイアログからの登録を促さなければならない（SHALL）。**タグ候補の `[tag1, tag2]` 形式による検索フェーズは用いてはならない**（MUST NOT）。機械可読プロトコル行（`検索キーワード:` / `選択確定:` / `検索結果承認`）を出力してはならない（MUST NOT）。

#### Scenario: 検索結果を表で提示する

- **WHEN** `search_company_context` tool が 3 件を返す

- **THEN** AI は 3 件分の markdown 表と選択の指示をチャットで提示する

#### Scenario: ユーザーが番号で選択する

- **WHEN** AI が 3 件の表を提示した（各行に tool result の `i` と `id` が対応している）

- **AND** ユーザーが「1 と 3 で」と自然文で返信する

- **THEN** AI は `select_company_context` を `{ ids: [<i=1 の id>, <i=3 の id>] }` で呼び出す

#### Scenario: 再検索は tool 経由

- **WHEN** ユーザーが自然言語で再検索を依頼する

- **AND** AI が新キーワードを確認する

- **THEN** AI は `search_company_context` を新 query で呼び出す

#### Scenario: 0 件選択

- **WHEN** ユーザーが社内コンテキストを使わない旨を伝える

- **THEN** AI は `select_company_context` を `{ ids: [] }` で呼び出す

- **AND** 社内コンテキストなしでの生成確認を求める

#### Scenario: 0 件ヒット

- **WHEN** `search_company_context` が空配列を返す

- **THEN** AI は社内コンテキストの登録を促すメッセージを返す

- **AND** レッスン情報のみの草稿生成はユーザーの明示的承認後に行ってよい

#### Scenario: invoke 跨ぎで選択する

- **WHEN** 前のターンで search tool result が messages に保存されている

- **AND** ユーザーが別メッセージで「含めてください」等と返信する

- **THEN** AI は messages 内の search tool result から `id` を読み取り `select_company_context` を呼び出す

- **AND** 選択失敗として扱わない

### Requirement: 社内コンテキストの草稿への織り込み

`select_company_context` tool result に含まれる item を草稿に使わなければならない（SHALL）。`hasBody: true` の item は各 item の `body` をレッスン内の適切な箇所に配置しなければならない（SHALL）。`hasBody: false` の item は `body` を創作して引用してはならない（MUST NOT）。`hasBody: false` の item について、レッスン内容およびユーザー意図を踏まえ link-only で十分と判断した場合、タイトルと `url` のみを `> **{tag} ワンポイント**` 形式の blockquote で載せてよい（MAY）。search 段階（select 前）の tool result から URL を草稿に引用してはならない（MUST NOT）。プロジェクト固有タグ（例: `xyz`）の内容は `> **xyz ワンポイント**` 形式の blockquote 等で区別してよい（MAY）。

#### Scenario: 社内コンテキストを blockquote で反映

- **WHEN** `select_company_context` の tool result に `hasBody: true` の `xyz` タグアイテムが含まれる

- **AND** ユーザーが草稿生成を承認する

- **THEN** 応答 markdown に xyz 向けのワンポイント blockquote が含まれる

#### Scenario: link-only ワンポイント

- **WHEN** `select_company_context` の tool result に `hasBody: false` の item が含まれる

- **AND** ユーザーが参照を含める旨を明示した、または AI が link-only で十分と判断した

- **THEN** 応答 markdown にタイトルと url のみの blockquote が含まれる

- **AND** 原文にない body 内容は含まれない

#### Scenario: 未選択 item を織り込まない

- **WHEN** 検索結果に item id 10 と item id 20 がある

- **AND** `select_company_context` が `{ ids: [20] }` で実行された

- **THEN** 草稿に id 10 の `url` や本文が含まれない

