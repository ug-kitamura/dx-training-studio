# publishing-site-changelog Specification

## Purpose

変更履歴（正本 contents/changelog.md → 履歴ページ）の契約を規定する。人が書き足す正本を機械はパースせず、そのまま配信する。
## Requirements
### Requirement: 変更履歴の正本は contents/changelog.md である

変更履歴の正本は `contents/changelog.md`（日本語）でなければならない（SHALL）。人が新しいエントリを上に書き足す。変換・ビルドは内容をパース・並べ替え・書式検証してはならない（SHALL NOT）——書式は人の作法であり、崩れていてもビルドは成功しなければならない（SHALL）。

正本が存在しない場合、変換はエラーにせず、履歴ページとサイドバー項目を出さずに成功しなければならない（SHALL）。

#### Scenario: 正本が無くてもビルドは成功する

- **WHEN** `contents/changelog.md` が存在しない状態でビルドする
- **THEN** ビルドは成功する
- **AND** 履歴ページは生成されず、サイドバーに「変更履歴」項目も出ない

#### Scenario: 書式が崩れていても落ちない

- **WHEN** 見出しや日付の書式が揃っていない changelog をビルドする
- **THEN** ビルドは成功し、書かれた内容がそのまま表示される

### Requirement: 変換は changelog をそのままコピーする

変換スクリプトは `contents/changelog.md` の内容を変更せず `mandala/content/changelog.md` へ出力しなければならない（SHALL）。英語ツリーには `contents/changelog.en.md` があればその内容を、無ければ日本語の内容を `mandala/content/en/changelog.md` へ出力しなければならない（SHALL）。日本語フォールバック時は、レッスンと同じ未翻訳バッジを表示しなければならない（SHALL）。`changelog.en.md` が存在する場合は、日英それぞれの先頭エントリの日付（`translation-freshness` capability の判定規則）を比較し、英語側が古ければレッスンと同じ「翻訳が古い」バッジを表示しなければならない（SHALL）。最新ならばバッジを表示しない（SHALL NOT）。

#### Scenario: 内容が一致する

- **WHEN** `contents/changelog.md` がある状態で変換を実行する
- **THEN** `mandala/content/changelog.md` の内容は正本と一致する

#### Scenario: 英語は日本語へフォールバックする

- **WHEN** `contents/changelog.en.md` が無い状態で `/en/changelog` を開く
- **THEN** 日本語の履歴が表示され、未翻訳バッジが出る

#### Scenario: 英語版を置けば差し替わる

- **WHEN** 最新エントリまで揃った `contents/changelog.en.md` を置いて変換を実行する
- **THEN** `/en/changelog` は英語版の内容になり、どちらのバッジも表示されない

#### Scenario: 追記が英語版に未反映なら古いバッジが出る

- **WHEN** `changelog.md` の先頭エントリより古い先頭エントリしか持たない `changelog.en.md` がある状態で `/en/changelog` を開く
- **THEN** 英語版の内容が表示され、翻訳が古いことを示すバッジが出る

### Requirement: 履歴ページはサイドバーの最後に並ぶ

正本が存在するとき、ルート `_meta` の最後尾（全シリーズの後）に履歴ページの項目を追加しなければならない（SHALL）。表示名は日本語「変更履歴」・英語 "Changelog" とする。URL は `/changelog`（英語は `/en/changelog`）とする（SHALL）。

#### Scenario: サイドバーの最後に出る

- **WHEN** 正本がある状態でビルドしたサイトのサイドバーを見る
- **THEN** 「変更履歴」が全シリーズより下の最後の項目として表示される

#### Scenario: 英語ツリーでも最後に出る

- **WHEN** `/en` 配下のページでサイドバーを見る
- **THEN** "Changelog" が最後の項目として表示される

### Requirement: 履歴ページは全文検索の対象外である

Pagefind の検索結果に履歴ページが含まれてはならない（MUST NOT）。

#### Scenario: 履歴にだけある語で検索する

- **WHEN** 履歴ページにだけ書かれている語で全文検索する
- **THEN** 検索結果に履歴ページは現れない

### Requirement: 初期の正本は履歴の範囲を宣言する

初期作成する `contents/changelog.md` の冒頭には、「教材の主な更新のみを載せ、細かな修正は含まない」旨の一文を含めなければならない（SHALL）——網羅性を意図的に捨てる設計であることを受講者に伝えるため。この一文は正本に人が書くものであり、変換が挿入してはならない（SHALL NOT）。

#### Scenario: 冒頭の宣言がある

- **WHEN** 履歴ページを開く
- **THEN** 冒頭に「主な更新のみを載せる」旨の一文が表示される

### Requirement: slug changelog はシリーズに使えない

シリーズ slug `changelog` は履歴ページの URL `/changelog` と衝突するため、予約語として変換を中断しなければならない（SHALL）。エラーメッセージには対象パスと予約されている旨を含める（SHALL）。コース・レッスンの slug には制限しない——URL が衝突しないため。

#### Scenario: シリーズ slug changelog を弾く

- **WHEN** slug `changelog` を持つシリーズがある状態で変換を実行する
- **THEN** 変換は中断し、予約されている旨のエラーで終了する

#### Scenario: コース slug changelog は許す

- **WHEN** あるシリーズ配下のコースが slug `changelog` を持つ
- **THEN** 変換は成功する

### Requirement: レッスン本文からの相対リンクは各言語ツリーの履歴ページに解決する

レッスン本文に書かれた相対リンク `../../changelog` は、日本語ツリーのレッスンページからは `/changelog` に、英語ツリー（`/en` 配下）のレッスンページからは `/en/changelog` に解決しなければならない（SHALL）。変換・ビルドは本文中のリンクを書き換えてはならない（SHALL NOT）——翻訳契約「URL は変えない」と両立させ、日英で同じ記法のまま各言語の履歴ページへ飛べるようにするため。

#### Scenario: 日本語のレッスンから履歴ページへ飛ぶ

- **WHEN** `/start/intro/how-to-learn` の本文中の `../../changelog` リンクを開く
- **THEN** `/changelog`（日本語の変更履歴ページ）が表示される

#### Scenario: 英語のレッスンから履歴ページへ飛ぶ

- **WHEN** `/en/start/intro/how-to-learn` の本文中の `../../changelog` リンクを開く
- **THEN** `/en/changelog`（英語の変更履歴ページ）が表示される
