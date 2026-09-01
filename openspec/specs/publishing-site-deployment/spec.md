# publishing-site-deployment Specification

## Purpose

公開サイトの継続的テストとリリース配信（GitHub Pages / Vercel）の要件を規定する。
## Requirements
### Requirement: push のたびに変換とビルドを検証する

`mandala/` または `contents/` の変更を含む **`main` への push** と **pull request** では、変換スクリプトの実行・サイトのビルド・テストを実行しなければならない（SHALL）。この検証ジョブは**いかなるデプロイも行ってはならない**（MUST NOT）。検証はリポジトリが private の状態でも実行できなければならない（SHALL）。

**同一の push に対して検証ジョブを2回起動してはならない**（MUST NOT）。作業ブランチへの push は pull request の契機だけで拾い、`main` への push は push の契機で拾う。⚠ ブランチを絞らない push と pull request を併用すると、pull request が開いているブランチへの push で**両方が発火する**。`concurrency` の group は `github.ref` に依存し、push（`refs/heads/<branch>`）と pull request（`refs/pull/<n>/merge`）で値が異なるため、これは相殺されない。

#### Scenario: 原稿を直して push する

- **WHEN** `contents/` のレッスンを変更し、pull request を開いた作業ブランチへ push する
- **THEN** 変換 → ビルド → テストが実行される
- **AND** GitHub Pages にも Vercel にもデプロイされない

#### Scenario: 同じ push で2回起動しない

- **WHEN** pull request が開いている作業ブランチへ push する
- **THEN** 検証ジョブの起動は1回だけである

#### Scenario: main へのマージでも検証する

- **WHEN** pull request を `main` にマージする
- **THEN** `main` への push として検証ジョブが1回実行される

#### Scenario: slug の欠落を検出する

- **WHEN** slug を持たないレッスンを追加して push する
- **THEN** 変換が失敗し、ジョブが失敗する

#### Scenario: 無関係な変更では走らない

- **WHEN** `mandala/` にも `contents/` にも関係しないファイルだけを変更して push する
- **THEN** 公開サイトの検証ジョブは起動しない

### Requirement: 公開は main の release タグでのみ行う

**GitHub Pages への本番公開**は、`v` で始まるタグの push によってのみ実行しなければならない（SHALL）。通常の push・merge で Pages へ本番公開してはならない（MUST NOT）。

タグはブランチに紐付かないため、**タグが指すコミットが `main` に含まれることを検証しなければならない**（SHALL）。含まれない場合はデプロイを実行せずに失敗させなければならない（SHALL）。

**Vercel はタグではなく `main` へのマージで配信する。**Vercel の配信は Vercel 側の git 連携が担い、GitHub Actions からデプロイしてはならない（MUST NOT）。**配信契機は `main` だけに限定しなければならない**（SHALL）。⚠ Vercel の既定は**全ブランチで preview デプロイを作る**ことであり、Production Branch を `main` に設定しただけでは他ブランチの配信は止まらない。**Ignored Build Step で明示的に止めなければならない**（SHALL）。

```
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; else exit 0; fi
```

この設定は、**同一リポジトリを見ている Vercel プロジェクトすべてに入れなければならない**（SHALL）——公開サイトと Studio 本体は別プロジェクトだが同じリポジトリを見ているため、片方だけでは他方が毎回ビルドする。⚠ このリポジトリには数分おきに commit と push を行う自動機構があるため、限定を怠るとビルドが走り続ける。

**Pages の確認用配信は手動トリガー（`workflow_dispatch`）で行えなければならない**（SHALL）。手動トリガーの目的はマージ前の動作確認なので、**手動起動ではワークフロー側の main 祖先チェックを行ってはならない**（MUST NOT）。手動起動には**リリース番号を与える入力を持たせ、既定は空**としなければならない（SHALL）。空のときリリース番号を表示してはならない（SHALL NOT）——確認用の配信に偽のバージョンを出さないため。

⚠ **ただし Pages は `main` とタグからしか配信できない。**GitHub Pages は 1リポジトリ 1サイトでプレビューの概念を持たないため手動起動でも本番サイトへ出る。これを踏まえ、`github-pages` environment のデプロイ可能 ref を `main` とリリースタグに限定しなければならない（SHALL）。**ワークフロー側で main 祖先チェックを飛ばしても、この environment 保護がプラットフォーム側で deploy を弾く**——作業ブランチからの手動 Pages 実行は成功しない。**この保護を解除してはならない**（MUST NOT）——作業ブランチの内容が社内トライアルサイトに出ることを防ぐ、意図した安全網である。

#### Scenario: main のコミットにタグを付けて公開する

- **WHEN** `main` にあるコミットへ `v0.1.0` タグを push する
- **THEN** Pages の本番サイトへ配信される

#### Scenario: main に無いコミットのタグを拒否する

- **WHEN** `main` に含まれないコミット（作業ブランチ等）へ `v0.1.1` タグを push する
- **THEN** ジョブは失敗し、どこにもデプロイされない

#### Scenario: main へのマージで Vercel が更新される

- **WHEN** pull request を `main` にマージする
- **THEN** Vercel の配信が自動で更新される
- **AND** Pages は更新されない（タグを打つまで変わらない）

#### Scenario: 作業ブランチへの push では Vercel が配信しない

- **WHEN** `main` 以外のブランチへ push する
- **THEN** Vercel のビルドは Ignored Build Step で打ち切られ、配信は発生しない

#### Scenario: 作業ブランチからの手動 Pages 実行は弾かれる

- **WHEN** `main` に含まれない作業ブランチを指定して Pages の手動トリガーを実行する
- **THEN** ビルドは通るが deploy は environment 保護に拒否される
- **AND** 社内トライアルサイトの内容は変わらない

#### Scenario: リリース番号を空のまま確認配信する

- **WHEN** リリース番号の入力を空のまま Pages の手動トリガーを実行する
- **THEN** 配信されたサイトにリリース番号は表示されない

### Requirement: 配信されたサイトはリリース番号と出所を示す

サイトはリポジトリへのリンクをナビバーに表示しなければならない（SHALL）。

**すべてのビルド**（ローカル・CI・Vercel・Pages）で、サイドバー最上部（メニューの上・左寄せ）に更新日時の行を表示しなければならない（SHALL）。日付は **HEAD の commit date** をタイムゾーン `Asia/Tokyo` で `YYYY.MM.DD` に整形した値とする（SHALL）。時・分を表示してはならない（SHALL NOT）——受講者には日付で足り、changelog フォールバック（日付のみ）とも表示が揃うため。⚠ 時刻を出さなくてもタイムゾーンの明示は必要である——UTC のビルドマシンでは**日付そのものが前日にズレる**。ビルド時刻を使ってはならない（MUST NOT）——再デプロイやキャッシュ切れのたびに日時が動き、「更新」の意味が失われるため。

行の表記は**見ているページの言語**に従わなければならない（SHALL）——日本語ページは `YYYY.MM.DD 更新`、英語ページ（`/en` 配下）は `Updated on YYYY.MM.DD`。日付の整形（`YYYY.MM.DD`・`Asia/Tokyo`）は日英で共通とする（SHALL）。言語の判定は `<html lang>` に基づくこと（SHALL）——lang は静的 HTML では postbuild が、クライアント遷移では `SiteShell` が既に正しくしており、更新日行が独自の言語判定を持ってはならない（SHALL NOT）。

タグから作られたビルドでは、同じ行の末尾にリリース番号を ` (vX.Y.Z)` の形式で併記しなければならない（SHALL）——この形式は日英共通とする。タグ由来でないビルドは日時のみとし、`dev` 等の代替文字列を出してはならない（SHALL NOT）。

文字サイズはサイドバーメニューの文字より一回り小さく、色は**メニューより一段引いたグレー**とする（SHALL）——短い番号だけだった頃は「前に出る色」だったが、行が長くなったため役割を反転する。ライト・ダークともコントラスト比 4.5:1 以上を維持しなければならない（SHALL）。

ビルド環境で commit date が取得できない場合は `contents/changelog.md` の先頭エントリの日付で代替し、それも無ければ行ごと表示しない（SHALL）——偽の日時をでっち上げてはならない（MUST NOT）。行を表示しない状態は日英ともに揃えること（SHALL）——片方の言語だけ行が出る状態を作らない。

ページ下部のフッター領域は持たない（SHALL NOT）。

#### Scenario: リリースされたサイトを見る

- **WHEN** `v1.2.3` タグから配信された Pages のサイトを開く
- **THEN** サイドバー最上部に `YYYY.MM.DD 更新 (v1.2.3)`（日付はタグが指すコミットの commit date）が表示される
- **AND** ナビバーにリポジトリへのリンクがある

#### Scenario: 英語ページでは英語表記になる

- **WHEN** `/en` 配下の任意のページを開く
- **THEN** サイドバー最上部に `Updated on YYYY.MM.DD`（タグ由来のビルドなら `Updated on YYYY.MM.DD (vX.Y.Z)`）が表示される
- **AND** 日付の値は日本語ページと同一である

#### Scenario: 言語を行き来しても表記が追随する

- **WHEN** 日本語ページから言語トグルで `/en` へ移り、さらに日本語へ戻る
- **THEN** 更新日行は `/en` では英語表記、日本語ページでは `YYYY.MM.DD 更新` で表示される

#### Scenario: Vercel の配信を見る

- **WHEN** `main` へのマージで配信された Vercel のサイトを開く
- **THEN** サイドバー最上部に `YYYY.MM.DD 更新`（HEAD の commit date）が表示される
- **AND** リリース番号は併記されない

#### Scenario: ローカルビルドを見る

- **WHEN** ローカルで `npm run build` したサイトを開く
- **THEN** 日付のみが表示され、リリース番号は出ない

#### Scenario: 手動 Pages 配信でも偽の番号を出さない

- **WHEN** リリース番号の入力を空のまま Pages の手動トリガーで配信する
- **THEN** 日時のみが表示され、リリース番号は出ない

#### Scenario: UTC のビルドマシンでも JST の日付で表示する

- **WHEN** タイムゾーンが UTC の CI 環境でビルドする
- **THEN** 表示される日付は `Asia/Tokyo` に換算した値である（UTC のままなら前日になる時間帯でも正しい）

#### Scenario: フッターが無い

- **WHEN** サイトの任意のページを最下部までスクロールする
- **THEN** フッター領域は表示されない

### Requirement: 配信先を差し替えられる形に保つ

Pages への配り方は1つのジョブに閉じ込め、配信先に依存する値（`basePath` 等）はワークフロー冒頭でまとめて定義しなければならない（SHALL）。将来「成果物のみを専用 public リポへ push する」方式へ切り替える際に、**サイト側のコードと変換スクリプトを変更せずに済む**構成でなければならない（SHALL）。

Pages の `basePath` はリポジトリ名をハードコードしてはならない（MUST NOT）——リポジトリ名の変更・移設に追随できず、配信されたサイトの全アセットが 404 になる事故の元。github.com の project Pages（`https://<owner>.github.io/<リポ名>/`）では `/${{ github.event.repository.name }}` から導出しなければならない（SHALL）。

社内 GHES への移行（Pages URL 形式: `https://pages.github.<会社>.com/<組織名>/<リポ名>/`）に備え、GHES 用の導出（`/${{ github.repository }}`）を**コメントアウトの形で併記**し、移行時の変更がワークフロー冒頭の 1 行の入れ替えに閉じるようにしなければならない（SHALL）。

#### Scenario: 専用 public リポ方式へ切り替える

- **WHEN** 配信方法を「別リポジトリへの push」に変更する
- **THEN** 変更はワークフローのデプロイジョブと冒頭の設定値に閉じる
- **AND** `mandala/` 配下のコードと `scripts/` の変換処理は変更されない

#### Scenario: リポジトリ名を変えても配信が壊れない

- **WHEN** リポジトリ名を変更した状態で Pages リリースを実行する
- **THEN** `basePath` は新しいリポジトリ名から導出され、アセットは 404 にならない

#### Scenario: GHES 移行の変更箇所が1行に閉じる

- **WHEN** ワークフローファイルの `PAGES_BASE_PATH` 定義部を読む
- **THEN** github.com 用の導出が有効で、GHES 用の導出がコメントとして併記されており、移行時はこの 1 行の入れ替えだけで済むことが読み取れる

### Requirement: Pages と Vercel は役割が異なる

Pages と Vercel は**同じ内容を配る2か所ではなく、役割の異なる2つの配信先**である。**内容が一致することを期待してはならない**（SHALL NOT）。

| | Pages | Vercel |
|---|---|---|
| 位置づけ | リリース版（社内トライアル配信） | 最新版（理想追求・実験） |
| 契機 | `v*` タグ（＋確認用の手動トリガー） | `main` へのマージ |
| 配信の担い手 | GitHub Actions | Vercel の git 連携 |
| サイドバーの表示 | 更新日時＋リリース番号 | 更新日時のみ |

画像の参照先は両者で同一でなければならない（SHALL）——現在は `site.config.json` の `imageSource: "local"` により、どちらもローカル画像を配信する。**デプロイ先ごとの環境変数で切り替えてはならない**（MUST NOT）。

Pages 向けビルドにはサブパス配信のための `basePath` を与えなければならない（SHALL）。Vercel 向けビルドには `basePath` を与えてはならない（MUST NOT）——ルート配信のため。

Vercel は Studio 本体とは**別のプロジェクト**へ配信しなければならない（SHALL）。⚠ 公開サイトの Vercel プロジェクトでは**git 連携による自動デプロイを使う**——以前は「push のたびに公開されるのを防ぐ」ため禁じていたが、配信契機を `main` に限定できるようになったため方針を改めた。

#### Scenario: 配信先ごとに内容が違ってよい

- **WHEN** `main` にマージした後、まだ `v*` タグを打っていない
- **THEN** Vercel は最新の内容を配信している
- **AND** Pages は直近のリリースタグの内容のままである

#### Scenario: basePath は配信先で異なる

- **WHEN** Pages と Vercel のそれぞれでビルドされる
- **THEN** Pages のビルドには `basePath` が与えられ、Vercel のビルドには与えられない

#### Scenario: Studio のデプロイに影響しない

- **WHEN** 公開サイトのファイルだけを変更して `main` にマージする
- **THEN** 公開サイトの Vercel プロジェクトが配信される
- **AND** Studio 本体の Vercel プロジェクトは配信されない前提の設定（Root Directory と Ignored Build Step）が入っている

### Requirement: 公開サイトのビルドは mandala/ 配下だけで完結する

公開サイトの**ビルドとテスト**は、`mandala/` 配下の依存と設定だけで完結しなければならない（SHALL）。`mandala/` の外にある `node_modules` や設定ファイル（兄弟アプリ `studio/` の `postcss.config.mjs` 等）に依存してはならない（SHALL NOT）。

**線引きは「依存」と「ソース」で分かれる。**`mandala/` の外にある**コミットされたソース**（Studio の `studio/lib/*.ts` 等）を読むことは**許される**（SHALL be allowed）——Studio と mandala のずれを検出する parity テストはそれ自体が目的であり、禁じると検出手段を失う。禁じられるのは `mandala/` の外の `node_modules` と設定ファイルへの依存だけである。

したがって、`mandala/` の外のソースを実行するテストは、**そのソースが必要とする npm パッケージを `mandala/` 側の依存として解決しなければならない**（SHALL）。解決は**許可リスト方式**とし、許可した名前だけを `mandala/node_modules` へ向け、それ以外の名前は解決せずに失敗させなければならない（SHALL）——新しい依存が増えたことに気づけるようにするため。許可したパッケージの版が `mandala/` 側と外側とで異なりうる場合、その近似を受け入れる理由をコメントで残さなければならない（SHALL）。

CI・リリースの各ワークフローは `mandala/` でのみ `npm ci` を実行する。ビルドツールの設定探索（Next の postcss 設定探索は `find-up` で親方向へ遡る）が親ディレクトリまで届く場合に備え、`mandala/` 側に**同名の設定ファイルを置いて探索を止めなければならない**（SHALL）——兄弟構成では親（入れ物）に設定が無いため理論上は不要だが、防御として維持する。この種の設定ファイルには、なぜ空の設定が必要かをコメントで残さなければならない（SHALL）。

#### Scenario: 兄弟アプリの依存が無くてもビルドが通る

- **WHEN** `studio/node_modules` が存在しない状態で `mandala/` の `npm ci` と `npm run build` を実行する
- **THEN** ビルドは成功する

#### Scenario: 兄弟アプリの依存が無くてもテストが通る

- **WHEN** `studio/node_modules` が存在しない状態で `mandala/` のテストを実行する
- **THEN** parity テストを含む全テストが成功する
- **AND** parity テストはスキップされず、実際に Studio 側ローダーを実行して比較している

#### Scenario: 全ワークフローでビルドが通る

- **WHEN** 検証（CI）・GitHub Pages リリース・社内ホスティング配信（build ジョブ）の各ワークフローが `mandala/` でのみ `npm ci` してビルドする
- **THEN** どのワークフローでもビルドが成功する
- **AND** ワークフロー側に `mandala/` 外の依存をインストールする手順は含まれない

#### Scenario: 探索を止める空設定が維持される

- **WHEN** `mandala/postcss.config.mjs` を確認する
- **THEN** 空の設定と、なぜ必要かのコメントが存在する

#### Scenario: 許可していない依存は黙って通さない

- **WHEN** `mandala/` の外のソースが、許可リストに無い npm パッケージを import した状態でテストを実行する
- **THEN** そのテストは解決できずに失敗する
- **AND** 失敗は握り潰されず、どのパッケージが不足しているかが分かる

### Requirement: Vercel のタグ連動配信ワークフローは持たない

Vercel の配信は git 連携（`main` へのマージ）のみで行い、GitHub Actions に Vercel 向けの配信ワークフローを置いてはならない（MUST NOT）——タグ連動の Vercel 配信は廃止済みであり、復元しない。他のワークフローやドキュメントから、削除された Vercel ワークフローを参照してはならない（SHALL NOT）——実在しないファイルへの参照は次に読む人を迷わせる。

#### Scenario: 削除済みワークフローへの参照が残っていない

- **WHEN** `.github/workflows/` 配下の全ファイルと `docs/handoff.md` を確認する
- **THEN** Vercel 向けリリースワークフローのファイルは存在せず、それを参照するコメント・記述も存在しない

