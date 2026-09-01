# agent-model-profiles Specification

## Purpose
TBD - created by archiving change port-ebex-agent-core. Update Purpose after archive.
## Requirements
### Requirement: モデル別プロファイルの解決

`resolveModelProfile(model)` は、モデル slug ごとに `maxOutputTokens`・`continuations`（generatePerSection / textPerTurn / nudgeMax）・`providerParams`（agent / generate スロット）を返さなければならない（SHALL）。既知モデルの初期値は EBEX の `BASE_MODEL_PROFILES` と同値でなければならない（SHALL）。プロファイル未登録の未知モデルには保守側（締め）の既定 `nudgeMax: 2 / textPerTurn: 4 / generatePerSection: 4` を返さなければならない（SHALL）。

#### Scenario: 既知モデルのプロファイル解決
- **WHEN** `resolveModelProfile("claude-sonnet-5")` を呼ぶ
- **THEN** EBEX と同値のプロファイル（maxOutputTokens 64000、nudgeMax 2 等）が返る

#### Scenario: 未知モデルは締め側の既定
- **WHEN** `resolveModelProfile("some-future-model")` を呼ぶ
- **THEN** `continuations` は `{ generatePerSection: 4, textPerTurn: 4, nudgeMax: 2 }` である

### Requirement: 環境変数によるプロファイル上書き

環境変数 `DX_STUDIO_MODEL_PROFILES`（JSON 文字列）で slug 単位の部分上書き（deep merge）ができなければならない（SHALL）。JSON が不正な場合は警告の上で無視し、既定値で動作しなければならない（SHALL）。

#### Scenario: 部分上書きが反映される
- **WHEN** `DX_STUDIO_MODEL_PROFILES={"gpt-5-nano":{"continuations":{"nudgeMax":15}}}` が設定されている
- **THEN** `resolveModelProfile("gpt-5-nano")` の nudgeMax は 15、他の値は既定のままである

#### Scenario: 不正 JSON は無視される
- **WHEN** `DX_STUDIO_MODEL_PROFILES` に不正な JSON が設定されている
- **THEN** 警告ログの上で既定プロファイルが返る

### Requirement: providerParams の通過袋

`providerParams` はプロバイダへ無解釈で渡されなければならない（SHALL）。プロバイダは未対応キーを黙って無視しなければならない（SHALL）。anthropic プロバイダは現状すべてのキーを無視する。

#### Scenario: anthropic は通過袋を無視する
- **WHEN** プロファイルに `providerParams.agent: { reasoning_effort: "medium" }` があるモデルで anthropic プロバイダが呼ばれる
- **THEN** リクエストにエラーは発生せず、当該キーは API リクエストに含まれない

