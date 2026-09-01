# agent-web-search Specification

## Purpose
TBD - created by archiving change port-ebex-agent-core. Update Purpose after archive.
## Requirements
### Requirement: 検索プロバイダ解決と人手フォールバック

`web_search` は検索プロバイダの利用可否を解決しなければならない（SHALL）。プロバイダ利用不可（キー未設定等）の場合、人手フォールバックの確認（`web-search-manual`）を要求しなければならない（SHALL）。承認かつ結果テキストありの場合は `source: "user-provided"` の検索結果としてモデルへ返さなければならない（SHALL）。拒否またはタイムアウトの場合はスキップとしてガイダンス付きで返し、エージェントループを継続しなければならない（SHALL）。

#### Scenario: キー未設定で人手フォールバックが発動する
- **WHEN** 検索キー未設定の環境で `web_search` が呼ばれる
- **THEN** 人手入力を求める確認要求が SSE で送出される

#### Scenario: ユーザーが検索結果を貼り付ける
- **WHEN** 人手フォールバックの確認でユーザーが結果テキストを入力して承認する
- **THEN** tool_result に `source: "user-provided"` として当該テキストが含まれる

#### Scenario: スキップしても続行する
- **WHEN** 人手フォールバックの確認が拒否される
- **THEN** tool_result はスキップ扱い（unavailable / skipped）となり、エージェントは検索なしで作業を継続する

