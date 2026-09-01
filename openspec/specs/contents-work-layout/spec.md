# contents-work-layout Specification

## Purpose

トレーニングスキル（`dx-training-plan` / `dx-training-create`）が生む作業ファイルの置き場である `contents-work/` のディレクトリ規約を定める。`plans/` と `runs/` の役割分担、識別子をフォルダ名が持つ命名原則、run ディレクトリ内のファイル名規約、git 追跡の方針を扱う。特定スキルに属さない横断的な取り決めであり、`training-plan-skill` / `training-create-skill` はここを参照する。レッスン草稿の着地先（`contents/`）は `content-folder-loader` と `training-create-skill` の担当領域。

本 capability は `contents-plan-layout` を改名したもの（2026-08-13・`contents-work-rename`）。
## Requirements
### Requirement: contents-work ディレクトリの構成

トレーニングスキルの作業ファイルは `contents-work/` 配下に置かなければならない（SHALL）。`contents-work/plans/` には計画書を、`contents-work/runs/` には1実行分の作業ファイルを、`contents-work/sessions/` には Agent の会話履歴を置かなければならない（SHALL）。`docs/` 配下および `workspace/` 配下に作業ファイルを新規に出力してはならない（SHALL NOT）。

会話履歴を `contents/`（教材の正本ツリー）配下に置いてはならない（MUST NOT）——教材ツリーにアプリの管理ファイルが混ざると、フォルダの退避・リネームで会話が道連れになる。

#### Scenario: 作業ファイルの置き場を確認する
- **WHEN** `contents-work/` を開く
- **THEN** `plans/` と `runs/` と `sessions/` の 3 つのディレクトリが存在する

#### Scenario: docs 配下へ出力しない
- **WHEN** スキルが計画書または設計メモを出力する
- **THEN** 出力先は `contents-work/` 配下であり、`docs/` 配下には作られない

#### Scenario: 会話履歴は教材ツリーに置かれない
- **WHEN** Agent の会話が保存される
- **THEN** 保存先は `contents-work/sessions/` 配下であり、`contents/` 配下には作られない

### Requirement: 識別子はフォルダ名が持つ

`contents-work/runs/` 配下の 1 実行分は `<yyyymmdd>-<slug>/` 形式のディレクトリでなければならない（SHALL）。ディレクトリ内のファイル名は役割のみを表さなければならず（SHALL）、対象名・範囲・実行回数をファイル名に含めてはならない（SHALL NOT）。同日に同じ対象を再実行する場合は、ファイル名に連番を付けるのではなく別のディレクトリを作らなければならない（SHALL）。

#### Scenario: run ディレクトリの命名
- **WHEN** `dx-training-create` を 2026-08-10 に `onenote-basic` を対象として実行する
- **THEN** `contents-work/runs/20260810-onenote-basic/` が作られる

#### Scenario: 同日に同じ対象を再実行する
- **WHEN** `contents-work/runs/20260810-onenote-basic/` が既に存在する状態で同じ対象を再実行する
- **THEN** 既存ディレクトリ内のファイルに連番を付けるのではなく、別の run ディレクトリが作られる
- **AND** 既存の run ディレクトリは変更されない

### Requirement: run ディレクトリ内のファイル名規約

`contents-work/runs/<run>/` 配下の構成は次でなければならない（SHALL）: 設計メモは直下に `design-note.md`、曼陀羅案は直下に `mandala.md`、レビューは **`reviews/` サブディレクトリ配下にレッスンごとに `<レッスン名>.md`**。設計メモを `training-draft.md` のように草稿と紛らわしい名前にしてはならない（SHALL NOT）。

レビューをサブディレクトリに畳むのは、**レッスン本数に比例して増える唯一のファイル種別**だからである。run につき1つしか生まれない設計メモ・曼陀羅案に対しては、サブディレクトリを作ってはならない（SHALL NOT）。

レビューのファイル名に `review-` の接頭辞を付けてはならない（SHALL NOT）——役割は `reviews/` が表す。

#### Scenario: run の中身を確認する
- **WHEN** コース単位の実行が完了した run ディレクトリを開く
- **THEN** 直下に `design-note.md` と `mandala.md` が 1 つずつ存在する
- **AND** `reviews/` に、執筆したレッスンの本数分の `<レッスン名>.md` が存在する

#### Scenario: 読み手が設計メモを一意に特定できる
- **WHEN** run ディレクトリから設計メモを探す
- **THEN** 範囲や実行回数を考慮せず直下の `design-note.md` を読めばよい
- **AND** レビューの本数が増えても直下のファイル数は変わらない

#### Scenario: 既存 run は移行しない
- **WHEN** レビューが直下に `review-<レッスン名>.md` として置かれた過去の run が存在する
- **THEN** その run はそのまま残してよく、新しい構成へ移し替えることを要求しない

### Requirement: 計画書のファイル名規約

`contents-work/plans/` 配下の計画書は `<yyyymmdd>-<slug>.md` 形式でなければならない（SHALL）。適切な slug が定まらない移設済みの既存計画書については、日付のみのファイル名を許容する。

#### Scenario: 計画書を出力する
- **WHEN** `dx-training-plan` が 2026-08-10 に `onenote` の計画書を出力する
- **THEN** `contents-work/plans/20260810-onenote.md` が作られる

### Requirement: git 追跡の方針

`contents-work/plans/` は git の追跡対象でなければならない（SHALL）。`contents-work/runs/` および `contents-work/sessions/` は追跡対象から除外しなければならない（SHALL）。`.gitignore` のパターンは先頭スラッシュ付きの anchored 形式（`/contents-work/runs/`・`/contents-work/sessions/`）で記述しなければならない（SHALL）——非 anchored のディレクトリ名は任意の深さの同名ディレクトリにマッチし、Tailwind のソース走査から意図しないディレクトリを除外する事故が過去に発生している。

#### Scenario: 計画書は追跡される
- **WHEN** `contents-work/plans/` に計画書を追加する
- **THEN** `git status` に未追跡ファイルとして現れる

#### Scenario: run は追跡されない
- **WHEN** `contents-work/runs/` に設計メモを出力する
- **THEN** `git status` に現れない

#### Scenario: 会話履歴は追跡されない
- **WHEN** Agent の会話が `contents-work/sessions/` に保存される
- **THEN** `git status` に現れない

#### Scenario: gitignore は anchored で書く
- **WHEN** `.gitignore` の `contents-work` 関連の行を確認する
- **THEN** `/contents-work/runs/` と `/contents-work/sessions/` が先頭スラッシュ付きで記述されている

