# agent-skill-loader Specification

## Purpose

`.claude/skills/` 配下の Agent スキル定義を読み込み、一覧 API・Cursor 互換形式・変数注入の要件を規定する。
## Requirements
### Requirement: スキルディレクトリからの読み込み
`dx-training-studio/.claude/skills/` 配下のスキル定義（`SKILL.md`）を読み込んで一覧取得できなければならない（SHALL）。各スキルは `id`（ディレクトリ名）・`name`・`description` を返さなければならない（SHALL）。

#### Scenario: SKILL.md から id・name・description を読み込む
- **WHEN** `.claude/skills/create-draft/SKILL.md` が存在する
- **THEN** `/api/agent/skills` の応答に id `create-draft` と frontmatter の name・description が含まれる

### Requirement: スキル一覧のソート
スキル一覧 API は skill id（ディレクトリ名）のアルファベット順でスキルを返さなければならない（SHALL）。

#### Scenario: アルファベット順で返す
- **WHEN** `/api/agent/skills` を呼び出す
- **THEN** 応答の skills 配列は skill id のアルファベット順である

#### Scenario: スキル一覧を取得する
- **WHEN** `/api/agent/skills` を呼び出す
- **THEN** 登録済みスキルの id・name・description のリストが返される

#### Scenario: スキルディレクトリが空
- **WHEN** `.claude/skills/` にスキルが存在しない
- **THEN** 空の配列が返され、HTTP ステータスは 200 である

### Requirement: Cursor 互換形式
各スキルは `<skill-id>/SKILL.md` 形式で配置され、YAML frontmatter に `name` と `description` を含まなければならない（SHALL）。Cursor / Claude Code から直接参照可能でなければならない（SHALL）。

#### Scenario: SKILL.md の frontmatter を解析する
- **WHEN** `create-draft/SKILL.md` に name と description が frontmatter で定義されている
- **THEN** スキル一覧 API の応答にその name と description が含まれる

### Requirement: 変数定義

スキル frontmatter の `variables` 配列で宣言された変数を、実行時に SKILL.md 本文へ注入できなければならない（SHALL）。`create-draft` スキルは `lessonMeta` および `availableTags` を variables に宣言しなければならない（SHALL）。`create-draft` は `contextItems` を variables に宣言してはならない（MUST NOT）。

#### Scenario: 変数を注入してプロンプトを構築する

- **WHEN** スキル frontmatter に `variables: [series, course, lesson]` が定義され、invoke リクエストにそれらの値が含まれる

- **THEN** SKILL.md 本文内の `{{series}}` 等のプレースホルダが置換されたプロンプトが生成される

#### Scenario: create-draft の lessonMeta を注入する

- **WHEN** `create-draft` の invoke に `variables.lessonMeta` が JSON 文字列として渡される

- **THEN** SKILL.md 本文内の `{{lessonMeta}}` が当該 JSON に置換される

### Requirement: tools frontmatter の解析

スキル frontmatter の `tools:` 配列を解析し、invoke route に tool 名リストを提供できなければならない（SHALL）。`tools` 未指定のスキルは空配列として扱わなければならない（SHALL）。

#### Scenario: create-draft の tools を読み込む

- **WHEN** `create-draft/SKILL.md` の frontmatter に `tools: [search_company_context, select_company_context]` が定義されている

- **THEN** loadSkill の結果に `tools: ["search_company_context", "select_company_context"]` が含まれる

### Requirement: hidden スキルの frontmatter 解析

スキル frontmatter の `hidden: true` を解析できなければならない（SHALL）。`hidden` が true のスキルは `loadSkill` で読み込めるが、スキル一覧 API（`/api/agent/skills`）および `/` オートコンプリート候補からは除外されなければならない（SHALL）。`hidden` 未指定または false のスキルは従来どおり一覧に含まれなければならない（SHALL）。

#### Scenario: hidden スキルを loadSkill で読み込める

- **WHEN** `general-chat/SKILL.md` に `hidden: true` が frontmatter で定義されている
- **THEN** `loadSkill(projectRoot, "general-chat")` は非 null を返す

#### Scenario: hidden スキルが一覧 API に含まれない

- **WHEN** `/api/agent/skills` を呼び出す
- **AND** `general-chat` スキルが `hidden: true` で存在する
- **THEN** 応答の skills 配列に `general-chat` は含まれない

#### Scenario: hidden 以外のスキルは一覧に含まれる

- **WHEN** `/api/agent/skills` を呼び出す
- **THEN** `create-draft` 等 `hidden` 未指定のスキルは従来どおり含まれる

### Requirement: scripts/ 同梱の検出とスキルディレクトリの提供

スキル読み込みは、スキルディレクトリに `scripts/` が同梱されているかを検出できなければならない（SHALL）。`run_skill_script` のツール定義は、実行中スキルに `scripts/` が存在する場合にのみ解決されなければならない（SHALL）。invoke route はツール実行のためにスキルディレクトリの絶対パス（`skillDirAbsolute`）をエージェントループへ提供しなければならない（SHALL）。

#### Scenario: scripts/ 同梱スキルで run_skill_script が有効になる

- **WHEN** `tools: [run_skill_script]` を宣言し `scripts/` を同梱するスキルが invoke される

- **THEN** ツール定義に `run_skill_script` が含まれる

#### Scenario: scripts/ なしのスキルでは解決されない

- **WHEN** `scripts/` を持たないスキルが `run_skill_script` を宣言して invoke される

- **THEN** ツール定義に `run_skill_script` は含まれない

