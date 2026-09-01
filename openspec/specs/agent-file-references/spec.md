# agent-file-references Specification

## Purpose

Agent invoke 時に参照可能な `contents/` 配下 markdown ファイルの一覧 API と、許可パスの制限を規定する。
## Requirements
### Requirement: contents ファイル一覧 API

`GET /api/agent/files` エンドポイントが存在し、`contents/**/contents.md` の全ファイルを返さなければならない（SHALL）。`current` クエリパラメータで選択中レッスンの path が渡された場合、そのファイルを先頭に、残りを path のアルファベット順で返さなければならない（SHALL）。

#### Scenario: 全ファイルを返す

- **WHEN** `/api/agent/files` を呼び出す
- **THEN** `contents/**/contents.md` の path と name のリストが返される

#### Scenario: 選択中レッスンを先頭にする

- **WHEN** `/api/agent/files?current=contents/foo/bar/lesson/contents.md` を呼び出す
- **THEN** 応答の先頭が `contents/foo/bar/lesson/contents.md` で、残りは path のアルファベット順である

### Requirement: 許可パスの制限

参照可能ファイルは次の 3 つに限定されなければならない（SHALL）:

1. `contents/` 配下の `contents.md`
2. `contents-work/plans/` 配下のファイル
3. `contents-work/runs/` の**更新日時が新しい上位 3 件の run ディレクトリ**配下のファイル

それ以外のパス（`images/` `.claude/` `docs/` `data/` `lib/` 等）は一覧にも invoke 添付にも含めてはならない（SHALL NOT）。`workspace/` 配下を含めてはならない（MUST NOT）。

既定の候補一覧は、フォーカス中レッスンの `contents.md` を先頭に置かなければならない（SHALL）。レッスンにフォーカスしていない場合は、いずれの `contents.md` も先頭に固定してはならない（MUST NOT）——コース・シリーズにフォーカスしているとき、開いているファイルが作業対象とは限らないため。一覧そのものは階層を問わず上記 3 種すべてを含めてよい（MAY）。

読取許可は一覧より広く、`contents-work/runs/` 配下は run の新旧を問わず参照できなければならない（SHALL）。一覧は更新日時で変わるため、過去に貼った参照が時間経過で読めなくなってはならない（MUST NOT）。

#### Scenario: 許可外パスを一覧に含めない

- **WHEN** プロジェクト内に `images/foo.png` または `.claude/skills/create-draft/SKILL.md` が存在する
- **THEN** `/api/agent/files` の応答にそれらは含まれない

#### Scenario: 計画書と最新 run が一覧に含まれる

- **WHEN** `contents-work/plans/` に計画書があり、`contents-work/runs/` に 5 件の run ディレクトリがある
- **THEN** 計画書と、更新日時が新しい 3 件の run ディレクトリ配下のファイルが応答に含まれる
- **AND** 古い 2 件の run ディレクトリ配下のファイルは含まれない

#### Scenario: レッスンにフォーカスしていない場合

- **WHEN** コースまたはシリーズにフォーカスした状態で `/api/agent/files` を呼び出す
- **THEN** 開いているレッスンの `contents.md` は先頭に固定されない

#### Scenario: 一覧から外れた古い run も参照できる

- **WHEN** 最新 3 件から外れた run ディレクトリ配下のファイルを `@` 参照として渡す
- **THEN** 読取は成功する

