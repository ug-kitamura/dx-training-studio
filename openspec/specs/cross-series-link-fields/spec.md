# cross-series-link-fields Specification

## Purpose

別シリーズ曼陀羅リンク用フィールド名を `cross_series_prev` / `cross_series_next` に統一し、旧 `prerequisites` / `next_courses` を廃止する。

## Requirements

### Requirement: 別シリーズ前コースは `cross_series_prev` に保存する

コースの `.meta.json` における別シリーズの前コース ID リストは、`cross_series_prev` フィールドに保存しなければならない（SHALL）。このフィールドには当該コースの親シリーズ以外のコース ID のみを含めなければならない（SHALL）。同シリーズ内の前コースを `cross_series_prev` に保存してはならない（MUST NOT）。

#### Scenario: 保存時に同シリーズ ID を `cross_series_prev` から除外する

- **WHEN** ユーザーがコースメタを保存する
- **THEN** `cross_series_prev` には当該コースと異なるシリーズのコース ID のみが含まれる

#### Scenario: ローダーが `cross_series_prev` を読み取る

- **WHEN** `course/.meta.json` に `"cross_series_prev": ["crs-dx-intro-a1b2c3"]` が記述されている
- **THEN** ローダーはそのコースオブジェクトの `cross_series_prev` を `["crs-dx-intro-a1b2c3"]` として返す

#### Scenario: `cross_series_prev` がない場合は空配列になる

- **WHEN** `course/.meta.json` に `cross_series_prev` フィールドが存在しない
- **THEN** ローダーはそのコースオブジェクトの `cross_series_prev` を `[]` として返す

### Requirement: 別シリーズ次コースは `cross_series_next` に保存する

コースの `.meta.json` における別シリーズの次コース ID リストは、`cross_series_next` フィールドに保存しなければならない（SHALL）。このフィールドには当該コースの親シリーズ以外のコース ID のみを含めなければならない（SHALL）。同シリーズ内の次コースを `cross_series_next` に保存してはならない（MUST NOT）。

#### Scenario: 保存時に同シリーズ ID を `cross_series_next` から除外する

- **WHEN** ユーザーがコースメタを保存する
- **THEN** `cross_series_next` には当該コースと異なるシリーズのコース ID のみが含まれる

#### Scenario: ローダーが `cross_series_next` を読み取る

- **WHEN** `course/.meta.json` に `"cross_series_next": ["crs-python-intro-x9z2k1"]` が記述されている
- **THEN** ローダーはそのコースオブジェクトの `cross_series_next` を `["crs-python-intro-x9z2k1"]` として返す

### Requirement: `prerequisites` / `next_courses` フィールドは廃止する

**BREAKING**: コースメタの `prerequisites` および `next_courses` フィールドを廃止し、それぞれ `cross_series_prev` および `cross_series_next` に置き換えなければならない（SHALL）。ローダーは旧フィールドをフォールバックとして読み取ってはならない（MUST NOT）。マイグレーションスクリプトで事前変換を完了させることでクリーンな移行とする。

#### Scenario: `prerequisites` を含む旧 `.meta.json` はマイグレーション後に動作する

- **WHEN** マイグレーションスクリプトが実行された後
- **THEN** すべての `course/.meta.json` に `cross_series_prev` フィールドが存在する
- **AND** `prerequisites` フィールドは存在しない
