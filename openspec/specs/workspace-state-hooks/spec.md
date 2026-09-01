# workspace-state-hooks Specification

## Purpose

DX Training Studio の `Workspace.tsx` 状態管理における hook 責務境界を定義する。`useWorkspaceSelection`・`useSeriesMutations`・`useLessonMutations` による関心分離、および `lib/workspace-selection.ts` による削除後選択ルールを規定する。ユーザー向け挙動は `training-studio-workspace-ui`・`training-studio-course-flow` に従い、本 spec は実装構造の要件を扱う。
## Requirements
### Requirement: 削除後の選択状態は pure function で決定する

シリーズまたはコース削除後の `selectedSeriesId` / `selectedCourseId` / `selectedLessonId` は、`lib/workspace-selection.ts` の pure function（`resolveSelectionAfterDelete`）で決定しなければならない（SHALL）。`setSeries` の updater 内から別の `setState` を呼んではならない（MUST NOT）。決定結果は**削除された階層の親へフォーカス**しなければならない（SHALL）: 選択中レッスンの削除→親コース、選択中コースの削除→親シリーズ、選択中シリーズの削除→ホーム（全空）。下位階層へ自動で降りてはならない（MUST NOT）。

#### Scenario: 選択中シリーズ削除後はホームになる

- **WHEN** ユーザーが選択中コースを含むシリーズを削除する
- **THEN** 選択は全空（ホーム）になる

#### Scenario: 選択中コース削除後は親シリーズにフォーカスが残る

- **WHEN** ユーザーが現在選択中のコースを削除する
- **THEN** `selectedSeriesId` は親シリーズのまま、`selectedCourseId` / `selectedLessonId` は空文字になる

#### Scenario: 非選択コース削除では選択を維持

- **WHEN** ユーザーが選択中でないコースを削除する
- **THEN** `selectedCourseId` と `selectedLessonId` は変更されない

#### Scenario: レッスン削除で選択中レッスンが消えた場合

- **WHEN** ユーザーが選択中のレッスンを削除する
- **THEN** `selectedLessonId` は空文字になり、フォーカスはコースに止まる

#### Scenario: 最後のコースを削除するとシリーズにフォーカスが残る

- **WHEN** ユーザーがシリーズ内の最後のコースを削除する
- **THEN** `selectedCourseId` と `selectedLessonId` は空文字になる
- **AND** `selectedSeriesId` は当該シリーズのままで、フォーカスはシリーズに止まる

### Requirement: 選択状態は useWorkspaceSelection hook に集約する

`selectedSeriesId`・`selectedCourseId`・`selectedLessonId`・派生 `selectedSeries` / `selectedCourse` / `selectedLesson`・`selectSeries` / `selectCourse` / `selectLesson` は `useWorkspaceSelection` hook に集約しなければならない（SHALL）。

選択操作は**クリックした階層で止まらなければならない**（SHALL）: `selectSeries` は当該シリーズを選択し `selectedCourseId` / `selectedLessonId` を空にする（SHALL）。`selectCourse` は当該コース（と所属シリーズ）を選択し `selectedLessonId` を空にする（SHALL）。下位階層を自動選択してはならない（MUST NOT）。

**3 フィールドすべてが空の状態はホーム（全体）選択**を表す（SHALL）。フォーカス階層は `selectedSeriesId` / `selectedCourseId` / `selectedLessonId` の**最深の非空フィールドから導出**しなければならない（SHALL）。フォーカス階層を表す判別フィールドを別に保持してはならない（MUST NOT）。

選択の永続化はホーム選択（全空）も対象としなければならない（SHALL）——保存値が全空なら復元時もホーム選択になる。保存値が存在しない初回起動は、従来どおり先頭のシリーズ・コース・レッスンへのフォールバックを使う（SHALL）。

#### Scenario: コース選択はコースで止まる

- **WHEN** ユーザーがレッスンを含むコースを選択する
- **THEN** `selectedCourseId` は当該コース ID になり、`selectedLessonId` は空文字になる

#### Scenario: シリーズ選択はシリーズで止まる

- **WHEN** ユーザーがコースとレッスンを含むシリーズを選択する
- **THEN** `selectedSeriesId` は当該シリーズ ID になり、`selectedCourseId` / `selectedLessonId` は空文字になる

#### Scenario: ホーム選択

- **WHEN** ユーザーがホーム（全体）を選択する
- **THEN** 3 フィールドすべてが空文字になり、フォーカス階層は「なし（全体）」になる

#### Scenario: ホーム選択が復元される

- **WHEN** ホーム選択の状態で保存された選択を次回起動時に読み込む
- **THEN** ホーム選択（全空）が復元される

### Requirement: シリーズ/コース CRUD は useSeriesMutations hook に集約する

シリーズ/コースの追加・削除・並び替え・メタ更新（`addSeries`・`deleteSeries`・`addCourse`・`deleteCourse`・`reorderSeries`・`reorderCourses`・`updateCourseMeta`・`updateSeriesName`）は `useSeriesMutations` hook に集約しなければならない（SHALL）。ドメイン変換は既存 `lib/course-flow.ts` を用いなければならない（SHALL）。

#### Scenario: deleteSeries が updater 内 setState しない

- **WHEN** 開発者が `deleteSeries` の実装を確認する
- **THEN** `setSeries` updater 内に `setSelectedCourseId` 等の呼び出しがない
- **AND** series 更新と selection 更新は同一ハンドラ内の別々の setState 呼び出しである

### Requirement: レッスン CRUD は useLessonMutations hook に集約する

レッスンの追加・削除・並び替え・本文/メタ/ステータス更新は `useLessonMutations` hook に集約しなければならない（SHALL）。本文/メタ更新は `lib/lesson-frontmatter.ts` の関数を用いなければならない（SHALL）。

#### Scenario: レッスン追加後に新レッスンが選択される

- **WHEN** ユーザーがコースにレッスンを追加する
- **THEN** 新規レッスン ID が `selectedLessonId` になる

### Requirement: 既存のユーザー向け挙動を維持する

本要件が対象とする内部構造のリファクタは、**ワークスペースのペイン構成**・選択フロー・CRUD 操作の結果を変更前と同等に保たなければならない（SHALL）。

⚠ 本要件が書かれた時点の画面は4ペイン構成だったが、現在は**3ペイン**（左からツリー・エディタ／メタ・Agent／画像）である。Scenario はいずれも現行の画面で読めるように書き直してある。コード上の識別子（`Pane4Shell` 等）が4を含むのは旧構成の名残であり、画面の番号とは対応しない。

#### Scenario: リファクタ後もツリーのコース選択が動作する

- **WHEN** ユーザーがツリーでコースをクリックする
- **THEN** そのコースが選択され、コースのメタビューが表示される

#### Scenario: リファクタ後もレッスン編集が動作する

- **WHEN** ユーザーがエディタでレッスン本文を編集する
- **THEN** セッション内の `series` state が更新される

### Requirement: 保存済み選択の後方互換

`localStorage` に保存された選択状態が `seriesId` を持たない旧形式（`{ courseId, lessonId }`）であっても、読み込みが失敗してはならない（MUST NOT）。旧形式を読んだ場合は `courseId` から所属シリーズを逆引きして `seriesId` を補完しなければならない（SHALL）。逆引きできない場合はフォールバックの選択を使わなければならない（SHALL）。

#### Scenario: 旧形式の選択を読み込む

- **WHEN** `localStorage` に `{ courseId, lessonId }` のみが保存されている状態で起動する
- **THEN** エラーにならず、`courseId` の所属シリーズが `selectedSeriesId` に補完される

#### Scenario: 逆引きできない旧形式

- **WHEN** 保存された `courseId` が現在の `contents/` に存在しない
- **THEN** フォールバックの選択が使われる

### Requirement: 選択はサーバーの初期描画で復元する

保存済みの選択は、**サーバーの初期描画に反映されていなければならない**（SHALL）——`localStorage` だけに保存すると、サーバーはフォールバック（先頭レッスン）で描き、hydration 後に復元が届いた瞬間にツリーの選択表示と本文が移る。この切り替わりが表示されてはならない（MUST NOT）。

そのため、選択の保存は `localStorage` と **cookie の両方に同じ値**を書かなければならない（SHALL）。サーバーは cookie の値を現在のコンテンツ上で検証し（実在しないレッスン・コースはフォールバックへ）、初期選択として渡す（SHALL）。`localStorage` 側は後方互換と、cookie を読まない環境（デモ配信）でのクライアント側復元のために残す（SHALL）。

サーバーのフォールバック（保存値が無いときの選択）は、クライアントのフォールバックと**同じ規則**でなければならない（SHALL）——ずれると hydration 後に選択が移る。

#### Scenario: 保存済みの選択がサーバーの HTML に反映される

- **WHEN** あるレッスンを選択してからページの HTML をサーバーから取得する
- **THEN** その HTML ではそのレッスンの行が選択状態で描かれ、本文もそのレッスンである

#### Scenario: cookie の選択先が消えていればフォールバック

- **WHEN** cookie が指すレッスンがディスク上で削除された後にページを開く
- **THEN** サーバーはフォールバックの選択で描き、エラーにならない

#### Scenario: 保存は両方に書かれる

- **WHEN** レッスンを選択する
- **THEN** `localStorage` と cookie の両方に同じ選択が保存される

### Requirement: mutation コールバックは呼び出し時点の選択状態を用いる

`useLessonMutations`・`useSeriesMutations` のコールバックが選択状態（`selectedSeriesId` / `selectedCourseId` / `selectedLessonId`）を参照して選択や書き込み先を更新する場合、実行時点の値を用いなければならない（SHALL）。`useCallback` の依存配列から参照している選択状態を欠落させ、古いクロージャが過去の選択を引き回すことがあってはならない（MUST NOT）。選択状態に依存するコールバックは、依存配列にその選択状態を含めるか、ref 経由で最新値を参照しなければならない（SHALL）。

#### Scenario: シリーズ切替直後のレッスン追加

- **WHEN** ユーザーがシリーズ A を選択した後シリーズ B へ切り替え、シリーズ B のコースへレッスンを追加する
- **THEN** 追加後の選択はシリーズ B（切替後の選択シリーズ）の新レッスンを指す

#### Scenario: lint による担保

- **WHEN** `npx eslint .` を studio で実行する
- **THEN** `use-lesson-mutations.ts` に `react-hooks/exhaustive-deps` の選択状態欠落警告が存在しない

