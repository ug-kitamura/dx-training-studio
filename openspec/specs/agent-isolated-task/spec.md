# agent-isolated-task Specification

## Purpose
TBD - created by archiving change port-ebex-agent-core. Update Purpose after archive.
## Requirements
### Requirement: 独立コンテキストでのタスク実行

`run_isolated_task` は親の会話履歴を引き継がない独立したコンテキストでタスクを実行しなければならない（SHALL）。`path` 指定時は結果をサーバがファイルへ直接書き込み、tool_result には要約のみを残さなければならない（SHALL）。`path` 省略時は結果テキストを上限付きで tool_result として返さなければならない（SHALL）。`context_paths` で渡した材料の内容そのものを tool_result に戻してはならない（MUST NOT）。実行前にユーザー確認（agent-confirm-gate）が必要である（SHALL）。

#### Scenario: 結果をファイルへ直接書き込む
- **WHEN** `run_isolated_task` が `path` 付きで承認・実行される
- **THEN** 結果は当該パスへ書き込まれ、tool_result には要約のみが含まれる

#### Scenario: path 省略時は結果を返す
- **WHEN** `run_isolated_task` が `path` なしで承認・実行される
- **THEN** 結果テキストが上限付きで tool_result として返る

