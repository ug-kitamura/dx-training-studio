# agent-token-visibility Specification

## Purpose
TBD - created by archiving change port-ebex-agent-core. Update Purpose after archive.
## Requirements
### Requirement: トークン使用量の通知と表示

エージェントループはターンごとに `token_usage` SSE イベントで `outputTokens` を通知しなければならない（SHALL）。クライアントはセッション単位（複数 invoke をまたぐ）で累計し、ペイン4 に表示しなければならない（SHALL）。

#### Scenario: ターンごとに outputTokens が通知される
- **WHEN** invoke 内でモデルのターンが完了する
- **THEN** SSE に `token_usage` イベントが含まれ、`outputTokens` が数値で通知される

#### Scenario: セッション累計が表示される
- **WHEN** 同一セッションで複数回 invoke が実行される
- **THEN** ペイン4 の表示はセッション開始からの累計トークン数を示す

### Requirement: 診断ログへのターン記録

エージェントループはターンごとに診断レコード（model / stopReason / outputTokens / textChars / toolCallCount / continuations / nudges 等）を `workspace/.meta/diagnostics.log` に追記しなければならない（SHALL）。テスト実行時は実ログを汚染してはならない（MUST NOT）。

#### Scenario: ターン診断が追記される
- **WHEN** invoke でターンが完了する
- **THEN** diagnostics.log に当該ターンのレコードが 1 行追記される

