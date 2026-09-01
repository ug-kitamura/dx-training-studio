# training-studio-storage-migration Specification

## Purpose

`dx-training-editor` から `dx-training-studio` へのリネームに伴い、ブラウザ `localStorage` のキー名を移行する。起動時 migration とキー定数の集約を規定する。

## Requirements

### Requirement: 起動時に localStorage キーを旧名から新名へ移行する

アプリはクライアント初回 mount 時に `migrateLocalStorageIfNeeded()` を実行し、次のキーについて **新キーが存在せず旧キーが存在する** 場合に旧値を新キーへコピーしなければならない（SHALL）:

| 旧キー | 新キー |
|--------|--------|
| `dx-training-editor-settings` | `dx-training-studio-settings` |
| `dx-training-editor-pane-widths` | `dx-training-studio-pane-widths` |
| `dx-training-editor-agent-chat` | `dx-training-studio-agent-chat` |
| `dx-training-editor-selection` | `dx-training-studio-selection` |

migration 完了後も旧キーは削除してはならない（MUST NOT）。同一セッション内で migration は冪等でなければならない（SHALL）（新キーが既にあればコピーをスキップする）。

#### Scenario: 旧 settings のみ存在する

- **WHEN** `localStorage` に `dx-training-editor-settings` のみが存在する
- **AND** `dx-training-studio-settings` が存在しない
- **THEN** 起動後 `dx-training-studio-settings` に同一 JSON がコピーされる
- **AND** `dx-training-editor-settings` は残る

#### Scenario: 新キーが既にある

- **WHEN** `dx-training-studio-settings` が既に存在する
- **AND** `dx-training-editor-settings` も存在する
- **THEN** `dx-training-studio-settings` の値は上書きされない

#### Scenario: Agent 会話履歴が引き継がれる

- **WHEN** `dx-training-editor-agent-chat` にセッションが保存されている
- **AND** `dx-training-studio-agent-chat` が存在しない
- **THEN** 起動後 Agent ビューに以前の会話が表示される

### Requirement: storage キー定数を単一モジュールに集約する

`localStorage` キーおよび関連 `CustomEvent` 名は `lib/storage-keys.ts`（または同等モジュール）に定義し、各 consumer は文字列リテラルを直接持ってはならない（MUST NOT）。新キー接頭辞は `dx-training-studio` でなければならない（SHALL）。

#### Scenario: settings モジュールが集約キーを参照する

- **WHEN** `lib/workspace-settings.ts` が settings を読み書きする
- **THEN** ストレージキーは `lib/storage-keys.ts` から import される
