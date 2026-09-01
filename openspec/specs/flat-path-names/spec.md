# flat-path-names Specification

## Purpose

`contents/` のパス名から数値プレフィックスを排除し、`.meta.json` の `order` 配列を順序の唯一の情報源とする要件を規定する。
## Requirements
### Requirement: フォルダ/ファイル名はプレフィックスなしの表示名とする

`contents/` 以下のすべてのシリーズフォルダ・コースフォルダ・レッスンフォルダは、`NN_` 形式の数値プレフィックスを持たず、表示名そのもの（`sanitizeFilename()` 適用済み）をパス名として使用しなければならない（SHALL）。レッスン本文は `{lessonName}/contents.md` に配置されなければならない（SHALL）。

#### Scenario: シリーズフォルダ名が表示名と一致する

- **WHEN** シリーズ「Git完全マスターシリーズ」が存在する
- **THEN** フォルダ名は `Git完全マスターシリーズ` であり `02_Git完全マスターシリーズ` ではない

#### Scenario: レッスンフォルダ名が表示名と一致する

- **WHEN** レッスン「バージョン管理ってなに？」が存在する
- **THEN** フォルダ名は `バージョン管理ってなに？` であり `01_バージョン管理ってなに？` ではない
- **AND** 本文は `バージョン管理ってなに？/contents.md` に存在する

---

### Requirement: 順序を `.meta.json` の `order` 配列で管理する

各階層の順序は対応する `.meta.json` の `order` 配列を唯一の情報源（SSoT）として管理しなければならない（SHALL）。

- `contents/.meta.json` の `order` がシリーズの表示順を決める
- `contents/{series}/.meta.json` の `order` がコースの表示順を決める
- `contents/{series}/{course}/.meta.json` の `order` がレッスン**フォルダ名**の表示順を決める

#### Scenario: シリーズの表示順が .meta.json に従う

- **WHEN** `contents/.meta.json` の `order` が `["はじめにシリーズ", "Git完全マスターシリーズ"]` である
- **THEN** UI のシリーズリストは「はじめにシリーズ」→「Git完全マスターシリーズ」の順に表示される

#### Scenario: コースの表示順が .meta.json に従う

- **WHEN** `contents/Git完全マスターシリーズ/.meta.json` の `order` が `["Git概念マスターコース", "Git環境構築コース"]` である
- **THEN** UI のコースリストは「Git概念マスターコース」→「Git環境構築コース」の順に表示される

---

### Requirement: reconcileOrderFiles が .meta.json を補完する（FS は変更しない）

ロード前に `reconcileOrderFiles()` を実行した場合、`.meta.json` の `order` と FS の実態の差分を解消しなければならない（SHALL）。ただし FS のリネーム・作成・削除は行ってはならない（MUST NOT）。

- `order` に存在するが FS に存在しないエントリは除去する
- FS に存在するが `order` に存在しないエントリは末尾に追加する
- 差分がなければ `.meta.json` を書き換えない

#### Scenario: FS に存在しないエントリを除去する

- **WHEN** `order` に `["A", "B"]` と記載されているが FS 上に `B` フォルダが存在しない
- **THEN** reconcile 後の `order` は `["A"]` となり、FS は変更されない

#### Scenario: .meta.json にないフォルダを末尾に追加する

- **WHEN** `order` に `["A"]` と記載されているが FS 上に `A` と `B` が存在する
- **THEN** reconcile 後の `order` は `["A", "B"]` となり、FS は変更されない

#### Scenario: 差分がない場合は .meta.json を書き換えない

- **WHEN** `order` と FS の内容が完全に一致する
- **THEN** `.meta.json` のファイルは書き換えられず、mtime が変化しない

---

### Requirement: 並び替え API は .meta.json のみ更新する

`POST /api/content/reorder` は FS 上のフォルダ/ファイルを rename せず、対象階層の `.meta.json` の `order` 配列を新しい順序で上書きするだけでなければならない（SHALL）。

#### Scenario: レッスンを並び替えた場合にフォルダが rename されない

- **WHEN** コース内のレッスン順序を変更して reorder API を呼び出す
- **THEN** レッスンフォルダ名は変わらず、コースの `.meta.json` の `order` のみが更新される

### Requirement: rename API は .meta.json を in-place 更新する

`POST /api/content/rename` によるリネーム時、FS 上のフォルダ/ファイル名の変更と同時に、対応する親階層の `.meta.json` の `order` 配列内の名前を更新しなければならない（SHALL）。これにより順序位置が保持される。

#### Scenario: コースをリネームした場合に order 内の名前も更新される

- **WHEN** コース「Git概念マスターコース」を「Gitの概念」にリネームする
- **THEN** フォルダ名が `Gitの概念` に変わり、シリーズ `.meta.json` の `order` 内の値も `Gitの概念` に更新される

---

### Requirement: create API は .meta.json に末尾追記する

`POST /api/content/create` による新規作成時、`NN_` プレフィックスなしのフォルダ/ファイルを作成し、対応する `.meta.json` の `order` 末尾に名前を追加しなければならない（SHALL）。

#### Scenario: 新規コースを作成した場合に .meta.json に追記される

- **WHEN** シリーズ内に新規コースを作成する
- **THEN** プレフィックスなしのコースフォルダが作成され、シリーズ `.meta.json` の `order` 末尾にコース名が追加される

---

### Requirement: delete API は .meta.json からエントリを除去する

`POST /api/content/delete` によるコース/レッスン削除時、対応する `.meta.json` の `order` 配列から削除対象の名前を除去しなければならない（SHALL）。

#### Scenario: コースを削除した場合に .meta.json から除去される

- **WHEN** コースを削除する
- **THEN** コースフォルダが削除され、シリーズ `.meta.json` の `order` から該当コース名が除去される

