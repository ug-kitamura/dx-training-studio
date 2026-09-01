# agent-script-runtime Specification

## Purpose
TBD - created by archiving change port-ebex-agent-core. Update Purpose after archive.
## Requirements
### Requirement: サンドボックスでのスクリプト実行

`run_script`（モデルが書く CommonJS）および `run_skill_script`（スキル同梱 `scripts/` 配下）はサンドボックスで実行されなければならない（SHALL）。fs 読取はプロジェクトと実行中スキルに、書込はプロジェクト内（書込 2 ルート境界に従う）に限定されなければならない（SHALL）。ネットワークアクセスは禁止されなければならない（SHALL）。実行前にユーザー確認（agent-confirm-gate）が必要である（SHALL）。

#### Scenario: スキル同梱スクリプトの実行
- **WHEN** `run_skill_script` が `scripts/build-html.cjs` を対象に承認・実行される
- **THEN** スクリプトがサンドボックスで実行され、生成物がプロジェクト内に書き込まれる

#### Scenario: ネットワークアクセスの禁止
- **WHEN** スクリプトが http リクエストを試みる
- **THEN** 実行はエラーとなり、tool_result にエラー情報が返る

### Requirement: 確認前の事前検査

スクリプト系ツールは確認ダイアログより先に事前検査（構文エラー・スクリプト不存在等）を行わなければならない（SHALL）。事前検査に失敗した呼び出しについて、ユーザーへ承認を求めてはならない（MUST NOT）。

#### Scenario: 構文エラーは承認前に弾かれる
- **WHEN** `run_script` の code に構文エラーがある
- **THEN** 確認ダイアログは表示されず、エラーと修正ガイダンスが tool_result としてモデルへ返る

### Requirement: 入力ゆらぎの正規化救済

スクリプト系ツール呼び出しの入力ゆらぎ（code の別名キー、`run_script` / `run_skill_script` の取り違え）は実行前に正規化されなければならない（SHALL）。

#### Scenario: ツール名の取り違えを救済する
- **WHEN** モデルが `run_script` に `script_path` のみを渡す
- **THEN** `run_skill_script` の呼び出しとして正規化され実行フローに乗る

