# translation-freshness Specification

## Purpose

翻訳（日本語正本 → 英語派生）の鮮度判定の正本。ハッシュの形式・本文ハッシュコメントの書式・メタの翻訳対象フィールドと `en_source_hash`・changelog の日付比較・3状態の判定規則を定める。Studio（翻訳 UI）と翻訳スキルが共用する。
## Requirements
### Requirement: 翻訳の鮮度は3状態で判定する

翻訳の鮮度は「未翻訳」「最新」「翻訳が古い」の3状態で判定しなければならない（SHALL）。判定はファイルの内容だけから行い、mtime・git 履歴に依存してはならない（SHALL NOT）。

- 英語側が存在しない（本文: `contents.en.md` 不在／メタ: `_en` フィールドが全て未設定）→ **未翻訳**
- 英語側が存在し、記録された原文ハッシュが現在の日本語側から計算したハッシュと一致 → **最新**
- 英語側が存在し、ハッシュが不一致**または未記録** → **翻訳が古い**（鮮度不明は保守的に古い扱い）

#### Scenario: 未翻訳の判定

- **WHEN** `contents.en.md` が存在しないレッスンの本文鮮度を判定する
- **THEN** 結果は「未翻訳」である

#### Scenario: 最新の判定

- **WHEN** `contents.en.md` の原文ハッシュが現在の `contents.md` のハッシュと一致する
- **THEN** 結果は「最新」である

#### Scenario: 原文が進んだら古い

- **WHEN** 翻訳後に `contents.md` が編集され、ハッシュが一致しなくなった
- **THEN** 結果は「翻訳が古い」である

#### Scenario: ハッシュ未記録は古い扱い

- **WHEN** `contents.en.md` が存在するが原文ハッシュコメントを持たない
- **THEN** 結果は「翻訳が古い」である

### Requirement: 本文の原文ハッシュは contents.en.md の1行目にコメントで持つ

本文翻訳の原文ハッシュは、`contents.en.md` の**1行目**に `<!-- source: sha256:<hex> -->` 形式のコメントとして保持しなければならない（SHALL）。値は翻訳に使用した時点の `contents.md` 全文の SHA-256（16進小文字）とする（SHALL）。ハッシュ計算の前に対象テキストの CRLF を LF へ正規化しなければならない（SHALL）——Windows と git の改行変換で同一内容が別ハッシュになる事故を防ぐ。ハッシュ行を書くのは翻訳の実行主体（翻訳ボタン・翻訳スキル）のみとする（SHALL）。

#### Scenario: 改行コードが違っても同一ハッシュ

- **WHEN** 同じ内容の `contents.md` が CRLF と LF の2通りの改行で存在する
- **THEN** 両者から計算されるハッシュは一致する

#### Scenario: ハッシュ行の書式

- **WHEN** 翻訳の実行主体が `contents.en.md` を生成する
- **THEN** 1行目は `<!-- source: sha256:` で始まるコメント行である

### Requirement: メタの原文ハッシュは同一 .meta.json の en_source_hash に持つ

メタ翻訳の原文ハッシュは、同じ `.meta.json` の `en_source_hash` フィールド（`sha256:<hex>` 形式）に保持しなければならない（SHALL）。ハッシュの入力は、階層ごとに定めた翻訳対象の日本語フィールドを**固定順の配列**にし、各要素の CRLF を LF へ正規化した上で `JSON.stringify` した文字列とする（SHALL）。未設定フィールドは空文字列として扱う（SHALL）。固定順は次のとおりとする（SHALL）:

- 全体: `[name, description]`
- シリーズ: `[フォルダ名, catch, description]`
- コース: `[フォルダ名, catch, description, target]`
- レッスン: `[フォルダ名, description]`

`author` / `author_en` はハッシュの入力に含めてはならない（SHALL NOT）——翻訳の対象外のため。

#### Scenario: コースメタの鮮度判定

- **WHEN** コース `.meta.json` に `name_en` 等の英訳と `en_source_hash` があり、その後 `target` が編集される
- **THEN** メタの鮮度判定は「翻訳が古い」になる

#### Scenario: フォルダ名の変更も検出される

- **WHEN** 英訳済みコースのフォルダ名（日本語名）を変更する
- **THEN** メタの鮮度判定は「翻訳が古い」になる

#### Scenario: author の変更は鮮度に影響しない

- **WHEN** 英訳済みレッスンの `.meta.json` で `author` だけを変更する
- **THEN** メタの鮮度判定は「最新」のままである

### Requirement: changelog の鮮度は日英の先頭エントリ日付で判定する

変更履歴の鮮度は、`changelog.md` と `changelog.en.md` それぞれの先頭（最新）の `## YYYY-MM-DD` 見出しの日付比較で判定しなければならない（SHALL）。`changelog.en.md` が無ければ「未翻訳」、英語側の先頭日付が日本語側より古ければ「翻訳が古い」、同じ以降なら「最新」とする（SHALL）。ハッシュは使用しない。

#### Scenario: 日本語にだけ新エントリが追記された

- **WHEN** `changelog.md` の先頭が `## 2026-08-21`、`changelog.en.md` の先頭が `## 2026-08-15` である
- **THEN** changelog の鮮度判定は「翻訳が古い」になる

#### Scenario: 追訳で最新になる

- **WHEN** 英語側にも `## 2026-08-21` のエントリが追記される
- **THEN** changelog の鮮度判定は「最新」になる

### Requirement: 判定ロジックの正本は Studio に置き、mandala 実装と parity テストで突き合わせる

鮮度判定・ハッシュ計算の正本実装は Studio（`studio/lib/` 配下の純関数）に置かなければならない（SHALL）。mandala はビルド時判定のために独自実装を持ってよい（MAY）が、実 `contents/` を入力とした parity テストで判定結果とハッシュ値が Studio 実装と一致することを検証しなければならない（SHALL）。

#### Scenario: 実装のずれをテストが検出する

- **WHEN** mandala 側のハッシュ計算規則だけを変更する
- **THEN** parity テストが失敗する

### Requirement: フィールド単位の英訳欠落を鮮度とは別軸で列挙できる

正本実装（`studio/lib/translation/freshness.ts`）は、階層ごとの翻訳対象キーに対し、未設定のフィールドを列挙する純関数を提供しなければならない（SHALL）。階層→対象キーの対応表はこの正本に一元化し、利用側（走査スクリプト・Studio の英語ビュー等）に複製してはならない（SHALL NOT）。

対象キーは次のとおりとする（SHALL）:

- 全体: `name_en` / `description_en`
- シリーズ: `name_en` / `catch_en` / `description_en`
- コース: `name_en` / `catch_en` / `description_en` / `target_en`
- レッスン: `name_en` / `description_en` / **`author_en`**

**未設定の定義は「キーが存在しない」「空文字」「空白のみ」のいずれかとする**（SHALL）——`.meta.json` にキーごと無い状態と、キーはあるが空の状態を区別してはならない（SHALL NOT）。どちらも「訳が入っていない」という同じ事実を指す。

欠落の判定は**原文側の対応フィールドが非空のものに限る**（SHALL）——原文が空なら訳しようがなく、欠落に数えると未完成の日本語メタを誤検出する。

**`author_en` は欠落判定の対象に含めるが、`en_source_hash` の入力には含めてはならない**（SHALL NOT）。この非対称は意図的である:

- 欠落判定に含めるのは、空欄が「意図した空白」か「入れ忘れ」か区別できず、執筆者に手入力を促す合図が要るため
- ハッシュ入力に含めないのは、含めると既存の `en_source_hash` がすべて不一致になり、翻訳済みのユニットが一斉に「翻訳が古い」へ落ちるため。加えて `author` の差し替えは英訳の鮮度と無関係である
- 翻訳の実行主体（翻訳ボタン・翻訳スキル）は `author_en` を書いてはならない（SHALL NOT）——人名の英字表記は本人の流儀であり、機械が推測するともっともらしく誤った綴りが入る

欠落は鮮度の3状態（未翻訳/最新/古い）とは**独立した情報**であり、欠落があることを理由に鮮度判定を変えてはならない（SHALL NOT）——鮮度は「原文に追随しているか」、欠落は「フィールドが埋まっているか」で、混ぜると既存の翻訳済みユニットが一斉に古い扱いになり Studio の表示と差分翻訳の対象が壊れる。

#### Scenario: 部分的に埋まったメタの欠落列挙

- **WHEN** `name_en` と `description_en` は記入済みだが `catch_en` と `target_en` が空のコースメタを判定する
- **THEN** 欠落として `catch_en` と `target_en` が列挙される
- **AND** 鮮度判定はハッシュの一致に従い、欠落の有無で変わらない

#### Scenario: 原文が空のフィールドは欠落に数えない

- **WHEN** 日本語の `catch` が空のシリーズメタで `catch_en` が未設定である
- **THEN** `catch_en` は欠落として列挙されない

#### Scenario: キーが存在しないのも欠落

- **WHEN** `.meta.json` に `description_en` のキー自体が無く、日本語の `description` は非空である
- **THEN** `description_en` は欠落として列挙される

#### Scenario: author_en の欠落は列挙される

- **WHEN** 日本語の `author` が非空で `author_en` が未設定のレッスンメタを判定する
- **THEN** `author_en` が欠落として列挙される

#### Scenario: author_en はハッシュに影響しない

- **WHEN** 英訳済みレッスンの `.meta.json` で `author` と `author_en` だけを変更する
- **THEN** メタの鮮度判定は「最新」のままである

