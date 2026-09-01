# publishing-site-intranet Specification

## Purpose
TBD - created by archiving change repo-split-deploy-paths. Update Purpose after archive.
## Requirements
### Requirement: 社内ホスティング配信ワークフローを1ファイルで用意する

社内ホスティングサービス（SMB 共有に置いたものが `https://…/doku/ccdx/dx-training-mandala/` で配信される仕組み）への配信は、**1つのワークフローファイル** `.github/workflows/dx-training-mandala-release-intranet.yml` で行わなければならない（SHALL）。配信方式ごとにファイルを分けてはならない（MUST NOT）——リリース用ワークフローが増えるほど必ず片方が腐る（`docs/grill-me/grill-me-20260828.md` の決定）。

ワークフローは **build ジョブと deploy ジョブに分離**しなければならない（SHALL）:

- **build ジョブ（`ubuntu-latest`）**: `NEXT_PUBLIC_BASE_PATH=/doku/ccdx/dx-training-mandala` でビルドし、`out/` を artifact としてアップロードする。ビルドは常に Linux で行わなければならない（SHALL）——Windows ビルド固有のセグメント問題の領域に入らないため
- **deploy ジョブ 2 本**: ①`deploy-rclone`（`ubuntu-latest` + rclone の SMB バックエンド、`--delete-after` で同期）②`deploy-robocopy`（self-hosted Windows ランナー + robocopy、終了コード 8 未満を成功へ変換）。どちらも build ジョブの artifact を取得してコピーする（SHALL）——両方式の違いを「artifact をどう運ぶか」だけに閉じる

方式の選択は `workflow_dispatch` の `method` 入力（`rclone` / `robocopy` の choice）で行い、選択された方式の deploy ジョブだけが実行対象になる構成でなければならない（SHALL）。

本番契機（`v*` タグ push・main 所属検証つき）はワークフロー内に**コメントアウトの形で**記述しておかなければならない（SHALL）——GHES 移行後の有効化がコメント解除で済むようにするため。

#### Scenario: ビルドは方式によらず同一である

- **WHEN** `rclone` 方式と `robocopy` 方式のどちらを選んで実行しても
- **THEN** build ジョブは同一の定義・同一の環境変数で実行され、deploy ジョブだけが異なる

#### Scenario: 方式を選択して実行する

- **WHEN** （有効化後）`workflow_dispatch` で `method: rclone` を選んで実行する
- **THEN** `deploy-rclone` だけが実行され、`deploy-robocopy` は実行されない

### Requirement: GHES 移行までワークフローは実行されない

このワークフローは github.com 上では**実行されてはならない**（MUST NOT）。不活性化は次の三重で行う（SHALL）:

1. タグ契機（`push: tags: v*`）のコメントアウト
2. 各ジョブの `if:` 条件による不活性ガード（`workflow_dispatch` による手動実行でもジョブが走らない）
3. 実行環境の不在（SMB secret・self-hosted ランナーを github.com 側に置かない）

ワークフロー冒頭のコメントに、**不活性であること・その理由（GHES 移行前・社内 secret を github.com に置かない）・有効化の手順**を明記しなければならない（SHALL）——`if: false` によるスキップ表示を壊れと誤読させないため。

社内 secret（SMB 資格情報）・実ホスト名・UNC パスを github.com のリポジトリおよび Secrets に置いてはならない（MUST NOT）。ホスト名・共有名はプレースホルダとし、GHES 移行時に実値化する箇所であることをコメントで示さなければならない（SHALL）。配信 URL のパス部分（`/doku/ccdx/dx-training-mandala`）は秘匿対象ではなく、ビルドに必須のため実値で記述する（SHALL）。

#### Scenario: 手動実行しても deploy されない

- **WHEN** github.com 上で `workflow_dispatch` からこのワークフローを実行する
- **THEN** ジョブは不活性ガードによりスキップされ、どこにもデプロイされない

#### Scenario: 不活性の理由が読める

- **WHEN** ワークフローファイルを開く
- **THEN** 冒頭コメントに不活性であること・理由・有効化手順が書かれている

#### Scenario: 秘密情報が含まれない

- **WHEN** ワークフローファイルとリポジトリの Secrets を確認する
- **THEN** SMB 資格情報・実ホスト名・UNC パスは含まれず、プレースホルダと参照コメントだけがある

### Requirement: デプロイの安全策を方式ごとに実装する

**rclone 方式**は次を満たさなければならない（SHALL）:

- 資格情報は環境変数（`RCLONE_SMB_HOST` / `RCLONE_SMB_DOMAIN` / `RCLONE_SMB_USER` / `RCLONE_SMB_PASS`）で渡す。コマンドライン引数で渡してはならない（MUST NOT）——同一ランナー上の他ジョブからプロセス一覧で見えるため
- 同期は `rclone sync --delete-after` を使う——新ファイルの転送完了後に不要ファイルを消す順序で、コピー途中に壊れたページを踏む窓を最小化する
- 宛先ホストは DFS 名前空間ではなく実ホスト名を直書きし、**なぜ迂回しているか・ファイルサーバー移設時に更新が要ること**をコメントで残す（SHALL）

**robocopy 方式**は次を満たさなければならない（SHALL）:

- robocopy の終了コードを明示的に変換する（8 未満は成功）——素で呼ぶと成功時にもワークフローが赤になる
- `/MIR` を一発で当ててはならない（MUST NOT）——先に削除が走り、コピー途中の閲覧者が壊れた状態を踏む。`_next` → HTML → 古い資産の削除、の順序にする

#### Scenario: rclone の資格情報がプロセス一覧に出ない

- **WHEN** （有効化後）rclone 方式の deploy が実行される
- **THEN** rclone のコマンドラインに資格情報は含まれず、環境変数だけで渡される

#### Scenario: robocopy の正常終了が成功として扱われる

- **WHEN** （有効化後）robocopy がファイルをコピーして終了コード 1 を返す
- **THEN** deploy ジョブは成功として扱われる

