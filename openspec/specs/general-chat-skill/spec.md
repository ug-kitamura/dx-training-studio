# general-chat-skill Specification

## Purpose

スキル未選択時に暗黙利用される `general-chat` Agent スキルの存在・入出力・役割を規定する。

## Requirements

### Requirement: general-chat スキルの存在

`general-chat` スキルが `dx-training-studio/.claude/skills/general-chat/SKILL.md` に存在しなければならない（SHALL）。frontmatter に `hidden: true` を含め、`/` オートコンプリートには表示してはならない（MUST NOT）。frontmatter `tools` には `search_company_context` と `select_company_context` を含めなければならない（SHALL）。必須 `variables` は宣言してはならない（MUST NOT）。

#### Scenario: invoke で general-chat を読み込める

- **WHEN** `skillId: "general-chat"` で invoke を呼ぶ
- **THEN** スキルが正常に読み込まれ、ストリーミング応答が返される

#### Scenario: / メニューに表示されない

- **WHEN** ユーザーがチャット入力欄で `/` を入力する
- **THEN** `general-chat` は候補リストに含まれない

### Requirement: general-chat の役割

`general-chat` スキルは、DX Training Studio の教材制作における壁打ち・汎用相談を目的としなければならない（SHALL）。社内コンテキスト検索 tool を必要に応じて利用できなければならない（SHALL）。企画・構成の深掘りは `dx-training-plan` の、レッスン草稿の執筆は `dx-training-create` の利用を案内しなければならない（SHALL）。

#### Scenario: 社内コンテキスト検索 tool が利用可能

- **WHEN** `general-chat` で invoke が実行される
- **THEN** `search_company_context` および `select_company_context` tool が LLM に提供される

#### Scenario: 企画・構成の相談は dx-training-plan を案内する

- **WHEN** ユーザーが `general-chat` でシリーズ・コース・レッスンの構成や企画について相談する
- **THEN** 応答は `dx-training-plan` スキルの利用を案内する

#### Scenario: 草稿執筆の相談は dx-training-create を案内する

- **WHEN** ユーザーが `general-chat` でレッスン本文の執筆について相談する
- **THEN** 応答は `dx-training-create` スキルの利用を案内する
