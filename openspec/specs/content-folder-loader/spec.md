# content-folder-loader Specification

## Purpose

`contents/` フォルダ走査による初期ロード API、表示順決定、メタデータ取得（各階層の `.meta.json`。レッスン含む）の要件を規定する。
## Requirements
### Requirement: contents/ フォルダ走査による初期ロード

アプリ起動時に `contents/` フォルダを走査し、シリーズ・コース・レッスンの構造を `Series[]` として返す API が存在しなければならない（SHALL）。レッスンはコース直下の `{lessonName}/contents.md` から読み込まなければならない（SHALL）。フォルダが存在しない場合は空の配列を返し、エラーにしてはならない（SHALL NOT）。

#### Scenario: 正常なフォルダ構成を読み込む

- **WHEN** `contents/` 配下に有効なシリーズフォルダ・コースフォルダ・レッスンフォルダ（各 `contents.md` 含む）が存在する状態で `/api/content/load` を呼ぶ
- **THEN** `Series[]` 形式の JSON が返され、シリーズ・コース・レッスンの階層が正しく構築されている

#### Scenario: contents/ フォルダが存在しない

- **WHEN** `contents/` フォルダが存在しない状態で `/api/content/load` を呼ぶ
- **THEN** 空の配列 `[]` が返され、HTTP ステータスは 200 である

### Requirement: contents 指紋から session.json を除外

`getContentsFingerprint` および `getContentsLatestMtime` が `contents/` ツリーを走査する際、各レッスンフォルダ内の `session.json`（`LESSON_SESSION_FILENAME`）を走査対象から除外しなければならない（SHALL）。Agent 会話の保存だけではコンテンツ hot-reload 用 fingerprint が変化してはならない（MUST NOT）。

#### Scenario: session.json 更新で fingerprint が変わらない

- **WHEN** レッスンフォルダの `session.json` のみが更新される
- **AND** `contents.md` および `.meta.json` に変更がない
- **THEN** `GET /api/content/mtime` の `fingerprint` は前回と同一である

#### Scenario: contents.md 更新で fingerprint が変わる

- **WHEN** レッスンフォルダの `contents.md` が更新される
- **THEN** `GET /api/content/mtime` の `fingerprint` は変化する

### Requirement: アンダースコア・ドット始まりのディレクトリを構造から除外する

`contents/` の走査において、名前が `_` または `.` で始まるディレクトリをシリーズ・コース・レッスンとして解釈してはならない（MUST NOT）。除外はディレクトリ名のみで判定しなければならない（SHALL）——中に何が入っているか、誰が作ったか（agent / スクリプト / 手作業）を条件にしてはならない（MUST NOT）。

中間ファイル置き場（`_work/`）はフォーカス中のフォルダ直下に作られるため、シリーズ階層および `contents/` 直下にフォーカスした状態では、除外しなければ幻のコース・幻のシリーズとして画面に現れる。

本要件はファイルには適用しない（MAY）——`.meta.json` 等の設定ファイルは従来どおり読み込む。

#### Scenario: contents/ 直下の _work は シリーズにならない
- **WHEN** `contents/_work/` が存在する状態で `/api/content/load` を呼ぶ
- **THEN** 返される `Series[]` に `_work` という名前のシリーズは含まれない

#### Scenario: シリーズ配下の _work はコースにならない
- **WHEN** `contents/シリーズA/_work/` が存在する状態で `/api/content/load` を呼ぶ
- **THEN** シリーズA の `courses` に `_work` という名前のコースは含まれない

#### Scenario: ドット始まりのディレクトリも除外される
- **WHEN** `contents/.tmp/` が存在する状態で `/api/content/load` を呼ぶ
- **THEN** 返される `Series[]` に `.tmp` という名前のシリーズは含まれない

#### Scenario: 通常のフォルダは従来どおり読み込まれる
- **WHEN** `contents/シリーズA/コースB/レッスンC/contents.md` が存在する
- **THEN** シリーズA・コースB・レッスンC が従来どおり構築される

#### Scenario: .meta.json は引き続き読み込まれる
- **WHEN** `contents/シリーズA/コースB/.meta.json` に `order` が記載されている
- **THEN** その順序がロード結果に反映される

### Requirement: レッスン `.meta.json` の読取と id 採番

ローダーはレッスンメタ（`slug` / `id` / `status` / `description` / `tags` / `estimated_minutes` / `author` / `author_en`）をレッスンフォルダの `.meta.json` から取得しなければならない（SHALL）。`contents.md` の frontmatter を解析してはならない（SHALL NOT）——`contents.md` は本文としてそのまま読む。`.meta.json` が存在しないレッスンは既定値（`status: "open"`・空文字・空配列・0）で扱い、エラーにしてはならない（SHALL NOT）。

レッスン `id` が存在しない場合、ローダーは `lsn-{slug}-{random6}` 形式（slug が無い場合は名前からの導出形式）の ID を生成し、`.meta.json` に書き込まなければならない（SHALL）——シリーズ・コースと同じ自己修復の流儀。`contents.md` へ書き込んではならない（SHALL NOT）。

#### Scenario: `.meta.json` からレッスンメタを読む

- **WHEN** レッスンフォルダの `.meta.json` に `status: "in_progress"`・`tags: ["git", "tutorial"]` が記述されている
- **THEN** ロード結果のレッスンオブジェクトに `status: "in_progress"`・`tags: ["git", "tutorial"]` が設定される

#### Scenario: `.meta.json` が無いレッスン

- **WHEN** `.meta.json` を持たないレッスンフォルダ（`contents.md` のみ）をロードする
- **THEN** エラーにならず、既定値のメタと新規採番された `id` を持つレッスンが返される
- **AND** レッスンフォルダに `id` を含む `.meta.json` が生成される

#### Scenario: frontmatter は解析されない

- **WHEN** `contents.md` の本文先頭に `---` で始まる行があるレッスンをロードする
- **THEN** その行はメタとして解釈されず、本文の一部として `content` に含まれる

### Requirement: 壊れた `.meta.json` はエラーとして報告する

全階層（全体・シリーズ・コース・レッスン）の `.meta.json` について、ファイルが存在するのにパースできない場合（構文エラー・BOM 等）、「存在しない」と同一視してはならない（SHALL NOT）。ローダーはエラーとして報告し、当該 `.meta.json` の id 再採番・既定値での上書きを行ってはならない（SHALL NOT）。エラーには対象ファイルのパスを含めなければならない（SHALL）。ファイルが存在しない場合は従来どおり自己修復（自動生成・採番）してよい（MAY）。

#### Scenario: BOM 付き `.meta.json` で止まる

- **WHEN** コースの `.meta.json` が BOM 付きで保存されていて `JSON.parse` が失敗する状態で `/api/content/load` を呼ぶ
- **THEN** 対象ファイルのパスを含むエラーが返される
- **AND** 当該 `.meta.json` は書き換えられず、`id` / `slug` は失われない

#### Scenario: 存在しない `.meta.json` は従来どおり自己修復される

- **WHEN** `.meta.json` を持たないコースをロードする
- **THEN** エラーにならず、`id` と `order` を持つ `.meta.json` が生成される

