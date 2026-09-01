# training-studio-pink-theme Specification

## Purpose
TBD - created by archiving change studio-pink-theme. Update Purpose after archive.
## Requirements
### Requirement: ピンクテーマの選択と排他適用

システムはテーマ値 `pink` を提供しなければならない（SHALL）。`ThemeMode` は `"light" | "dark" | "system" | "pink"` でなければならない（SHALL）。テーマが `pink` のとき、システムは `<html>` 要素に `pink` class を付与しなければならない（SHALL）。同時に `dark` class を付与してはならない（MUST NOT）。テーマが `pink` 以外のとき、`pink` class を付与してはならない（MUST NOT）。

`pink` は OS のカラースキーム設定（`prefers-color-scheme`）を参照してはならない（MUST NOT）。OS がダークに設定されていても、ピンクテーマはライト系のパレットで表示しなければならない（SHALL）。

`resolveThemeClass()` の戻り値型は `"light" | "dark" | "pink"` でなければならない（SHALL）。localStorage に永続化されたテーマ値が `pink` のとき、読み込み時に有効値として正規化しなければならない（SHALL）。

#### Scenario: ピンクテーマを適用する

- **WHEN** ユーザーが設定でテーマを「ピンク」に変更する
- **THEN** `<html>` に `pink` class が付与される
- **AND** `dark` class は付与されない

#### Scenario: OS のダーク設定を無視する

- **WHEN** OS のカラースキームがダークであり、ユーザーがテーマを「ピンク」に設定する
- **THEN** ワークスペースはダークではなくライト系の桜色パレットで表示される

#### Scenario: ピンクテーマが永続化される

- **WHEN** ユーザーがテーマを「ピンク」に変更してページを再読み込みする
- **THEN** ピンクテーマが保持される

#### Scenario: ダークからピンクへ切り替える

- **WHEN** テーマが `dark` の状態でユーザーが「ピンク」を選択する
- **THEN** `<html>` から `dark` class が除去され `pink` class が付与される

### Requirement: ピンクテーマのカラーロール

`.pink` は既存テーマと同じ役割トークンの一式（`--background`・`--foreground`・`--card`・`--canvas`・`--primary`・`--secondary`・`--accent`・`--muted`・`--border`・`--input`・`--ring`・`--header-action`・`--sidebar-*` など）を定義しなければならない（SHALL）。

広い面を覆うトークン（`--background`・`--muted`・`--secondary`・`--accent`・`--border`・`--input`）は低彩度の桜色を用いなければならない（SHALL）。高彩度のショッキングピンクは塗り役のトークン（`--primary`・`--ring`）に限定しなければならない（SHALL）。`--background` および `--muted` に高彩度のピンクを用いてはならない（MUST NOT）。

文字役のトークン（`--foreground`・`--muted-foreground`・`--secondary-foreground`・`--accent-foreground`・`--header-action`）は、対応する背景に対して WCAG AA のコントラスト比 4.5:1 以上を満たさなければならない（SHALL）。`--primary-foreground` は `--primary` に対して 4.5:1 以上を満たさなければならない（SHALL）。

`--primary-hover`・`--button-outline-hover`・`--workspace-tree-row`・`--workspace-scrollbar-*` は `:root` 側の `color-mix()` による導出をそのまま用いなければならない（SHALL）。`.pink` にこれらのピンク専用の実値を書き出してはならない（MUST NOT）。

#### Scenario: 背景は低彩度の桜色

- **WHEN** ピンクテーマでワークスペースを表示する
- **THEN** ページ背景は淡い桜色であり、高彩度のショッキングピンクで塗りつぶされていない

#### Scenario: プライマリボタンはショッキングピンク

- **WHEN** ピンクテーマでプライマリボタンを表示する
- **THEN** ボタンの塗りは高彩度のピンクであり、ラベルは白でコントラスト比 4.5:1 以上である

#### Scenario: 導出トークンが追従する

- **WHEN** ピンクテーマでツリー行のホバー状態とスクロールバーを表示する
- **THEN** 適用される色はピンクテーマのトークンから `color-mix()` で算出された値である

### Requirement: ピンクテーマでも destructive は赤のままとする

`--destructive` と `--destructive-foreground` は、ピンクテーマでも既定テーマと同じ赤系の値を保たなければならない（SHALL）。`--destructive` をピンク系に変更してはならない（MUST NOT）。

削除操作の色（削除コンテキストメニュー項目、削除確認ダイアログなど）は destructive トークンに従い、`--primary` と視覚的に区別できなければならない（SHALL）。

#### Scenario: 削除メニュー項目が赤のまま

- **WHEN** ピンクテーマでツリー行を右クリックし削除項目をホバーする
- **THEN** ホバー時の色は赤（destructive）でありピンクにならない

#### Scenario: 確定と削除が区別できる

- **WHEN** ピンクテーマでプライマリボタンと削除ボタンを並べて表示する
- **THEN** 両者は彩度と色相の差によって別の色として区別できる

### Requirement: ステータス色とアラート色はテーマ間で一定とする

`--status-done`・`--status-wip`・`--status-draft` と、レッスンプレビューの GitHub アラート色（`--alert-note`・`--alert-tip`・`--alert-important`・`--alert-warning`・`--alert-caution`）は、ピンクテーマでもライトテーマと同じ値でなければならない（SHALL）。これらをピンク系に変更してはならない（MUST NOT）。

#### Scenario: 完了ステータスが緑のまま

- **WHEN** ピンクテーマで完了ステータスのバッジを表示する
- **THEN** バッジの色はライトテーマと同じ緑である

### Requirement: ハートアイコンはピンクモードに限る

テーマが `pink` のとき、システムは処理中スピナーを `Loader2` から `HeartPulse` に差し替えなければならない（SHALL）。テーマが `pink` 以外のとき、元の `Loader2` を表示しなければならない（SHALL）。

ピンクテーマではスピナーのアニメーションも `animate-spin` から `animate-pulse` へ差し替えなければならない（SHALL）。ハートを回転させてはならない（MUST NOT）。

テーマ種別をレンダリング中に同期的に読んではならない（MUST NOT）。既存の `<html>` class 監視機構（`use-resolved-dark-mode.ts` から一般化した `useThemeKind()`）を通じて取得しなければならない（SHALL）。

#### Scenario: スピナーが鼓動する

- **WHEN** ピンクテーマで Agent が応答を生成中である
- **THEN** `HeartPulse` アイコンが `animate-pulse` で表示され、回転しない

#### Scenario: 既定テーマはスピナーのまま

- **WHEN** ライトまたはダークテーマで処理中スピナーを表示する
- **THEN** 従来どおり `Loader2` が `animate-spin` で表示される

#### Scenario: テーマ切替にアイコンが追従する

- **WHEN** ワークスペース表示中にユーザーがテーマをライトからピンクへ切り替える
- **THEN** リロードなしでスピナーがハートに変わる

### Requirement: アフォーダンスを担うアイコンは差し替えない

方向・動作・状態を伝えるアイコンを、ピンクテーマでハート系に差し替えてはならない（MUST NOT）。少なくとも `ChevronRight`・`ChevronDown`・`Search`・`Copy`・`X`・`Check`・`Trash2`・`Pencil`・`ArrowUp` は全テーマで同一でなければならない（SHALL）。

とくに削除操作の `Trash2` アイコンをハート系に差し替えてはならない（MUST NOT）。

#### Scenario: ツリーの開閉アイコンが変わらない

- **WHEN** ピンクテーマでフォルダ行を表示する
- **THEN** 開閉アイコンは `ChevronRight` と `ChevronDown` のままである

#### Scenario: 削除アイコンが変わらない

- **WHEN** ピンクテーマでツリー行を右クリックする
- **THEN** 削除項目のアイコンは `Trash2` のままである

### Requirement: ピンクテーマではエディタとシンタックスハイライトをライト扱いとする

ピンクテーマにおいて、CodeMirror エディタ・highlight.js のシンタックスハイライト・Mermaid 図はライトテーマと同じ色で表示しなければならない（SHALL）。ピンク専用のシンタックス配色を定義してはならない（MUST NOT）。

`useResolvedDarkMode()` はテーマが `pink` のとき `false` を返さなければならない（SHALL）。

#### Scenario: エディタがライト配色で表示される

- **WHEN** ピンクテーマで Pane3 の編集ビューを開く
- **THEN** エディタの背景とシンタックス配色はライトテーマと同一である

#### Scenario: ダーク判定が false

- **WHEN** テーマが `pink` である
- **THEN** `useResolvedDarkMode()` は `false` を返す

