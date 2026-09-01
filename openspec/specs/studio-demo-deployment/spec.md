# studio-demo-deployment Specification

## Purpose

Studio を社内デモとして Vercel へ配るための前提を規定する。公開サイト（`mandala/`）の配信は `publishing-site-deployment` が担い、本仕様は Studio 本体だけを対象とする。
## Requirements
### Requirement: Studio は読み取り専用の社内デモとして配る

Vercel 上の Studio は、社内に画面を見せるための**読み取り専用のデモ**として配らなければならない（SHALL）。デプロイ先の実行環境はファイルシステムが読み取り専用かつ使い捨てであるため、**書き込み系 API（保存・追加・削除・並び替え・Agent の書き込み）が失敗することは許容された仕様**である。この失敗を理由に正本の保存経路を変更してはならない（MUST NOT）——Studio の編集はローカル起動が担う。

#### Scenario: デモでレッスンを閲覧する

- **WHEN** デプロイされた Studio を開く
- **THEN** シリーズ・コース・レッスンのツリーとレッスン本文が表示される

#### Scenario: デモで保存を試みる

- **WHEN** デプロイされた Studio で保存操作を行う
- **THEN** 書き込みは失敗する
- **AND** それは既知かつ許容された挙動であり、ビルドやデプロイの不具合として扱わない

### Requirement: 正本はビルド時に焼き込む

Studio のデモ配信において、**正本 `contents/` はビルド時に読み込んで静的ペイロードへ焼き込まなければならない**（SHALL）。閲覧のためにランタイムのファイルシステムへ依存してはならない（MUST NOT）——`outputFileTracing` は動的に組み立てたパスの読み込みを追跡できず、正本はサーバーレス関数へ同梱されないため。

正本画像は例外とし、**`outputFileTracingIncludes` で明示同梱してランタイムのファイルシステムから配信**しなければならない（SHALL）。ストレージバックエンド（Vercel Blob 等）をデモ配信の前提にしてはならない（MUST NOT）——会社環境ではストレージを使えず、画面を見せるためだけに外部ストレージを運用する理由がないため。

#### Scenario: ランタイムのファイルシステムに正本が無い

- **WHEN** デプロイ先で正本 `contents/` がファイルシステム上に存在しない
- **THEN** ビルド時に焼き込まれた内容でツリーと本文が表示される

#### Scenario: 画像を表示する

- **WHEN** レッスン本文に画像が含まれる
- **AND** 画像ストレージの設定が `local` である
- **THEN** 画像は関数へ同梱された正本ファイルから配信される

### Requirement: 正本画像をサーバーレス関数へ明示同梱する

Studio のデモ配信において、正本画像（`images/<filename>`）は **`outputFileTracingIncludes` で全ルートへ明示同梱しなければならない**（SHALL）。Root Directory の外にあるファイルが暗黙に関数へ含まれることに依存してはならない（MUST NOT）——切り出し前のデプロイはこの暗黙の同梱に乗っており、リポジトリ構成が変わった瞬間に無言で表示が壊れた。

同梱対象の拡張子は `lib/image-store.ts` の `MIME_BY_EXT` のうち `image/*` に対応するものとしなければならない（SHALL）。動画（`mp4` 等）は `.gitignore` が正本から除外しているため含めてはならない（MUST NOT）。

`outputFileTracingIncludes` の glob は Next が統合したルート（`outputFileTracingRoot` と `turbopack.root` を同一視した値）の内側に収まらなければならない（SHALL）。そのため両者へ**同じ値**を設定しなければならない（SHALL）——異なる値を与えると Next が警告のうえ一方を捨て、ローカルと Vercel でルートが食い違う。

#### Scenario: デプロイ先で正本画像を取得する

- **WHEN** デプロイされた Studio が `GET /api/images/file?path=images/<name>&storageMode=local` を受ける
- **THEN** 関数へ同梱された実体が 200 で返る

#### Scenario: デプロイ先で正本画像を一覧する

- **WHEN** デプロイされた Studio が `GET /api/images/list?scope=used&storageMode=local` を受ける
- **THEN** 正本画像の一覧が返り、本文から参照されていない画像も含まれる

#### Scenario: ビルド成果物に同梱されたかを確認する

- **WHEN** `npm run build` が完了する
- **THEN** `.next/server/app/api/images/file/route.js.nft.json` の `files` に正本画像が並ぶ

#### Scenario: 2 つのルート設定が食い違う

- **WHEN** `outputFileTracingRoot` と `turbopack.root` に異なる値が設定されている
- **THEN** ビルドは警告を出し、片方の設定は無視される
- **AND** それは是正すべき設定ミスであり、放置してはならない

### Requirement: Root Directory の外にある正本を読める設定を維持する

正本 `contents/` は Studio アプリの Root Directory の**外**（入れ物直下の兄弟）にあるため、Vercel プロジェクトの **`Include files outside the root directory` は Enabled を維持しなければならない**（SHALL）。これを無効化してはならない（MUST NOT）。

⚠ 無効化するとビルドコンテナに正本が存在しなくなるが、`loadContentsFolder` と `reconcileOrderFiles` は正本が無いとき**黙って空を返す**ため、**ビルドは成功し、中身が空のデモが配信される**。エラーが出ないことがこの設定変更の危険性である。

#### Scenario: 設定を無効化した場合

- **WHEN** `Include files outside the root directory` を無効にしてデプロイする
- **THEN** ビルドは失敗しなければならない（→ 次の要件のビルド時検査による）
- **AND** 中身が空のデモを成功として配信してはならない

### Requirement: 前提が崩れたビルドを成功させない

Vercel 上のビルドは、開始前に**デモ配信の前提が成立していることを検査し、成立しない場合は失敗しなければならない**（SHALL）。検査対象は次の2点である。

1. アプリから見た正本 `contents/` がビルド時に解決できること
2. ビルド生成物の回収基準となるソースルートの前提が成立していること

検査は **Vercel 上でのみ実行しなければならない**（SHALL）。ローカルのビルドはこの検査で失敗してはならない（MUST NOT）——正本が空の状態でも起動できる現在の挙動は、初回セットアップのために維持する。

失敗時は、**何の前提が崩れたのかを名指しするメッセージを出さなければならない**（SHALL）——ビルダー内部の `ENOENT` を人が解読し直す事態を避けるため。

#### Scenario: 正本が見えないままビルドする

- **WHEN** Vercel 上で正本 `contents/` を解決できない状態でビルドが始まる
- **THEN** ビルドは失敗する
- **AND** 正本が見つからないことを示すメッセージが出る

#### Scenario: ソースルートの前提が崩れる

- **WHEN** Vercel 上でソースルートの前提が成立しない
- **THEN** ビルドは失敗する
- **AND** 前提が崩れたことを示すメッセージが出る

#### Scenario: ローカルでビルドする

- **WHEN** ローカルで `npm run build` を実行する
- **THEN** この検査は実行されず、従来どおりビルドが完了する

#### Scenario: 正本が空のままローカルで起動する

- **WHEN** ローカルで正本 `contents/` が空の状態で起動する
- **THEN** 空のワークスペースとして起動できる

### Requirement: スキルカタログはビルド時に焼き込む

スラッシュ候補に出すスキルカタログ（表示用サマリ）は、ビルド時に生成物として焼き込まなければならない（SHALL）。スキル一覧 API はランタイムのファイルシステム走査が空を返したとき、焼き込んだカタログへフォールバックしなければならない（SHALL）。ローカル（ファイルシステムあり）では走査結果を優先する（SHALL）。スキル本文の焼き込み・デモ上でのスキル実行は要求しない——Agent の実行系がデモで失敗するのは既存仕様のまま。

#### Scenario: デプロイ先でスキル一覧が出る

- **WHEN** ランタイムのファイルシステムに `.claude/skills` が存在しないデプロイ先でスラッシュ候補を開く
- **THEN** ビルド時に焼き込まれたスキル一覧が表示される

#### Scenario: ローカルは生きた一覧を出す

- **WHEN** ローカルで `.claude/skills` にスキルが存在する状態でスキル一覧 API を呼ぶ
- **THEN** ファイルシステム走査の結果が返り、焼き込みは使われない

### Requirement: デモ配信では UI 状態の cookie を読まない

Vercel 上の Studio は、ページの描画で**ツリーの開閉・選択の cookie を読んではならない**（MUST NOT）——`cookies()` を呼ぶと route が dynamic rendering になり、正本をビルド時に焼き込む前提が崩れて、ランタイムの fs に無い正本を読みに行く（中身が空のデモになる）。

その結果、デモではツリーの開閉がサーバー描画で保持されず、**毎回「記憶が無い」状態として全折りたたみで描かれる**。選択はクライアント側（`localStorage`）の復元に頼る。これは読み取り専用デモとして**許容された挙動**であり、不具合として扱わない（SHALL）。

#### Scenario: デモでツリーを畳んでリロードする

- **WHEN** デプロイされた Studio でシリーズを展開し、リロードする
- **THEN** ツリーは全折りたたみで表示される
- **AND** それは既知かつ許容された挙動であり、デプロイの不具合として扱わない

#### Scenario: デモの正本は静的なまま

- **WHEN** ツリーの開閉・選択の cookie がブラウザに存在する状態でデプロイされた Studio を開く
- **THEN** ビルド時に焼き込まれた内容でツリーと本文が表示される

