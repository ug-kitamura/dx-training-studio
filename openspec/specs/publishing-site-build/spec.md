# publishing-site-build Specification

## Purpose

正本 `contents/` から公開サイト（DX Training Mandala）の入力を生成する変換の要件を規定する。
## Requirements
### Requirement: contents/ を走査して公開サイトの入力を生成する

変換スクリプトは `contents/` を走査し、Nextra が期待する配置（`mandala/content/` 配下の `.md` と `_meta` ファイル）を生成しなければならない（SHALL）。`contents/` を変更・削除してはならない（SHALL NOT）——正本は読み取り専用として扱う。生成物はビルドのたびに作り直せるものとし、git の追跡対象にしてはならない（SHALL NOT）。

走査は `studio/lib/contents-loader.ts` の走査規則（`_` / `.` 始まりディレクトリの除外、`.meta.json` の `order` による並び）に従わなければならない（SHALL）。

#### Scenario: 正本から Nextra の入力を生成する

- **WHEN** `contents/` にシリーズ・コース・レッスンが存在する状態で変換スクリプトを実行する
- **THEN** `mandala/content/` 配下に各レッスンの `.md` と各階層の `_meta` が生成される
- **AND** `contents/` 配下のファイルは変更されていない

#### Scenario: 生成物が追跡対象外である

- **WHEN** 変換スクリプトを実行した後に `git status` を見る
- **THEN** 生成物は追跡対象外であり、コミット候補に現れない

### Requirement: URL は正本の slug から決まる

公開サイトの URL は `/{シリーズslug}/{コースslug}/{レッスンslug}` でなければならない（SHALL）。slug の出所は各階層の `.meta.json`（シリーズ・コース・レッスンとも）とし、ディレクトリ名から自動生成してはならない（SHALL NOT）。レッスンの slug を `contents.md` の frontmatter から読んではならない（SHALL NOT）——`contents.md` は本文のみである。

**slug が欠落しているエンティティ、形式（`lib/schema.ts` の `SLUG_PATTERN`）に反する slug、同じ親の中で重複する slug が1つでもある場合、変換を中断してエラーで終了しなければならない**（SHALL）。エラーメッセージには対象のパスと理由を含めなければならない（SHALL）。

#### Scenario: slug から URL が決まる

- **WHEN** シリーズ slug `git`、コース slug `concepts`、レッスン slug `what-is-version-control` のレッスンを変換する
- **THEN** そのレッスンの URL は `/git/concepts/what-is-version-control` になる

#### Scenario: slug 欠落で変換を止める

- **WHEN** slug を持たないコースが `contents/` に存在する状態で変換を実行する
- **THEN** 変換は中断し、対象のパスと欠落の理由を含むエラーで終了する
- **AND** 生成物は出力されない

#### Scenario: レッスンの slug 欠落で変換を止める

- **WHEN** レッスンの `.meta.json` に `slug` が無い状態で変換を実行する
- **THEN** 変換は中断し、対象レッスンのパスと理由を含むエラーで終了する

#### Scenario: 兄弟間で重複する slug を検出する

- **WHEN** 同一シリーズ内の2つのコースが同じ slug を持つ
- **THEN** 変換は中断し、重複した slug と対象パスを含むエラーで終了する

#### Scenario: 別の親であれば同じ slug を許す

- **WHEN** `はじめにシリーズ` のコースと `Git基礎シリーズ` のコースがどちらも slug `setup` を持つ
- **THEN** 変換は成功し、`/start/setup` と `/git/setup` が生成される

### Requirement: サイドバーの表示名は正本の日本語名を使う

生成する `_meta` は、URL 用の slug をキーに、表示名として正本のシリーズ名・コース名・レッスン名（日本語）を割り当てなければならない（SHALL）。並び順は各階層の `.meta.json` の `order` に従わなければならない（SHALL）。

シリーズ・コース階層の `_meta` に「概要」という独立項目を出してはならない（SHALL NOT）。概要ページはフォルダ自身のページとして生成し（index に `asIndexPage: true`）、サイドバーのシリーズ名・コース名のクリックでトグル開閉と同時に概要ページが開かなければならない（SHALL）。ルート `_meta` の全体トップ項目は残し、表示名は日本語「ホーム」・英語「Home」としなければならない（SHALL）。

パンくずの有無は `_meta` の `theme` で制御し、全体トップとシリーズトップでは出さない（SHALL NOT）。⚠ `theme` は子の階層へ継承されるため、シリーズで無効にしたパンくずはコース階層の `_meta` で明示的に戻さなければならない（SHALL）——戻さないとコース・レッスンのパンくずまで消える。

#### Scenario: 日本語名がサイドバーに出る

- **WHEN** slug `git` / 名前 `Git基礎シリーズ` のシリーズを変換する
- **THEN** 生成された `_meta` は `git` に対して表示名 `Git基礎シリーズ` を割り当てる

#### Scenario: 全体トップの表示名

- **WHEN** 日本語と英語の `_meta` を生成する
- **THEN** ルートの全体トップ項目の表示名はそれぞれ「ホーム」「Home」になる

#### Scenario: order に従って並ぶ

- **WHEN** コース `.meta.json` の `order` が計画順で名前の昇順と一致しない
- **THEN** 生成された `_meta` のレッスンの並びは `order` と一致する

#### Scenario: 概要の独立項目が無い

- **WHEN** シリーズとコースを変換する
- **THEN** シリーズ・コース階層の `_meta` に「概要」（英語では Overview）の行は含まれない
- **AND** 各 index ページの frontmatter に `asIndexPage: true` が含まれる

#### Scenario: シリーズ名のクリックで概要が開く

- **WHEN** サイドバーのシリーズ名をクリックする
- **THEN** ツリーが開閉すると同時にそのシリーズの概要ページが表示される

#### Scenario: パンくずはコース階層で戻る

- **WHEN** シリーズの `_meta` 項目でパンくずを無効にして変換する
- **THEN** シリーズ階層の `_meta` のコース項目にはパンくずを有効にする `theme` が付く
- **AND** コーストップとレッスンページではパンくずが表示される

### Requirement: 画像の参照先はビルド時に切り替わり、デプロイ先によらず同一である

画像の参照先は**ビルド時の設定でローカル / Blob を切り替えられ**なければならない（SHALL）。設定は**コミットされる設定ファイル**に置かなければならない（SHALL）——デプロイ先ごとの環境変数で切り替えてはならない（SHALL NOT）。GitHub Pages 向けビルドと Vercel 向けビルドは、**常に同一の参照先**を使わなければならない（SHALL）。

ローカルモードでは、本文が参照する正本画像（`images/<file>`）をサイトの静的アセットへコピーし、参照を書き換えなければならない（SHALL）。Blob モードでは Blob の URL へ書き換えなければならない（SHALL）。

**参照された画像の実体が存在しない場合、ビルドは失敗しなければならない**（SHALL）——参照切れを公開前に検出する。

#### Scenario: ローカルモードで画像をコピーする

- **WHEN** 画像モードをローカルに設定して変換とビルドを実行する
- **THEN** 本文が参照する正本画像がサイトの静的アセットへコピーされ、ページから読み込める

#### Scenario: Pages と Vercel で参照先が変わらない

- **WHEN** 同一のコミットから Pages 向けと Vercel 向けのビルドをそれぞれ実行する
- **THEN** どちらのビルドでも画像の参照先モードは同一である

#### Scenario: 参照切れでビルドが落ちる

- **WHEN** 本文が存在しない画像ファイルを参照している
- **THEN** ビルドが失敗し、どのレッスンのどの参照かが分かる

### Requirement: 日本語をルート、英語を /en サブツリーに置く

日本語のページは URL のルート、英語のページは `/en` を前置したサブツリーに生成しなければならない（SHALL）。言語の切り替えはトグル操作とし、ブラウザ言語による自動リダイレクトを行ってはならない（SHALL NOT）——`output: 'export'` では middleware が動かない。

英語ページの本文は同フォルダの `contents.en.md` を使う（SHALL）。**存在しない場合は日本語本文へフォールバックしてはならない**（SHALL NOT）——英語サイトが日本語を配信することになり、Pagefind の英語索引も日本語で汚染されるため。代わりに、英語版がまだ無いことを示す**プレースホルダ**を本文として表示しなければならない（SHALL）。プレースホルダには**同じページの日本語版へのリンク**を含めなければならない（SHALL）——読者が内容へ辿り着く手段を残す。

`contents.en.md` の1行目の原文ハッシュコメントは、レンダリングされる本文に含めてはならない（SHALL NOT）。

**翻訳の状態を示すバッジを英語ページに表示してはならない**（SHALL NOT）——未翻訳はプレースホルダ本文が示すため重複であり、翻訳が古いことは受講者が対処できない情報だから。翻訳の鮮度は編集者（Studio）側に伝える（`studio-translation` capability）。

表示テキスト（シリーズ名・コース名・description・catch・コースの受講対象者）は `.meta.json` の `_en` フィールド（受講対象者は `target_en`）を使い、**無ければ日本語へフォールバックしなければならない**（SHALL）——本文と違い、ここで日本語を出さないと曼陀羅とサイドバーの項目が区別できなくなりナビゲーションが成立しない。

#### Scenario: 日本語と英語の URL

- **WHEN** レッスン `/git/concepts/what-is-version-control` を変換する
- **THEN** 日本語ページは `/git/concepts/what-is-version-control`、英語ページは `/en/git/concepts/what-is-version-control` に生成される

#### Scenario: 未翻訳レッスンはプレースホルダになる

- **WHEN** `contents.en.md` を持たないレッスンの英語ページを開く
- **THEN** 日本語の本文は表示されず、英語版がまだ無いことを示すプレースホルダが表示される
- **AND** 同じレッスンの日本語版へのリンクがある

#### Scenario: 未翻訳ページが英語索引を汚さない

- **WHEN** `contents.en.md` を持たないレッスンを変換する
- **THEN** 生成された英語ページの本文に日本語の本文が含まれない

#### Scenario: 古い翻訳でもバッジは出ない

- **WHEN** `contents.en.md` の原文ハッシュが現在の `contents.md` と一致しないレッスンの英語ページを開く
- **THEN** 英語の本文が表示され、翻訳が古いことを示すバッジは表示されない

#### Scenario: 翻訳済みのページにバッジが出ない

- **WHEN** `contents.en.md` の原文ハッシュが現在の `contents.md` と一致するレッスンの英語ページを開く
- **THEN** 英語の本文が表示され、翻訳に関するバッジは表示されない

#### Scenario: ハッシュ行は本文に出ない

- **WHEN** 1行目に原文ハッシュコメントを持つ `contents.en.md` を変換する
- **THEN** 生成されたページ本文にハッシュコメントの内容が含まれない

#### Scenario: メタの英語フォールバック

- **WHEN** `name_en` を持たないシリーズの英語ページを開く
- **THEN** 日本語のシリーズ名が表示され、エラーにならない

#### Scenario: 受講対象者の英語フォールバック

- **WHEN** `target_en` を持つコースの英語ページを開く
- **THEN** 受講対象者は `target_en` の値で表示される
- **AND** `target_en` が無いコースでは日本語の `target` が表示され、エラーにならない

#### Scenario: 執筆状況のラベルは残る

- **WHEN** `status` が `in_progress` のレッスンの英語ページを開く
- **THEN** `in progress` のラベルが表示される（翻訳の状態とは別の軸なので影響を受けない）

### Requirement: ビルドは全文検索インデックスを生成する

サイトのビルド（`npm run build`）は、全ページを対象とした Pagefind の検索インデックスを生成しなければならない（SHALL）。ビルドの生成物を配信した状態で、検索ボックスへの入力がエラーにならず結果を返さなければならない（SHALL）。検索インデックスは生成物であり、git の追跡対象にしてはならない（SHALL NOT）。検索ショートカットは Nextra 標準（Ctrl+K / Cmd+K）のまま変更してはならない（SHALL NOT）。

#### Scenario: ビルド後の配信で検索が機能する

- **WHEN** `npm run build` の生成物を配信し、検索ボックスに単語を入力する
- **THEN** エラーにならず、該当ページが検索結果に表示される

#### Scenario: 開発サーバーでも直近ビルドのインデックスで検索できる

- **WHEN** `npm run build` を一度実行した後に `npm run dev` で開発サーバーを起動し、検索ボックスに単語を入力する
- **THEN** エラーにならず、直近ビルド時点の内容で検索結果が表示される

#### Scenario: インデックスは追跡されない

- **WHEN** ビルド後に `git status` を確認する
- **THEN** 検索インデックスの生成先は git の追跡対象に現れない

### Requirement: ビルド込みの一発起動スクリプト

mandala の起動スクリプトは入れ物直下に置く（配置は project-layout の要件に従う）。`start-mandala-dev.bat` は、ビルド（`npm run build`）を実行してから開発サーバー（`npm run dev`）を起動しなければならない（SHALL）——検索インデックスはビルドでしか生成されないため、この順序で起動した開発サーバーでは検索が機能する。`start-mandala.bat` は、ビルドを実行してから `out/` を配信するサーバー（`npm run start`）を起動しなければならない（SHALL）。

#### Scenario: start-mandala-dev.bat で起動する

- **WHEN** `start-mandala-dev.bat` を実行する
- **THEN** 変換 → ビルド（検索インデックス生成を含む）が実行された後に開発サーバーが起動する
- **AND** 起動した開発サーバーで検索が機能する

#### Scenario: start-mandala.bat で本番相当を起動する

- **WHEN** `start-mandala.bat` を実行する
- **THEN** 変換 → ビルドが実行された後に `out/` の配信サーバーが起動する
- **AND** 配信されたサイトで検索が機能する

### Requirement: 変換はコースの style を site-data.json に含める

変換スクリプトは、コース `.meta.json` の `style` を読み取り、`site-data.json` のコース情報に含めなければならない（SHALL）。未設定のコースでは含めない（キー無しまたは undefined）。site 側の読み取りは Studio ローダーと同じ解釈（3値の語彙・語彙外は未設定扱い）でなければならない（SHALL）——parity テストの対象。

#### Scenario: style が site-data に伝搬する

- **WHEN** コース `.meta.json` に `"style": "lecture"` がある状態で変換を実行する
- **THEN** `site-data.json` の当該コースに `style: "lecture"` が含まれる

#### Scenario: 未設定コースでは伝搬しない

- **WHEN** `style` の無いコースを含めて変換を実行する
- **THEN** 変換は成功し、当該コースの `style` は `site-data.json` に含まれない

### Requirement: サイドバーは選択言語のツリーだけを表示する

日本語ページのサイドバーには日本語ツリーだけを表示し、`En`（`/en` サブツリー）の項目を出してはならない（SHALL NOT）。`/en` 配下のページのサイドバーには英語ツリーだけを表示し、日本語シリーズの項目を出してはならない（SHALL NOT）。言語の行き来はナビバーの言語トグルが担う。

#### Scenario: 日本語ビューに En が出ない

- **WHEN** 日本語のページ（ルート配下）を開く
- **THEN** サイドバーに `En` フォルダや英語ツリーの項目は表示されない

#### Scenario: 英語ビューは英語ツリーだけ

- **WHEN** `/en` 配下のページを開く
- **THEN** サイドバーには英語ツリー（Home とシリーズ）だけが表示され、日本語ルートのシリーズ項目は表示されない

### Requirement: 変換はコースの Start / Goal 宣言を site-data.json に含める

変換はコース `.meta.json` の `is_start` / `is_goal` を読み取り、`site-data.json` のコースデータに含めなければならない（SHALL）。フィールドが無い場合は false として扱い、変換をエラーにしてはならない（SHALL NOT）。

#### Scenario: 宣言が変換される

- **WHEN** `"is_start": true` を持つコースがある状態で変換を実行する
- **THEN** `site-data.json` の当該コースに `is_start` が true で含まれる

#### Scenario: 宣言が無くても変換は通る

- **WHEN** どのコースにも `is_start` / `is_goal` が無い状態で変換を実行する
- **THEN** 変換は成功し、全コースの宣言は false として扱われる

### Requirement: 変換は全体メタのサイト表示フィールドを反映する

変換（`build-content.mts`）は全体（`contents/.meta.json`）の `name` / `github_url` / `hero` を読み取り、`site-data.json` に含めなければならない（SHALL）。ページ側（navbar のサイト名・GitHub リンク・トップのヒーロー画像）はこの値を使う（SHALL）。未設定のフィールドは現行の既定へフォールバックしなければならない（SHALL）: `name` → `site.config.json` の `siteName`、`github_url` → `site.config.json` の `repositoryUrl`、`hero` → 同梱の `app/hero.jpg`。

`hero` が設定されているときは、変換が正本 `images/<hero>` を配信用（`public/`）へコピーしなければならない（SHALL）。参照先の実体が無い場合はビルドを失敗させる（SHALL）——本文画像の参照切れ検出と同じ扱い。

#### Scenario: 全体メタのサイト名が navbar に出る

- **WHEN** 全体 `.meta.json` に `name` を設定してビルドする
- **THEN** `site-data.json` にその値が含まれ、navbar のサイト名に使われる

#### Scenario: 未設定なら現行の既定で動く

- **WHEN** `name` / `hero` / `github_url` を持たない正本でビルドする
- **THEN** ビルドは成功し、サイト名・GitHub リンク・ヒーローは従来の値になる

#### Scenario: hero の実体が無いとビルドが失敗する

- **WHEN** `hero` に存在しないファイル名を設定してビルドする
- **THEN** ビルドは対象と理由がわかるエラーで中断する

### Requirement: 検索インデックスは言語ごとに分離される

`/en` 配下の英語ページは英語の索引、それ以外の日本語ページは日本語の索引に登録されなければならない（SHALL）。英語ページでの検索結果に日本語ページが混ざってはならない（SHALL NOT）。逆も同様とする（SHALL NOT）。配信される `/en` 配下の HTML の `<html lang>` は `en` でなければならない（SHALL）——検索の言語判定と支援技術の読み上げの両方が `lang` 属性に依存するため。

#### Scenario: 英語ページの lang 属性

- **WHEN** ビルド生成物の `/en` 配下の HTML を確認する
- **THEN** `<html>` の `lang` 属性は `en` である

#### Scenario: 日本語ページの lang 属性は変わらない

- **WHEN** ビルド生成物のルート（日本語）側の HTML を確認する
- **THEN** `<html>` の `lang` 属性は `ja` である

#### Scenario: 検索が言語で分かれる

- **WHEN** ビルド生成物を配信し、日本語ページで検索する
- **THEN** 検索結果に `/en` 配下のページが現れない

### Requirement: 未翻訳の変更履歴もプレースホルダにする

`contents/changelog.en.md` が存在しない場合、`/en/changelog` は日本語の変更履歴へフォールバックしてはならない（SHALL NOT）。レッスンと同じ規則でプレースホルダを表示し、日本語版へのリンクを含めなければならない（SHALL）。

`changelog.en.md` が存在する場合は、先頭エントリの日付が日本語側より古くてもバッジを表示してはならない（SHALL NOT）——鮮度は編集者側に伝える。

#### Scenario: 英語版の変更履歴が無い

- **WHEN** `contents/changelog.en.md` が無い状態で `/en/changelog` を開く
- **THEN** 日本語の変更履歴は表示されず、プレースホルダと日本語版へのリンクが表示される

#### Scenario: 英語版の変更履歴が古くてもバッジは出ない

- **WHEN** 日本語側にだけ新しいエントリがある状態で `/en/changelog` を開く
- **THEN** 英語版の内容が表示され、翻訳が古いことを示すバッジは表示されない

### Requirement: 配信プレビュー用スクリプト

配信先へコピーする前に「配信先での見え方」を確かめる手段を持たなければならない（SHALL）。配置は `project-layout` の要件に従う。

**basePath は引数または対話で受け取らなければならない（SHALL）。**既定値は社内ホスティングの値とし、GitHub Pages 相当と basePath 無し（ルート配信）も選べなければならない（SHALL）——配信先の違いは `NEXT_PUBLIC_BASE_PATH` の1軸に閉じているため、この1軸を受け取れば3つの配信先すべてに使える。

受け取った basePath でビルドを実行しなければならない（SHALL）。**ビルドが失敗した場合、配信へ進んではならない（MUST NOT）**——古い `out/` を配信すると「確認できた」と誤認する、静かな失敗になるため。

**一時領域に basePath と同じ階層を作り、`out/` の中身をその末端へ展開しなければならない（SHALL）。配信ルートは一時領域の最上位でなければならない（SHALL）。**サイト自身のディレクトリを配信ルートにしてはならない（MUST NOT）——パスが二重になって 404 になる。basePath が空の場合は入れ子を作らず、`out/` をそのまま配信ルートとする（SHALL）。

**一時領域は実行のたびに空にしなければならない（SHALL）**——前回の異なる basePath の展開結果が残ると、どちらを見ているのか判別できなくなる。

ブラウザは対象の URL が応答してから開かなければならない（SHALL）。待機には上限を設け、超えた場合はブラウザを開かずに URL を示さなければならない（SHALL）。配信に用いるポートは起動スクリプトのポートと衝突してはならない（MUST NOT）——起動中のサイトと並べて見比べられることに意味がある。

**`file://` で `index.html` を直接開く手順を案内してはならない（SHALL NOT）**——絶対パスの解決・ディレクトリ URL の扱い・`fetch()` のブロックにより原理的に表示できず、特に `fetch()` のブロックは basePath をどう設定しても解消しない。

#### Scenario: 社内ホスティングの basePath で確認する

- **WHEN** 社内ホスティングの basePath を選んで実行する
- **THEN** その basePath でビルドされ、一時領域に同じ階層が作られて展開される
- **AND** ブラウザが basePath 付きの URL で開き、ページ・アセット・検索が動作する

#### Scenario: GitHub Pages の basePath で確認する

- **WHEN** GitHub Pages 相当の basePath を選んで実行する
- **THEN** 同じ手順で確認でき、スクリプトの変更は不要である

#### Scenario: basePath 無しで確認する

- **WHEN** basePath 無しを選んで実行する
- **THEN** 入れ子は作られず、ルート URL でサイトが開く

#### Scenario: 前回の残骸が混ざらない

- **WHEN** ある basePath で実行した後、別の basePath で実行する
- **THEN** 一時領域に前回の展開結果は残っていない

#### Scenario: ビルドが失敗したら配信しない

- **WHEN** ビルドが失敗する状態で実行する
- **THEN** 配信サーバーは起動せず、ブラウザも開かない
- **AND** 古い `out/` の内容が配信されることはない

