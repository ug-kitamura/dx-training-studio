# training-studio-web-image-search Specification

## Purpose
TBD - created by archiving change pane4-web-image-search. Update Purpose after archive.
## Requirements
### Requirement: Web タブは Pixabay から最大 3 枚を staging 保存する

`POST /api/images/search` は、リクエスト body の **prompt**（Web タブの説明文）を受け取らなければならない（SHALL）。**lesson**（未保存 `content` 全文）は **任意** とし、含まれるときは受け取らなければならない（SHALL）。**AI API キー**および **Pixabay API キー**（各解決優先順位は workspace-settings に従う）のいずれかが未設定のときは、不足しているキーに応じて 401 等で失敗しなければならない（SHALL）。

サーバーは Claude により Pixabay 向けの検索計画（1〜3 件のクエリ、各 `photo` または `illustration`）を生成し、Pixabay API を呼び出して候補を取得しなければならない（SHALL）。検索計画の作成において、`lesson` が含まれるときはレッスン文脈（レッスン名・説明・タグ）と `content` 全文をプランナー入力に含めなければならない（SHALL）。`lesson` が含まれないときはこれらを含めてはならず（MUST NOT）、著者が入力した説明文のみから計画を立てなければならない（SHALL）。同一検索実行で **新規に staging へ保存する画像は最大 3 枚** とし、3 枚未満の取得でも成功として返してよい（MAY）。Markdown 本文は変更してはならない（MUST NOT）。

写実的な日常・ビジネスシーンを優先し、抽象・非現実・SF・過度な 3D 表現は避けるようプランナー指示に含めなければならない（SHALL）。イラストが明らかに適切な場合のみ `image_type=illustration` を用い、それ以外は `photo` を用いなければならない（SHALL）。

#### Scenario: 検索成功で web staging に保存される

- **WHEN** ユーザーが Web タブで説明文を入力し検索を実行する
- **AND** Claude プランナーと Pixabay API が成功する
- **THEN** `images/web/` に 1 件以上 3 件以下の画像ファイルが保存される
- **AND** レスポンスに保存した `ImageAsset` 一覧が含まれる

#### Scenario: レッスンなしで検索する

- **WHEN** レッスンを選択していない状態で説明文を入力し検索を実行する
- **THEN** リクエスト body に `lesson` が含まれない
- **AND** API は 400 で拒否せず検索を実行する
- **AND** プランナー入力にレッスン文脈ブロックと本文全文は含まれない

#### Scenario: 3 枚上限

- **WHEN** プランナーが 3 件のクエリを生成する
- **AND** 各クエリで候補が得られる
- **THEN** 当該検索実行で staging に追加される新規ファイルは 3 件を超えない

#### Scenario: Pixabay キー未設定で拒否

- **WHEN** Pixabay API キーが未設定である
- **AND** ユーザーが検索を試みる
- **THEN** 検索 API は 401 等で失敗する
- **AND** 設定を促すメッセージが Web タブ内に表示される

### Requirement: Web 検索は Pixabay のみを用いる

v1 の素材取得は **Pixabay API のみ** を検索先としなければならない（SHALL）。Pexels・いらすとや・任意 URL スクレイピングは用いてはならない（MUST NOT）。

#### Scenario: Pixabay 以外を呼ばない

- **WHEN** 検索 API が実行される
- **THEN** 外部 HTTP 呼び出しの素材検索先は `pixabay.com/api` のみである

### Requirement: Web タブの挿入は UP タブと同等である

Web タブ staging 画像の挿入操作は、UP タブ・AI タブと同様に `images/web/<filename>` を `images/<filename>` へコピー（promote）し、staging 側を削除してはならない（MUST NOT）。続けて編集モードの CodeMirror において、選択範囲があればその範囲を、なければカーソル位置に `![{alt}](images/{filename})` を挿入しなければならない（SHALL）。`alt` は検索 API が返した短い説明を用いなければならない（SHALL）。HTML コメント `<!-- … -->` を挿入操作だけで削除してはならない（MUST NOT）。プレビュー・差分モードでは挿入してはならない（MUST NOT）。

#### Scenario: Web staging から挿入で promote される

- **WHEN** ユーザーが編集モードで Web タブから staging 画像を挿入する
- **THEN** `images/<filename>` が作成される
- **AND** `images/web/<filename>` は残る
- **AND** 既存の `<!-- プロンプト -->` コメントはそのまま残る

### Requirement: Web タブはプロンプト自動入力とリセットを提供する

Web タブのプロンプト入力エリア直下に、左から **検索**・**自動入力**・**リセット** の操作を同一行・左寄せで配置しなければならない（SHALL）。**検索** のみ primary（強調）スタイルとし、Lucide **`Search`** アイコンを用いなければならない（SHALL）。**自動入力**・**リセット** は非 primary としなければならない（SHALL）。

**自動入力** を実行したとき:

- 編集モードでカーソルが HTML コメント `<!-- … -->` **内** にある場合、プロンプト欄に当該コメントの内部テキスト（trim 済み）を設定しなければならない（SHALL）。Claude 呼び出しは行ってはならない（MUST NOT）。
- カーソルがコメント **外** にある場合、`POST /api/images/suggest-web-prompt` を呼び出し、返却された説明文でプロンプト欄を **上書き** しなければならない（SHALL）。

**リセット** を実行したとき、プロンプト欄を空文字列にしなければならない（SHALL）。

検索中・自動入力中は相互に操作を無効化し、進行中表示（スピナー等）を当該ボタン付近に示さなければならない（SHALL）。

#### Scenario: コメント内で自動入力

- **WHEN** 編集モードでカーソルが `<!-- 会議室で打ち合わせ -->` 内にある
- **AND** ユーザーが自動入力を実行する
- **THEN** プロンプト欄に `会議室で打ち合わせ` が設定される
- **AND** suggest-web-prompt API は呼ばれない

#### Scenario: コメント外で自動入力

- **WHEN** 編集モードでカーソルが HTML コメント外にある
- **AND** ユーザーが自動入力を実行する
- **THEN** suggest-web-prompt API が lesson と cursorOffset を受け取る
- **AND** 返却 prompt でプロンプト欄が上書きされる

### Requirement: Web プロンプト提案 API を提供する

`POST /api/images/suggest-web-prompt` は、リクエスト body の **lesson**（未保存 `content` 全文）と任意の **cursorOffset**（CodeMirror 文字 offset、省略時 0）を受け取らなければならない（SHALL）。Anthropic API キーが未設定のときは 401 等で失敗しなければならない（SHALL）。

成功時は `{ prompt: string }` を返さなければならない（SHALL）。`prompt` は Web タブの **画像検索条件説明文**（人間が読める短い日本語文。Pixabay キーワード列ではない）でなければならない（SHALL）。Markdown 本文は変更してはならない（MUST NOT）。

Claude 呼び出しには、レッスン metadata・全文 body・カーソル付近のテキストスニペットを含めなければならない（SHALL）。

#### Scenario: suggest-web-prompt 成功

- **WHEN** Anthropic API キーが設定されている
- **AND** クライアントが lesson と cursorOffset を POST する
- **THEN** 200 で `{ prompt }` が返る
- **AND** prompt は非空の説明文である

### Requirement: コメント同期で Web プロンプト欄を更新する

編集モードでカーソルが HTML コメント `<!-- … -->` 内にあり、コメント内部テキストが抽出されたとき、Web タブのプロンプト欄は AI タブと同様に当該テキスト（trim 済み）へ同期されなければならない（SHALL）。コメント外にカーソルがある、または raw モードのときは、AI タブと同様に同期を行わない（SHALL）。

#### Scenario: コメント内カーソルで Web プロンプトが同期される

- **WHEN** ユーザーが `<!-- ノート PC で作業 -->` 内にカーソルを置く
- **THEN** Web タブのプロンプト欄に `ノート PC で作業` が表示される

### Requirement: 検索保存時に alt を返す

検索 API は各保存ファイルについて短い **alt** 文（挿入 Markdown 用、1 行）を返さなければならない（SHALL）。alt は Pixabay の tags または Claude 要約から生成してよい（MAY）。ファイル名は `images/web/` および正本 `images/` の既存名と衝突しないよう、既存の `resolveUniquePngFileName` 相当のユニーク化規則に従わなければならない（SHALL）。拡張子はダウンロード元に従い、`.jpg`・`.png`・`.webp` 等を許容してよい（MAY）。

#### Scenario: 検索結果に alt が含まれる

- **WHEN** 検索 API が 2 件の画像を staging 保存する
- **THEN** レスポンスの各エントリに `alt` 文字列が含まれる

