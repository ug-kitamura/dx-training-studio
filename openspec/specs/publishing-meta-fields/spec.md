# publishing-meta-fields Specification

## Purpose

公開サイト（DX Training Mandala）向けの正本メタフィールド（`slug` / `description` / `catch` / `cover` / `_en`）の定義と制約を規定する。
## Requirements
### Requirement: slug の形式と一意性

公開サイトの URL に使う `slug` は、アルファベット小文字・数字・ハイフンのみで構成されなければならない（SHALL）。`slug` は同じ親に属する兄弟エンティティ間（同一階層のシリーズ同士・同一シリーズ内のコース同士・同一コース内のレッスン同士）で一意でなければならない（SHALL）。`slug` は人が正本に書く値であり、ツールが日本語名から自動ローマ字変換で生成してはならない（SHALL NOT）。

公開サイトの URL は `/{シリーズslug}/{コースslug}/{レッスンslug}` の3階層で構成される。URL の組み立てとビルド時の欠落検出は公開サイト側（別 change）の責務とする。

#### Scenario: 有効な slug を受理する

- **WHEN** シリーズ `.meta.json` に `"slug": "git-basics"` が記述されている
- **THEN** スキーマ検証が成功し、ローダーがその値を返す

#### Scenario: 不正な文字種の slug を拒否する

- **WHEN** `.meta.json` に `"slug": "Git基礎"` のような ASCII 外文字を含む slug が記述されている
- **THEN** スキーマ検証が失敗し、その旨がわかるエラーになる

### Requirement: 公開サイト向けフィールドはすべて後方互換の任意フィールドである

`slug` / `description` / `catch` / `cover` / `name_en` / `description_en` / `catch_en` はすべて任意フィールドでなければならない（SHALL）。これらが存在しない正本に対して、Studio のロード・保存・編集は従来どおり動作しなければならない（SHALL）。Studio が `.meta.json` を書き戻す際、既に書かれている公開サイト向けフィールドを削除・欠落させてはならない（SHALL NOT）。

#### Scenario: フィールドが無い既存正本がそのまま動く

- **WHEN** 公開サイト向けフィールドを一切持たない既存の `.meta.json` と `contents.md` をロードする
- **THEN** エラーにならず、従来と同じ構造が返される

#### Scenario: 保存で公開サイト向けフィールドが消えない

- **WHEN** `slug` と `catch` を持つコース `.meta.json` があるコースについて、Studio が `order` を更新して保存する
- **THEN** 保存後の `.meta.json` にも `slug` と `catch` が残っている

### Requirement: 英語フィールドは `_en` サフィックスで同一ファイルに持つ

表示テキストの英語版は、日本語フィールドに `_en` サフィックスを付けたフィールド（`name_en` / `description_en` / `catch_en`、コースでは `target_en`、レッスンでは `author_en` を含む）として**同一の `.meta.json` 内**に持たなければならない（SHALL）。レッスンの英語フィールドもレッスンフォルダの `.meta.json` に持つ（SHALL）——本文の英語版だけが `contents.en.md` に分かれる。別ファイル（`.meta.en.json` 等）に分離してはならない（SHALL NOT）。`target_en` はコース専用フィールドとする（SHALL）——`target` がコース専用のため。値の記入（翻訳）と記入用 UI は本要件の範囲外とする。

#### Scenario: _en フィールドを読み込める

- **WHEN** シリーズ `.meta.json` に `"name_en": "Git Basics"` が記述されている
- **THEN** ローダーが返すシリーズ情報から `name_en` の値を取得できる

#### Scenario: コースの target_en を読み込める

- **WHEN** コース `.meta.json` に `"target_en": "Beginners who have never used Git"` が記述されている
- **THEN** ローダーが返すコース情報から `target_en` の値を取得できる

#### Scenario: レッスンの author_en を読み込める

- **WHEN** レッスン `.meta.json` に `"author_en": "Kitamura"` が記述されている
- **THEN** ローダーが返すレッスン情報から `author_en` の値を取得できる

#### Scenario: _en フィールドが無くてもエラーにならない

- **WHEN** `_en` 系フィールドを持たない `.meta.json` をロードする
- **THEN** エラーにならず、`_en` 系は未設定として扱われる

### Requirement: cover はシリーズのみが持つ

ヒーロー画像の参照 `cover` は、シリーズ `.meta.json` のみが持てる（MAY）。コース・レッスン・全体（`contents/.meta.json`）のスキーマに `cover` を定義してはならない（SHALL NOT）。`cover` の値は正本画像置き場（`images/<file>`）のファイル名でなければならない（SHALL）。

#### Scenario: シリーズの cover を読み込める

- **WHEN** シリーズ `.meta.json` に `"cover": "cover-git-basics.png"` が記述されている
- **THEN** ローダーが返すシリーズ情報から `cover` の値を取得できる

### Requirement: 全体メタのサイト表示フィールド

全体（`contents/.meta.json`）は、公開サイトの表示に使う次の任意フィールドを持てる（MAY）: **`name`**（サイト名）・**`github_url`**（リポジトリへのリンク URL）・**`hero`**（トップのヒーロー画像参照）。英語版の器として `name_en` も持てる（MAY）。`hero` の値は正本画像置き場（`images/<file>`）のファイル名でなければならない（SHALL）。`hero` は全体のみが持ち、シリーズ・コース・レッスンのスキーマに定義してはならない（SHALL NOT）——シリーズのヒーローは既存の `cover` が担う。

これらのフィールドはすべて後方互換の任意フィールドであり、存在しない正本に対して Studio のロード・保存・編集は従来どおり動作しなければならない（SHALL）。Studio が全体 `.meta.json` を書き戻す際、既に書かれているこれらのフィールドを削除・欠落させてはならない（SHALL NOT）。

#### Scenario: 全体メタのサイト名を読み込める

- **WHEN** `contents/.meta.json` に `"name": "DX Training Mandala"` が記述されている
- **THEN** ローダー・API がその値を返す

#### Scenario: フィールドが無い既存正本がそのまま動く

- **WHEN** `name` / `hero` / `github_url` を持たない全体 `.meta.json` をロードする
- **THEN** エラーにならず、未設定として扱われる

#### Scenario: 他の書込でフィールドが消えない

- **WHEN** `hero` を持つ全体 `.meta.json` に対して description だけを更新する
- **THEN** 更新後も `hero` が残っている


### Requirement: en_source_hash は全階層の .meta.json が持てる任意フィールドである

メタ翻訳の鮮度ハッシュ `en_source_hash`（`sha256:<hex>` 形式の文字列）を、全階層（全体・シリーズ・コース・レッスン）の `.meta.json` の任意フィールドとして持てなければならない（SHALL）。無い既存正本はそのまま動き（SHALL）、他のフィールドの保存・ローダーの書き戻しで消えてはならない（SHALL NOT）。ハッシュの計算規則は `translation-freshness` capability が正本である。

#### Scenario: en_source_hash が保存で消えない

- **WHEN** `en_source_hash` を持つコース `.meta.json` に対して、コースメタの他フィールドを保存する
- **THEN** 保存後も `en_source_hash` の値が維持される

#### Scenario: 無くてもエラーにならない

- **WHEN** `en_source_hash` を持たない `.meta.json` をロードする
- **THEN** エラーにならず、未設定として扱われる
