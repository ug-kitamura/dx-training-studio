# training-structure-skill Specification

## Purpose

現在のシリーズ/コース/レッスン構成を踏まえた改善提案を出力する `create-structure` Agent スキルの要件を規定する。

## Requirements

### Requirement: 構成作成スキルの存在
`create-structure` スキルが `dx-training-studio/.claude/skills/create-structure/SKILL.md` に存在しなければならない（SHALL）。現在のシリーズ/コース/レッスン構成を入力として受け取り、追加・改善提案を出力しなければならない（SHALL）。

#### Scenario: スキル一覧に表示される
- **WHEN** `/api/agent/skills` を呼び出す
- **THEN** `create-structure` スキルが一覧に含まれる

#### Scenario: 現在の構成を踏まえた提案を生成する
- **WHEN** ユーザーが create-structure スキルを呼び出し、variables に `seriesList`（現在の全構成 JSON）が渡される
- **THEN** AI がシリーズ/コース/レッスンの構成改善案をテキストで返す

### Requirement: Phase 1 はテキスト提案のみ
create-structure スキルの出力は Phase 1 ではテキスト提案に留め、UI 操作（シリーズ/コース/レッスンの自動追加）を行ってはならない（SHALL NOT）。

#### Scenario: 提案はチャットに表示されるのみ
- **WHEN** create-structure スキルが構成提案を生成する
- **THEN** 提案はチャット画面に表示され、ファイルシステムや UI state は自動変更されない
