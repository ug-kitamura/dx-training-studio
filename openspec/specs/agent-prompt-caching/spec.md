# agent-prompt-caching Specification

## Purpose
TBD - created by archiving change port-ebex-agent-core. Update Purpose after archive.
## Requirements
### Requirement: prompt caching の cache_control 付与

anthropic プロバイダは、system プロンプト・ツール定義の末尾・会話履歴の所定位置に `cache_control: { type: "ephemeral" }` を付与しなければならない（SHALL）。付与位置と方式は EBEX の実装と同一でなければならない（SHALL）。元の messages / tools 配列を破壊的に変更してはならない（MUST NOT）。

#### Scenario: system とツール定義に cache_control が付く
- **WHEN** ツール付き invoke で anthropic プロバイダがリクエストを組み立てる
- **THEN** system ブロックと末尾ツール定義に `cache_control` が含まれる

#### Scenario: 空 system は従来どおり
- **WHEN** system が空文字で呼ばれる
- **THEN** system は文字列のまま送られ、cache_control ブロック化されない

