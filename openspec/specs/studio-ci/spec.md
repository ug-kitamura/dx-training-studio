# studio-ci Specification

## Purpose

Studio の継続的検証。何を・どの契機で・どの順で検証するか、および意図的に検証しないものとその理由を定める。デプロイは扱わない。
## Requirements
### Requirement: Studio は pull request で検証される

Studio の変更は、main へ入る前に GitHub Actions で検証されなければならない（SHALL）。ワークフローは `.github/workflows/dx-training-studio-ci.yml` に置く（SHALL）。

発火の契機は `pull_request` と main への `push` の 2 つとする（SHALL）。`push` は必ずブランチを main に絞らなければならない（SHALL）——絞らずに `pull_request` と併用すると、PR が開いているブランチへの push で同じ検証が二重に走る。

デプロイを行ってはならない（SHALL NOT）。必要な権限は `contents: read` のみとする（SHALL）。

#### Scenario: PR で検証が走る

- **WHEN** `studio/` 配下を変更した pull request を開く
- **THEN** Studio の CI が発火する

#### Scenario: 二重発火しない

- **WHEN** pull request が開いている作業ブランチへ push する
- **THEN** 発火するのは `pull_request` の 1 回だけで、`push` では発火しない

### Requirement: 検証は型・ビルド・テストの3段で行い、型検査を先に置く

CI は次の 4 つをこの順で実行しなければならない（SHALL）。

1. `npx next typegen`
2. `npx tsc --noEmit`
3. `npm run build`
4. `npx vitest run`

`tsc --noEmit` を `npm run build` より先に置かなければならない（SHALL）——`next build` の型検査は最初の 1 件しか報告せず、かつ `__tests__` の診断を捨てるため、失敗時に全体像が出る `tsc --noEmit` を先に走らせる。

`tsc --noEmit` の前に **`npx next typegen` を走らせなければならない**（SHALL）。`next-env.d.ts` と `.next/types/` は Next が生成するもので `.gitignore` の対象であり、クリーンなチェックアウトには存在しない。画像 import の型（`*.png` 等）を宣言しているのは `next-env.d.ts` の `/// <reference types="next/image-types/global" />` なので、生成せずに `tsc` を走らせると解決不能な import として落ちる。`next typegen` は `next build` を走らせずにこれらを生成する。

**gitignore された生成物の存在を暗黙の前提にしてはならない（SHALL NOT）。** 必要な生成物は CI の中で明示的に作ること——手元には過去の実行が残した生成物があるため、この種の依存はローカル検証では検出できない。

`npm run build` を省いてはならない（SHALL NOT）——Vercel の本番ビルドが再現する唯一の段である。`next typegen` はその代替にならない（コンパイル・ルート収集・静的生成を行わない）。

#### Scenario: 型エラーで落ちる

- **WHEN** `__tests__/` 配下に型エラーを含む pull request を開く
- **THEN** `tsc --noEmit` の段で CI が失敗する

#### Scenario: 失敗時に全件が出る

- **WHEN** 型エラーが複数ある状態で CI が失敗する
- **THEN** ログに 1 件だけでなく全件が出力される

#### Scenario: クリーンなチェックアウトで型検査が成立する

- **WHEN** `next-env.d.ts` と `.next/` が存在しない状態から CI が走る
- **THEN** `next typegen` がそれらを生成し、`tsc --noEmit` が画像 import を解決できる
- **AND** `Cannot find module './supergraphic.png'` のような、生成物の欠落に起因するエラーが出ない

### Requirement: 境界を越えて読まれるファイルの変更でも発火する

`paths` フィルタには、Studio 自身に加えて **Studio が境界を越えて読むもの**と **Studio がビルド時に取り込むもの**を含めなければならない（SHALL）。パスは単独リポジトリの構造（`studio/` `mandala/` `contents/` がリポジトリ直下）を前提とし、旧モノレポの `dx-training-studio/` プレフィックスを付けてはならない（MUST NOT）——一致しない `paths` はワークフローを**発火させないだけで赤にもしない**ため、壊れに気づけない。

- `studio/**`
- `mandala/lib/**` — parity テストが `mandala/lib/site-labels.ts` を読むため
- `contents/**` — デモが正本をビルド時に静的ペイロードへ焼き込むため
- ワークフロー自身のファイル

#### Scenario: mandala の語彙変更で Studio の CI が発火する

- **WHEN** `mandala/lib/site-labels.ts` だけを変更した pull request を開く
- **THEN** Studio の CI が発火し、parity テストが語彙のずれを検出する

#### Scenario: paths がリポジトリ構造と一致している

- **WHEN** `paths` フィルタの各パターンをリポジトリの実ディレクトリと突き合わせる
- **THEN** すべてのパターンが実在するディレクトリ・ファイルに対応している

### Requirement: lint と整形検査は当面 CI に含めない

`npm run lint` と `npm run format:check` を CI に含めてはならない（SHALL NOT）——現時点で lint には未修正のエラーが残っており、整形の状態は Windows の CRLF ワーキングツリーでは手元で検証できないため、いずれも初日から red になる恐れがある。

これは恒久的な除外ではない（MAY）。負債を解消し、CI 上で緑になることを確かめたうえで段階的に追加してよい。除外している理由はワークフローのコメントに残さなければならない（SHALL）——理由の書かれていない除外は、次に読む人が「入れ忘れ」と誤読する。

#### Scenario: 除外の理由が読める

- **WHEN** `.github/workflows/dx-training-studio-ci.yml` を読む
- **THEN** lint と整形検査を入れていない理由がコメントとして書かれている

### Requirement: テストは CI の実行環境でも通る

テストは開発機（Windows）と CI の実行環境（`ubuntu-latest`）の**両方**で通らなければならない（SHALL）。片方でしか通らないテストを置いてはならない（SHALL NOT）。

パス区切り・ドライブレター・改行コードなど、OS 固有の前提をテストに埋め込んではならない（SHALL NOT）。パスの組み立てには `path.join` / `path.resolve` を使わなければならない（SHALL）。

**生成するコードや設定にパスを埋め込む場合は、手書きの escape を行ってはならない（SHALL NOT）。** `JSON.stringify` を使い、文字列リテラルとしての escape を処理系に委ねなければならない（SHALL）——`replace(/\\/g, "\\\\")` のような手書きの置換は、バックスラッシュを含まないパスでは空振りし、**片方の OS でだけ壊れる**。

期待値が「失敗すること」であるテストは、**失敗の理由が意図したものであること**まで確認しなければならない（SHALL）。パスが壊れて存在しないために失敗しているのか、検証対象の仕組みが正しく拒んだのかを取り違えると、テストは通ったまま空洞になる。

#### Scenario: パスの埋め込みが両 OS で成立する

- **WHEN** テストが一時ディレクトリのパスを、実行対象のコード文字列へ埋め込む
- **THEN** Windows でも Linux でも、埋め込まれたパスが実在するファイルを指す

#### Scenario: CI がプラットフォーム固有の前提を検出する

- **WHEN** Windows でしか通らないテストを含む pull request を開く
- **THEN** `ubuntu-latest` 上の `npx vitest run` が失敗する

#### Scenario: 失敗を期待するテストが理由まで見る

- **WHEN** サンドボックスが書き込みを拒むことを検証する
- **THEN** 拒否されたことが確認でき、パスの不備で失敗しているのではないことが区別できる

### Requirement: 条件付きスキップは条件を正しく反映する

テストを環境条件でスキップする場合、その条件が**実際に評価されること**を保証しなければならない（SHALL）。条件の書き方を誤って常時スキップになる状態を残してはならない（SHALL NOT）——テストが存在するのに一度も走らない状態は、緑を信用できなくする。

`describe.skipIf` / `it.skipIf` に**関数を渡してはならない**（SHALL NOT）——引数は真偽値として評価されるため、関数オブジェクトは常に truthy となり無条件スキップになる。

`describe.skipIf` の条件は**収集時に確定していなければならない**（SHALL）。`beforeAll` などのフックで代入した値を条件に使ってはならない（SHALL NOT）——フックは収集より後に走るため、条件は初期値のまま評価される。非同期に判定する必要がある場合は、トップレベル `await` でモジュール評価時に確定させること（SHALL）。

条件付きスキップを導入する際は、**その条件が満たされる環境で実際に走ることを確認しなければならない**（SHALL）。

**到達できない条件でスキップされ続けるテストを残してはならない（SHALL NOT）。** 条件がどの環境でも満たされないなら、それはテストではなく死んだコードである。git 管理外のファイルや、リポジトリに存在しないパスを条件にしてはならない（SHALL NOT）——CI でも手元でも到達できず、永久にスキップされる。

そのようなテストを見つけた場合は、**フィクスチャを追跡対象として用意するか、削除するかを選ばなければならない**（SHALL）。スキップされたまま残してはならない（SHALL NOT）。削除する場合は、失われる検証が他でカバーされているか、守るべき不具合の形が既に構造的に消えているかを確認しなければならない（SHALL）。

#### Scenario: 条件が満たされる環境では実行される

- **WHEN** スキップ条件が満たされない環境（依存が導入済み）でテストを実行する
- **THEN** 対象のテストが実行され、スキップされない

#### Scenario: 条件が満たされない環境ではスキップされる

- **WHEN** スキップ条件が満たされる環境（依存が未導入）でテストを実行する
- **THEN** 対象のテストがスキップされ、失敗としては扱われない

#### Scenario: 常時スキップになっていないことを確認する

- **WHEN** 条件付きスキップを新たに書く、または既存のものを変更する
- **THEN** 条件が満たされる環境で実行し、スキップ数が期待どおりであることを確認する

#### Scenario: 到達できないフィクスチャを条件にしない

- **WHEN** テストがフィクスチャの存在を条件にスキップする
- **THEN** そのフィクスチャは git の追跡対象であり、クリーンなチェックアウトで存在する

