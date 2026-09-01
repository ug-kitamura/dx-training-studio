# project-layout Specification

## Purpose
TBD - created by archiving change restructure-studio-mandala. Update Purpose after archive.
## Requirements
### Requirement: studio と mandala は兄弟で、正本はどちらの子でもない

プロジェクトの入れ物 `dx-training-studio/` の直下に、Studio アプリを `studio/`、公開サイトを `mandala/` として**兄弟**で配置しなければならない（SHALL）。一方のアプリが他方のアプリの `node_modules`・設定ファイルに依存してはならない（SHALL NOT）。

正本データ（`contents/` `images/` `contents-work/` `local-db/`）とプロジェクト共通ディレクトリ（`.claude/` `openspec/` `docs/` `contracts/`）は入れ物の直下に置き、どちらのアプリの子にも置いてはならない（SHALL NOT）。各アプリは正本を「兄弟の正本を読む」形（アプリから見て `../contents` 等）で参照しなければならない（SHALL）。

Studio の正本参照はプロジェクトルート解決の一点（`lib/project-root.ts` の `getProjectRoot()`）を経由しなければならない（SHALL）——正本の位置を変える際の変更箇所を一点に保つため。

#### Scenario: アプリと正本が兄弟に並ぶ

- **WHEN** 入れ物 `dx-training-studio/` の直下を一覧する
- **THEN** `studio/` と `mandala/` が兄弟として存在し、`contents/` `images/` `contents-work/` `local-db/` はどちらのアプリの配下にも存在しない

#### Scenario: Studio が兄弟の正本を読み書きする

- **WHEN** Studio（cwd = `studio/`）でレッスンを開いて保存する
- **THEN** 読み書きされるのは入れ物直下の `contents/` 配下のファイルである

#### Scenario: mandala が兄弟の正本を読む

- **WHEN** mandala の変換スクリプトを実行する
- **THEN** 入れ物直下の `contents/` と `images/` が読み取られ、変更されない

### Requirement: 入れ物に設定ファイルを置かない

入れ物 `dx-training-studio/` の直下に `package.json`・`node_modules`・ビルドツール設定（postcss / eslint / tsconfig 等）を置いてはならない（SHALL NOT）——置いた瞬間に親子構造（設定探索・モジュール解決の親方向フォールバック）が復活するため。入れ物直下に置いてよいのは、起動スクリプト・`.gitignore`・案内文書（`readme.md` `CLAUDE.md`）・正本データ・プロジェクト共通ディレクトリだけである。

#### Scenario: 入れ物に依存解決の足場が無い

- **WHEN** 入れ物 `dx-training-studio/` の直下を確認する
- **THEN** `package.json` と `node_modules` は存在しない
- **AND** `studio/` からのモジュール解決が入れ物側へフォールバックする経路が無い

### Requirement: 入れ物直下の起動スクリプト4本

入れ物直下に起動スクリプト4本を置かなければならない（SHALL）: `start-studio.bat` / `start-studio-dev.bat` / `start-mandala.bat` / `start-mandala-dev.bat`。各スクリプトは自身の位置（`%~dp0`）を基準に対象アプリのディレクトリへ移動してから実行しなければならない（SHALL）。

いずれも起動処理の前に**依存の整合性**を確認しなければならない（SHALL）。`node_modules` ディレクトリの有無だけを見てはならない（SHALL NOT）——「有るが壊れている」状態を素通りし、その先で真因と無関係なエラーを出すため。番人には `node_modules\.bin\next.cmd` を使う（SHALL）——両アプリの `dev` / `build` が実際に呼ぶ実行ファイルである。

番人が見つからない場合は `npm ci` で依存を入れ直さなければならない（SHALL）。`npm ci` が失敗した場合は `npm install` を試みてよい（MAY）。どちらも失敗した場合は、何が起きたかと次に何をすべきかが分かるメッセージを出して停止しなければならない（SHALL）。

**ブラウザを開くのは、対象のポートが応答するようになってからでなければならない**（SHALL）。サーバーの起動より前にブラウザを開いてはならない（MUST NOT）——立ち上がり途中のサーバーへ投げた API 要求は応答を得られず、取得側が失敗を空の結果として扱う経路では**画面が静かに空のまま留まる**（画像ビューで実際に発生した）。待機には**上限時間を設けなければならない**（SHALL）。上限に達した場合はブラウザを開かず、手動で開くための URL を示すメッセージを出さなければならない（SHALL）。ただしサーバーの起動処理自体を停止させてはならない（MUST NOT）。

- `start-studio-dev.bat`: Playwright Chromium の確認後、開発サーバー（port 3001）を起動する。既に稼働中ならブラウザを開くだけにする
- `start-studio.bat`: ビルド後に本番サーバー（port 3001）を起動する
- `start-mandala-dev.bat` / `start-mandala.bat`: 挙動は publishing-site-build の起動スクリプト要件に従う（ビルド先行）

#### Scenario: どのスクリプトも入れ物直下から起動できる

- **WHEN** 入れ物直下で `start-studio-dev.bat` を実行する
- **THEN** `studio/` に移動した上で開発サーバーが port 3001 で起動する

#### Scenario: サーバーが応答してからブラウザが開く

- **WHEN** サーバーが稼働していない状態で `start-studio-dev.bat` を実行する
- **THEN** port 3001 が応答するまでブラウザは開かれない
- **AND** 応答した後にブラウザが開く

#### Scenario: 待っても応答しないときは開かない

- **WHEN** サーバーが上限時間を過ぎても応答しない
- **THEN** ブラウザは開かれず、手動で開くための URL がメッセージに示される
- **AND** サーバーの起動処理は続いている

#### Scenario: 依存が無ければ先にインストールする

- **WHEN** `studio/node_modules` が無い状態で `start-studio-dev.bat` を実行する
- **THEN** 依存のインストールが実行されてから起動処理が続行される

#### Scenario: 依存が壊れていても素通りしない

- **WHEN** `studio/node_modules` は存在するが `node_modules\.bin` が失われた状態で `start-studio-dev.bat` を実行する
- **THEN** 依存の入れ直しが実行されてから起動処理が続行される
- **AND** `'playwright' は認識されていません` のような、真因と無関係なエラーで停止しない

### Requirement: Playwright の準備は起動を止めない

`start-studio-dev.bat` の Playwright Chromium の準備は、失敗しても起動処理を停止させてはならない（SHALL NOT）。失敗時は警告を出したうえで起動を続行しなければならない（SHALL）。

警告には、**影響が図の画像化機能に限られること**を含めなければならない（SHALL）——Playwright はアプリの起動には不要で、`lib/render-diagram-capture.mjs` だけが使う。

#### Scenario: Chromium の取得に失敗しても起動する

- **WHEN** ネットワークが使えない状態で `start-studio-dev.bat` を実行する
- **THEN** Playwright の準備は警告として報告される
- **AND** 開発サーバーは port 3001 で起動する

#### Scenario: 警告が影響範囲を伝える

- **WHEN** Playwright の準備が失敗する
- **THEN** メッセージに、使えなくなるのは図の画像化であることが書かれている

### Requirement: テストがアプリ境界を越えて読むファイルは読む側の型検査を単独で通る

一方のアプリのテストが他方のアプリのモジュールを import する場合、**引きずり込まれるファイル群は、読む側のアプリの `tsconfig.json` の設定だけで型検査が通らなければならない**（SHALL）。読む側で解決できない path alias（`@/*` 等）・拡張子付き import・生成物への依存を含むファイルを越境で読んではならない（SHALL NOT）。

テストランナーの alias（`vitest.config.ts` の `resolve.alias` 等）で解決を差し替えることを、越境の成立条件にしてはならない（SHALL NOT）——`tsc` と `next build` はその alias を読まないため、テストが緑でも本番ビルドが落ちる。

越境で読みたい実装が解決不能な依存を持つ場合は、**依存を持たない部分を独立したモジュールへ切り出し、そちらを読まなければならない**（SHALL）。

この制約は型レベルの越境にのみ適用される。アプリの実行時コードが他方のアプリへ依存してはならない（SHALL NOT）という既存の制約は変わらない。

#### Scenario: 越境先が生成物へ依存している

- **WHEN** Studio のテストが mandala のモジュールを import し、そのモジュールが Studio 側で解決できない生成物 JSON を import している
- **THEN** `studio/` で `npx tsc --noEmit` を実行すると、その解決不能な import が型エラーとして報告される
- **AND** この状態を `vitest.config.ts` の alias だけで解消してはならない

#### Scenario: 切り出したモジュールを越境で読む

- **WHEN** 越境で必要な関数と型だけを、生成物に依存しないモジュールへ切り出し、テストがそちらを import する
- **THEN** `studio/` で `npx tsc --noEmit` を実行しても、越境に起因する型エラーが出ない
- **AND** `studio/` で `npm run build` の型検査が通る

#### Scenario: 実行時依存は依然として禁止

- **WHEN** Studio の `app/` `lib/` `components/` 配下から mandala のモジュールへの import を検索する
- **THEN** 該当する import が 1 件も存在しない

### Requirement: 案内文書はペインを役割名で記述する

入れ物と Studio の案内文書（`readme.md` / `studio/readme.md`）は、ワークスペースのペインを**役割名**（ツリー／エディタ・メタ／Agent・画像）で記述しなければならない（SHALL）。読み手向けの説明にペイン番号（`Pane 3` / `Pane 4` / 「4ペイン」等）を使ってはならない（SHALL NOT）——画面は3ペインであり、コード上の `Pane4Shell` などの識別子は旧4ペイン構成の名残で画面の番号と対応しないためである。

コード上の識別子（`clampPaneWidth("pane4")` のような実際の API 文字列）を文書に引くときは、それが識別子であって画面の番号ではない旨を添えなければならない（SHALL）。

`contracts/` の実装契約文書は本要件の対象外とする（SHALL）——スキルが参照する既存の名前であり、改名の波及が大きい。ただし番号が旧構成の名残である旨の断り書きを持たなければならない（SHALL）。

#### Scenario: readme のペイン構成

- **WHEN** `studio/readme.md` のペイン構成の記述を読む
- **THEN** ペインは役割名で並び、`Pane 3` / `Pane 4` という番号呼びは無い

#### Scenario: 識別子を引くとき

- **WHEN** 文書がペイン幅の API に触れる
- **THEN** `"pane4"` はコード上の識別子であり画面の番号ではない旨が添えられている

#### Scenario: 契約文書は改名しない

- **WHEN** `contracts/agent-write-contract.md` を読む
- **THEN** 「ペイン4」の名前は維持されており、それが旧構成の名残である旨の断り書きがある
