# lesson-meta-file Specification

## Purpose
TBD - created by archiving change lesson-meta-json. Update Purpose after archive.
## Requirements
### Requirement: レッスンメタの正本はレッスンフォルダの `.meta.json` である

各レッスンのメタ情報は、レッスンフォルダ直下の `.meta.json`（`contents/<シリーズ>/<コース>/<レッスン>/.meta.json`）に保存しなければならない（SHALL）。持てるフィールドは `id` / `slug` / `status` / `description` / `tags` / `estimated_minutes` / `author` / `author_en` / `name_en` / `description_en` / `en_source_hash` とする（SHALL）。`series` / `course` / `lesson` の名前フィールドを持ってはならない（SHALL NOT）——名前の正本はフォルダ名であり、コース・シリーズの `.meta.json` が名前を持たない流儀と一致させる。未設定の任意フィールドはキー自体を書いてはならない（SHALL NOT）。

`status` の語彙は `open` / `in_progress` / `done` とし、旧値 `draft` は読込時に `open` へ読み替えなければならない（SHALL）。語彙外・未設定は `open` として扱う（SHALL）。

`en_source_hash` はメタ翻訳の鮮度ハッシュであり、計算規則は `translation-freshness` capability が正本である。

#### Scenario: レッスンメタを `.meta.json` から読み込む

- **WHEN** レッスンフォルダの `.meta.json` に `slug` / `status` / `tags` / `estimated_minutes` / `author` が記述されている
- **THEN** ロード結果のレッスンオブジェクトにそれらの値が設定される

#### Scenario: en_source_hash を持つメタがスキーマに適合する

- **WHEN** レッスン `.meta.json` に `"en_source_hash": "sha256:ab12..."` が記述されている
- **THEN** strict スキーマの検証を通過し、未知キーとして拒否されない

#### Scenario: 名前フィールドは持たない

- **WHEN** アプリがレッスン `.meta.json` を書き込む
- **THEN** 書き込まれた JSON に `series` / `course` / `lesson` キーは含まれない

#### Scenario: 旧ステータス draft の読み替え

- **WHEN** `.meta.json` に `"status": "draft"` が記述されている
- **THEN** ロード結果のステータスは `open` である

### Requirement: `contents.md` は本文のみで構成する

レッスンの `contents.md` は Markdown 本文のみで構成しなければならない（SHALL）。frontmatter（`---` 区切りの YAML ブロック)を含めてはならない（SHALL NOT）。アプリは `contents.md` の保存・読込でメタの書き戻し・正規化・親子不一致の拒否を行ってはならない（SHALL NOT）——本文とメタの保存経路は独立である。Studio のローダーは本文先頭に frontmatter 区切りを検出した場合、警告ログを出してよい（MAY）が、自動修復してはならない（SHALL NOT）。

#### Scenario: 本文保存はメタに触れない

- **WHEN** ユーザーが編集モードで本文を変更して保存する
- **THEN** `contents.md` には編集後の本文がそのまま書き込まれる
- **AND** 同レッスンの `.meta.json` は変更されない

#### Scenario: メタ保存は本文に触れない

- **WHEN** ユーザーがレッスンメタ（description 等）を変更して保存する
- **THEN** `.meta.json` が更新される
- **AND** `contents.md` は変更されない

### Requirement: `author_en` は表記が2つあるときの英語側である

`author_en` は「著者名の英訳」ではなく「表記が2つあるときの英語表記」でなければならない（SHALL）。表示は双方向フォールバックとする（SHALL）: 日本語表示は `author` を優先し無ければ `author_en`、英語表示は `author_en` を優先し無ければ `author`。英語名しか持たない著者は `author` に英語名を書くだけでよく、`author_en` の記入を要求してはならない（SHALL NOT）。自動翻訳の仕組み（将来の翻訳スキルを含む）が `author` / `author_en` を書き換えてはならない（SHALL NOT）——人名のローマ字表記は本人の流儀に属する。

#### Scenario: 英語名のみの著者

- **WHEN** `.meta.json` に `"author": "John Smith"` のみが記述されている
- **THEN** 日本語ページ・英語ページのどちらでも著者は `John Smith` と表示される

#### Scenario: 表記を書き分けた著者

- **WHEN** `.meta.json` に `"author": "北村"` と `"author_en": "Kitamura"` が記述されている
- **THEN** 日本語ページでは `北村`、英語ページでは `Kitamura` と表示される

#### Scenario: author_en だけが書かれている

- **WHEN** `.meta.json` に `"author_en": "Kitamura"` のみが記述されている
- **THEN** 日本語ページでも著者は `Kitamura` と表示される


