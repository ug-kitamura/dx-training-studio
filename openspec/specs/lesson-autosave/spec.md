# lesson-autosave Specification

## Purpose

Pane 3 編集操作に連動したレッスン本文・コースメタ・シリーズ順序の debounce 自動保存と、保存失敗時のユーザー通知の要件を規定する。
## Requirements
### Requirement: レッスン本文の自動保存

レッスン本文が編集されてから 800ms 以内に変更が静止した場合、`/api/content/save-lesson` を呼び出して `{lessonName}/contents.md` に保存しなければならない（SHALL）。

#### Scenario: 編集後 800ms で自動保存される

- **WHEN** ユーザーがレッスン本文を編集し、800ms 間タイピングを止める
- **THEN** 対応する `{lessonName}/contents.md` が更新されている

#### Scenario: 連続入力中は保存されない

- **WHEN** ユーザーが 800ms 未満の間隔で連続してテキストを入力し続ける
- **THEN** 最後の入力から 800ms が経過するまで API 呼び出しは発生しない

### Requirement: コースメタデータの自動保存
コースの `target`・`cross_series_prev`・`cross_series_next` が変更された場合、`/api/content/save-course` を呼び出して `.meta.json` を保存しなければならない（SHALL）。

#### Scenario: コースメタが変更されると保存される
- **WHEN** ユーザーが UI でコースの `target` を変更する
- **THEN** 対応するコースフォルダの `.meta.json` が更新されている

### Requirement: シリーズ順序の自動保存
シリーズの表示順が変更された場合、`/api/content/save-series-order` を呼び出して `_series-order.json` を更新しなければならない（SHALL）。

#### Scenario: シリーズ並び替え後に保存される
- **WHEN** ユーザーが UI でシリーズの表示順を変更する
- **THEN** `contents/_series-order.json` のシリーズ名配列が新しい順序で保存されている

### Requirement: 保存エラーのユーザー通知
自動保存の API 呼び出しが失敗した場合、ユーザーにエラーを通知しなければならない（SHALL）。

#### Scenario: 保存 API がエラーを返す
- **WHEN** `/api/content/save-lesson` が 5xx エラーを返す
- **THEN** UI にエラートーストが表示される


### Requirement: 英語モードの自動保存は contents.en.md へ向かう

編集言語が `en` のとき、レッスン本文の自動保存（800ms debounce）は同じ作法で `{lessonName}/contents.en.md` へ保存しなければならない（SHALL）。保存は原文ハッシュ行に触れてはならない（SHALL NOT）。ファイル不在時の生成規則（空なら作らない・非空ならハッシュ行なしで作成）は `studio-translation` capability に従う。

#### Scenario: 英語モードで自動保存される

- **WHEN** 英語モードで本文を編集し、800ms タイピングを止める
- **THEN** `contents.en.md` が更新され、`contents.md` は変わらない

#### Scenario: ハッシュ行が保たれる

- **WHEN** ハッシュ行を持つ `contents.en.md` を英語モードで編集して自動保存が走る
- **THEN** 1行目のハッシュ行は変わらない


### Requirement: 保存先はエディタ状態の復元をまたいでも編集言語に従う

レッスン本文の自動保存先（`contents.md` / `contents.en.md`）は、**その時点の編集言語だけ**で決まらなければならない（SHALL）。エディタがキャッシュ済みの `EditorState` を復元した場合でも、復元元のエディタインスタンスが持っていた保存先・コールバックに引きずられてはならない（SHALL NOT）。言語ビューを何度往復しても、英語ビューでの入力が `contents.md` へ保存されてはならない（MUST NOT）。

#### Scenario: 2回目の英語ビューでの編集が英語側へ保存される

- **WHEN** 日本語ビュー → 英語ビュー → 日本語ビュー → 英語ビューと切り替えた後、英語ビューで本文を編集し 800ms 止める
- **THEN** 保存は `language: "en"` で `contents.en.md` へ行われる
- **AND** `contents.md` への保存は発生しない

#### Scenario: 復元後の日本語ビューに英文が現れない

- **WHEN** 上の手順の後で日本語ビューへ戻る
- **THEN** エディタには日本語本文（`contents.md` の内容）が表示される
