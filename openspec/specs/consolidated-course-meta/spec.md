# consolidated-course-meta Specification

## Purpose

シリーズ・コース・レッスンの順序とコースメタデータを `.meta.json` に統合し、旧来の `_series-order.json` 等を廃止する要件を規定する。
## Requirements
### Requirement: コース .meta.json に order・対象者・曼陀羅情報を統合する

コースフォルダの `.meta.json` は以下のすべてのフィールドを持たなければならない（SHALL）：

- `id`: 安定したコース ID（`crs-{slug}-{random6}`）
- `order`: レッスン名の配列（表示順）
- `target`: 対象者の説明文字列（旧 `target_audience` は `_course.json` フォールバック時のみ互換）
- `cross_series_prev`: 別シリーズの前コース ID の配列
- `cross_series_next`: 別シリーズの次コース ID の配列

旧来の `_lesson-order.json`・`_mandala.json`・`_meta.json`（アンダースコア版）は廃止し、これらのデータは `.meta.json` に統合する（SHALL）。`prerequisites` / `next_courses` は廃止する（SHALL）。

```json
{
  "id": "crs-git-concept-a3f8c2",
  "order": ["バージョン管理ってなに？", "Gitの三大エリア"],
  "target": "バージョン管理を全く知らない開発者",
  "cross_series_prev": ["crs-dx-piyopiyo-b7d1e4"],
  "cross_series_next": ["crs-git-env-setup-x9z2k1"]
}
```

#### Scenario: .meta.json からレッスン順序を読み込む

- **WHEN** コース `.meta.json` の `order` が `["A", "B"]` である
- **THEN** `loadContentsFolder()` はレッスンを A → B の順に返す

#### Scenario: .meta.json から対象者情報を読み込む

- **WHEN** コース `.meta.json` の `target` が `"全員"` である
- **THEN** `loadContentsFolder()` が返す `Course.target` は `"全員"` である

#### Scenario: .meta.json から曼陀羅情報を読み込む

- **WHEN** コース `.meta.json` の `cross_series_prev` が `["crs-xxx-a1b2c3"]` である
- **THEN** `loadContentsFolder()` が返す `Course.cross_series_prev` は `["crs-xxx-a1b2c3"]` である

---

### Requirement: シリーズ .meta.json はコース order と id を持つ

シリーズフォルダの `.meta.json` は `id`（安定したシリーズ ID）および `order`（コース名の配列）フィールドを持たなければならない（SHALL）。旧来の `_course-order.json` は廃止する。

```json
{
  "id": "srs-git-master-a3f8c2",
  "order": ["Git概念マスターコース", "Git環境構築コース"]
}
```

#### Scenario: シリーズ .meta.json からコース順序を読み込む

- **WHEN** シリーズ `.meta.json` の `order` が `["A", "B"]` である
- **THEN** `loadContentsFolder()` はコースを A → B の順に返す

---

### Requirement: contents/.meta.json はシリーズ order を持つ

`contents/` 直下の `.meta.json` は `order`（シリーズ名の配列）フィールドを持たなければならない（SHALL）。旧来の `_series-order.json` は廃止する。

```json
{
  "order": ["はじめにシリーズ", "Git完全マスターシリーズ"]
}
```

#### Scenario: contents/.meta.json からシリーズ順序を読み込む

- **WHEN** `contents/.meta.json` の `order` が `["A", "B"]` である
- **THEN** `loadContentsFolder()` はシリーズを A → B の順に返す

---

### Requirement: 各階層の .meta.json は公開サイト向けフィールドを持てる

各階層の `.meta.json` は、必須フィールドに加えて以下の公開サイト向けフィールドを持ってよい（MAY）。ローダーはこれらを読み込み、ロード結果に反映しなければならない（SHALL）。フィールドの意味・制約は `publishing-meta-fields` の規定に従う。

- 全体 `contents/.meta.json`: `description` / `description_en`
- シリーズ `.meta.json`: `slug` / `description` / `catch` / `cover` / `name_en` / `description_en` / `catch_en`
- コース `.meta.json`: `slug` / `description` / `catch` / `name_en` / `description_en` / `catch_en`

```json
{
  "id": "srs-git-klejoi",
  "order": ["Git概念コース", "Git環境構築コース", "Git基本操作コース"],
  "slug": "git-basics",
  "description": "バージョン管理の考え方と Git の基本操作を身につけるシリーズ",
  "catch": "セーブポイントのある開発へ",
  "cover": "cover-git-basics.png"
}
```

#### Scenario: シリーズ .meta.json の公開サイト向けフィールドを読み込む

- **WHEN** シリーズ `.meta.json` に `slug` / `description` / `catch` / `cover` が記述されている
- **THEN** `loadContentsFolder()` が返すシリーズ情報にそれらの値が反映されている

#### Scenario: コース .meta.json の公開サイト向けフィールドを読み込む

- **WHEN** コース `.meta.json` に `slug` / `description` / `catch` が記述されている
- **THEN** `loadContentsFolder()` が返す `Course` にそれらの値が反映されている

#### Scenario: 全体 contents/.meta.json の description を読み込む

- **WHEN** `contents/.meta.json` に `description` が記述されている
- **THEN** ロード結果から全体の `description` を取得できる

### Requirement: コース .meta.json は受講形態 style を持てる

コース `.meta.json` は任意フィールド `style` を持ってよい（MAY）。値は `self-study`（独習）/ `lecture`（講義）/ `hands-on`（ハンズオン）の3値のいずれかとする（SHALL）。ローダーはこれを読み込み、ロード結果の `Course` に反映しなければならない（SHALL）。未設定のコースはエラーにしてはならない（SHALL NOT）——既存コースは未設定のまま動き続ける。3値以外の値が書かれていた場合は未設定として扱い、読み込みを失敗させてはならない（SHALL NOT）。

表示の規約（表示側の実装は別 change）: 未設定はラベル非表示。日本語ラベルは「独習 / 講義 / ハンズオン」、英語ラベルは小文字の `self-study` / `lecture` / `hands-on`。

#### Scenario: style を読み込む

- **WHEN** コース `.meta.json` に `"style": "hands-on"` が記述されている
- **THEN** `loadContentsFolder()` が返す `Course` の `style` は `hands-on` である

#### Scenario: 未設定でも壊れない

- **WHEN** コース `.meta.json` に `style` キーが無い
- **THEN** 読み込みは成功し、`Course` の `style` は未設定である

#### Scenario: 語彙外の値は未設定として扱う

- **WHEN** コース `.meta.json` に `"style": "seminar"`（語彙外）が記述されている
- **THEN** 読み込みは成功し、`Course` の `style` は未設定である

### Requirement: コース .meta.json は Start / Goal 宣言を持てる

コースの `.meta.json` は、カリキュラムの入口・到達点の宣言として `is_start` / `is_goal`（boolean）を持てなければならない（SHALL）。省略時は false として扱う。ローダーは読み書きでこのフィールドを保持しなければならない（SHALL）。

宣言に構造上の制約を課してはならない（SHALL NOT）: 前のコース（同シリーズの前・`cross_series_prev`）を持つコースも `is_start: true` にでき、次のコースを持つコースも `is_goal: true` にできる。複数のコースが同時に `is_start` / `is_goal` を宣言できる。

この宣言は `cross_series_prev` / `cross_series_next` の配列に番兵値として混ぜてはならない（SHALL NOT）——配列は実在するコース ID のみを持つ（dangling リンク掃除の対象になるため）。

#### Scenario: フラグを読み取る

- **WHEN** コースの `.meta.json` に `"is_start": true` が記述されている
- **THEN** ローダーはそのコースの `is_start` を true として返す

#### Scenario: 省略時は false

- **WHEN** コースの `.meta.json` に `is_start` / `is_goal` が存在しない
- **THEN** ローダーはどちらも false として返し、エラーにしない

#### Scenario: 前のコースがあっても Start を宣言できる

- **WHEN** 同シリーズの前コースと `cross_series_prev` を持つコースの `.meta.json` に `"is_start": true` を設定する
- **THEN** 読み込みは成功し、リンク配列と `is_start` の両方が保持される

#### Scenario: フラグのみの変更が永続化される

- **WHEN** ユーザーがコースメタ編集で `is_start` だけを変更して保存する
- **THEN** コース `.meta.json` に変更が書き込まれ、開き直すと反映されている

