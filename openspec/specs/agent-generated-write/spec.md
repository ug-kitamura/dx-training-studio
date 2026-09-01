# agent-generated-write Specification

## Purpose
TBD - created by archiving change port-ebex-agent-core. Update Purpose after archive.
## Requirements
### Requirement: generate_and_write による生成書込

`generate_and_write` ツールは、サーバ内の別 LLM 呼び出しで成果物を生成しファイルへ直接書き込まなければならない（SHALL）。本文をツール引数に載せてはならない（MUST NOT）。`sections` 指定時は順に生成して連結しなければならない（SHALL）。各セクションの生成はモデルプロファイルの `generatePerSection` 上限まで max_tokens 自動継続されなければならない（SHALL）。`context_paths` のファイル内容を生成時の参照として渡さなければならない（SHALL）。

#### Scenario: 長文成果物のセクション分割生成
- **WHEN** `generate_and_write` が `sections: ["導入", "本編", "まとめ"]` 付きで承認・実行される
- **THEN** 3 セクションが順に生成・連結されてファイルに書き込まれ、tool_result に成功と書込パスが含まれる

#### Scenario: 子生成の通過袋
- **WHEN** 実行モデルのプロファイルに `providerParams.generate` がある
- **THEN** 子 LLM 呼び出しには generate スロットの値が渡される

### Requirement: marker による額縁差し込み

`marker` 指定時は、書込先ファイル内の当該区間のみを生成結果で置き換え、区間外（額縁）を保持しなければならない（SHALL）。

#### Scenario: 額縁テンプレートへの差し込み
- **WHEN** `path` に額縁テンプレート、`marker: "CONTENT"` を指定して実行される
- **THEN** `<!-- CONTENT_START -->` 〜 `<!-- CONTENT_END -->` 区間のみが置き換わり、額縁は変更されない

