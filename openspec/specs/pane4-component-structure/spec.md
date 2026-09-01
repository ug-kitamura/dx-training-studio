# pane4-component-structure Specification

## Purpose

DX Training Studio の Pane4（ImageManagerPane）内部モジュール構成を定義する。`useImageLists`・`usePromoteAndInsert` によるロジック集約、タブコンポーネント分割、および `lib/image-list-client.ts` を用いたスコープ単位 fetch の責務境界を規定する。ユーザー向け挙動は `training-studio-image-pane` に従い、本 spec は実装構造の要件を扱う。
## Requirements
### Requirement: 画像リスト取得は useImageLists hook に集約する

Pane4 の画像リスト state（`promotedFiles`・`stagingFiles`・`aiStagingFiles`・`webStagingFiles`）および `refreshScope` / `refreshScopes` は `useImageLists` hook に集約しなければならない（SHALL）。hook は `lib/image-list-client.ts` の `fetchImageList`・`scopesAfterPromote` を用いなければならない（SHALL）。Pane4 開閉およびアクティブタブ変更時は **アクティブタブの 1 スコープのみ** fetch しなければならない（SHALL）。レッスン編集による `series` 変更を fetch トリガーにしてはならない（MUST NOT）。

#### Scenario: アクティブタブのみ fetch する

- **WHEN** ユーザーが Pane4 を開き Used タブが表示されている
- **THEN** `scope=used` の list API のみ呼び出される
- **AND** staging 用 3 スコープの list API は呼び出されない

#### Scenario: タブ切替で該当スコープを fetch する

- **WHEN** ユーザーが Used タブから AI タブに切り替える
- **THEN** `scope=staging&source=ai` の list API が呼び出される

#### Scenario: series 変更では list API を再取得しない

- **WHEN** Pane4 が開いたまま Pane3 でレッスン本文を編集する
- **THEN** list API は追加で呼び出されない
- **AND** Used タブの参照回数表示はクライアント側 `useMemo` で更新される

### Requirement: promote 挿入は usePromoteAndInsert hook に集約する

staging 画像からの promote → Markdown 挿入フロー（UP・AI・Web の 3 パターン）は `usePromoteAndInsert` hook に 1 箇所で実装しなければならない（SHALL）。hook は staging ソース（`uploaded` / `ai` / `web`）と任意の alt 解決関数を受け取り、成功時に `scopesAfterPromote` で定義されたスコープを silent refresh しなければならない（SHALL）。

挿入可否（レッスン選択中かつ編集モード）は **hook の呼び出し前** に判定しなければならない（SHALL）。挿入できない状態で promote を実行してはならない（MUST NOT）。hook 内に挿入失敗時の通知を持ってはならない（MUST NOT）。

#### Scenario: AI staging から promote 挿入

- **WHEN** ユーザーが AI タブの staging 画像で挿入する
- **THEN** `POST /api/images/promote` が呼び出される
- **AND** Markdown が挿入される
- **AND** `ai` と `used` スコープが refresh される

#### Scenario: promote 失敗時にタブ内通知

- **WHEN** promote API がエラーを返す
- **THEN** 対象タブの `TabNoticeBanner` にエラーが表示される
- **AND** Markdown 挿入は行われない

#### Scenario: 挿入できない状態では promote も走らない

- **WHEN** Pane 2 が編集モード以外である、またはレッスンが選択されていない
- **THEN** 挿入操作は無効状態で表示される
- **AND** `POST /api/images/promote` は呼び出されない
- **AND** 正本 `images/` に孤児ファイルは作られない

### Requirement: 挿入可否は 1 箇所で導出する

Pane4 の挿入可否は、**レッスンの有無** と **Pane 2 のモード** から 1 箇所で導出し、グリッド・拡大プレビューの双方へ同じ値を渡さなければならない（SHALL）。エディタ側が登録する挿入コールバックの有無だけを可否の根拠にしてはならない（MUST NOT）——当該コールバックはエディタのアンマウント後も残るため、可否の判定に使うと「成功を返すが本文には反映されない」状態が生じる。

Pane 2 の挿入受け口（`insertImageMarkdown` 相当）も、モードに加えてレッスンの有無を検査しなければならない（SHALL）。

#### Scenario: エディタ離脱後に挿入が成功扱いにならない

- **WHEN** ユーザーがレッスンを編集モードで開いた後、ホームを選択する
- **AND** 何らかの経路で挿入が要求される
- **THEN** 挿入は成功として扱われない
- **AND** promote 済みファイルだけが残る状態にならない

#### Scenario: 可否がグリッドと拡大プレビューで一致する

- **WHEN** 挿入が無効な状態である
- **THEN** グリッド行と拡大プレビューの挿入操作はいずれも無効状態で表示される

### Requirement: タブ UI は専用コンポーネントに分割する

Pane4 の 4 タブ（Used・UP・AI・Web）のコンテンツ領域は、それぞれ専用コンポーネント（`UsedImagesTab`・`UploadImagesTab`・`AiImagesTab`・`WebImagesTab`）に分割しなければならない（SHALL）。`ImageManagerPane` は画像コンテンツ・共有 AlertDialog・ImageLightbox・hook 配線に限定しなければならない（SHALL）。Used / UP / AI / Web の **タブバー**（`ImageTabBar`）および **Pane4 折りたたみ** は `Pane4Shell`（または同等の Pane 4 統合シェル）が所有しなければならない（SHALL）。

#### Scenario: ImageManagerPane がコンテンツ専用になる

- **WHEN** 開発者が `ImageManagerPane.tsx` を開く
- **THEN** Used / UP / AI / Web のタブバー UI は存在しない
- **AND** 各タブの詳細 UI は対応する `*ImagesTab.tsx` に存在する

#### Scenario: Pane4Shell が chrome を所有する

- **WHEN** 開発者が Pane 4 統合シェルを開く
- **THEN** Agent / 画像切替、画像タブバー（`ImageTabBar`）、Pane4Toggle、Agent セッションタイトル表示が定義されている

### Requirement: 既存のユーザー向け挙動を維持する

本変更は内部構造のリファクタであり、`training-studio-image-pane` および関連 spec で定義されたユーザー向け挙動（promote・削除・フィルタ・通知・グリッド等）を変更してはならない（MUST NOT）。

#### Scenario: リファクタ後も promote 挿入が同等に動作する

- **WHEN** ユーザーが UP タブの staging 画像を挿入する
- **THEN** Step 0 以前と同様に正本へコピーされ Markdown が挿入される

#### Scenario: リファクタ後も Used フィルタが同等に動作する

- **WHEN** ユーザーが Used タブでシリーズ・コース・レッスンフィルタを操作する
- **THEN** Step 0 以前と同様の行が表示される

### Requirement: AI タブの API ロジックは useAiImageTab hook に集約する

AI タブのプロンプト state、generate / 自動入力 / リセット、staging alt 更新、および `/api/images/generate`・`/api/images/suggest-prompt` 呼び出しは `useAiImageTab` hook に集約しなければならない（SHALL）。`AiImagesTab` は hook を内部で利用し、シェルから prompt / generating 等の props を受け取ってはならない（MUST NOT）。

#### Scenario: シェルに AI プロンプト state がない

- **WHEN** 開発者が `ImageManagerPane` シェルを開く
- **THEN** `aiPrompt` / `generating` / `suggesting` の useState がシェルに存在しない
- **AND** 当該 state は `useAiImageTab` 内にある

#### Scenario: AI 生成成功時に staging を refresh する

- **WHEN** ユーザーが AI タブで画像生成に成功する
- **THEN** `refreshScope("ai")` が silent で呼び出される
- **AND** 成功通知が AI タブ内に表示される

### Requirement: Web タブの API ロジックは useWebImageTab hook に集約する

Web タブのプロンプト state、search / 自動入力 / リセット、staging alt 更新、および `/api/images/search`・`/api/images/suggest-web-prompt` 呼び出しは `useWebImageTab` hook に集約しなければならない（SHALL）。`WebImagesTab` は hook を内部で利用しなければならない（SHALL）。

#### Scenario: シェルに Web プロンプト state がない

- **WHEN** 開発者が `ImageManagerPane` シェルを開く
- **THEN** `webPrompt` / `searching` / `webSuggesting` の useState がシェルに存在しない

### Requirement: UP タブのアップロードロジックは useUploadImagesTab hook に集約する

UP タブのファイルアップロード（`/api/images/upload`）、クリップボード paste 処理、MP4 サイズ検証は `useUploadImagesTab` hook に集約しなければならない（SHALL）。成功時は `refreshScope("uploaded")` と UP タブへの切替を行わなければならない（SHALL）。

#### Scenario: アップロード成功後に UP タブへ切替

- **WHEN** ユーザーが画像をアップロードする
- **THEN** staging リストが refresh される
- **AND** アクティブタブが upload になる

### Requirement: ImageManagerPane シェルは横断 concern のみ保持する

`ImageManagerPane` は Used フィルタ state、共有 Lightbox / 削除 Dialog、`useImageLists`、`usePromoteAndInsert`、およびタブコンポーネントの配置に限定しなければならない（SHALL）。タブ専用 API ロジックをシェルに残してはならない（MUST NOT）。**Pane 4 統合シェル**（`Pane4Shell`）は Agent / 画像ビュー切替、`AgentChatPane` 配置、画像タブ state、`ImageManagerPane` への `activeTab` 受け渡しを担当しなければならない（SHALL）。

#### Scenario: 責務が Pane4Shell と ImageManagerPane に分離される

- **WHEN** 開発者が Pane 4 関連コンポーネントを開く
- **THEN** タブバーと Agent / 画像切替は Pane4Shell にある
- **AND** ImageManagerPane は props で受け取った activeTab に応じてタブコンテンツのみ描画する

### Requirement: AgentChatPane は履歴サブヘッダーを持つ

`AgentChatPane` はビュー内トップに **履歴ドロップダウン**（左）と **新規** ボタン（右）を配置しなければならない（SHALL）。セッションタイトルの表示は `AgentChatPane` 内に含めてはならない（MUST NOT）。セッションタイトルは `Pane4Shell` ヘッダー左が `AgentChatController` 経由で表示しなければならない（SHALL）。

#### Scenario: AgentChatPane 内に履歴サブヘッダーがある

- **WHEN** 開発者が `AgentChatPane.tsx` を開く
- **THEN** 履歴ドロップダウンと新規ボタンの JSX がビュー内トップに存在する
- **AND** セッションタイトル表示の JSX は存在しない

#### Scenario: セッションタイトルは Pane4Shell ヘッダーにある

- **WHEN** Agent ビューが表示されている
- **THEN** セッションタイトルは `Pane4Shell` ヘッダー左に表示される
- **AND** `AgentChatPane` 内には表示されない

