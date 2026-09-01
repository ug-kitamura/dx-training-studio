# training-studio-ai-image-generation Specification

## Purpose
TBD - created by archiving change pane4-ai-generation-and-settings. Update Purpose after archive.
## Requirements
### Requirement: API キー未設定時は生成できない

**AI API キー**（`AI_API_KEY` または `x-ai-api-key`、解決優先順位は workspace-settings に従う）が未設定のとき、生成 API は失敗を返さなければならない（SHALL）。AI タブは生成を実行し、失敗レスポンスに基づき設定ダイアログまたは `.env.local` への導線を示さなければならない（SHALL）。

#### Scenario: キー未設定で生成拒否

- **WHEN** AI API キーが未設定である
- **AND** ユーザーが生成を試みる
- **THEN** 生成 API は 401 等で失敗する
- **AND** 設定を促すメッセージが表示される

### Requirement: AI タブの挿入は UP タブと同等である

AI タブ staging 画像の挿入操作は、UP タブと同様に `images/ai/<filename>` を `images/<filename>` へコピー（promote）し、staging 側を削除してはならない（MUST NOT）。続けて編集モードの CodeMirror において、選択範囲があればその範囲を、なければカーソル位置に `![{alt}](images/{filename})` を挿入しなければならない（SHALL）。`alt` は生成 API が返した短い説明を用いなければならない（SHALL）——英語ビューで生成した画像の `alt` は英語である。HTML コメント `<!-- … -->` を挿入操作だけで削除してはならない（MUST NOT）。プレビュー・差分モードでは挿入してはならない（MUST NOT）。

#### Scenario: 挿入で promote と Markdown が追加される

- **WHEN** ユーザーが編集モードで AI タブから staging 画像を挿入する
- **THEN** `images/<filename>` が作成される
- **AND** カーソル位置または選択範囲に `![短い alt](images/<filename>)` が反映される
- **AND** `images/ai/<filename>` は残る
- **AND** 既存の `<!-- プロンプト -->` コメントはそのまま残る

#### Scenario: 英語ビューで生成した画像の alt は英語

- **WHEN** 英語ビューで画像を生成し、続けて挿入する
- **THEN** 挿入文字列の alt は生成 API が返した英語の短い説明である

#### Scenario: 挿入で promote と Markdown が追加される

- **WHEN** ユーザーが編集モードで AI タブから staging 画像を挿入する
- **THEN** `images/<filename>` が作成される
- **AND** カーソル位置または選択範囲に `![短い alt](images/<filename>)` が反映される
- **AND** `images/ai/<filename>` は残る
- **AND** 既存の `<!-- プロンプト -->` コメントはそのまま残る

### Requirement: AI タブはプロンプト入力と UP 同型 staging を提供する

AI タブは UP タブと同型のレイアウトとし、上部に **実線枠** のプロンプト入力エリア（複数行可）、その直下に **生成**・**自動入力**・**リセット** 操作（同一行・左寄せ、生成のみ primary）、下部に `images/ai/` の staging サムネイルグリッド（挿入・削除・拡大）を表示しなければならない（SHALL）。Markdown 内の画像スロット一覧を表示してはならない（MUST NOT）。生成中は **生成** ボタン付近にスピナーまたは同等の進行表示を示さなければならない（SHALL）。成功・失敗メッセージは AI タブ内バナーのみに表示し、他タブや Pane 共通ヘッダー直下に表示してはならない（MUST NOT）。

#### Scenario: プロンプトから生成できる

- **WHEN** ユーザーが AI タブにプロンプトを入力し生成を実行する
- **THEN** staging グリッドに新しい PNG が表示される
- **AND** スロット一覧 UI は表示されない

#### Scenario: 生成中にスピナーが表示される

- **WHEN** ユーザーが生成を実行する
- **AND** API 応答を待っている
- **THEN** 生成ボタン付近に進行中表示が出る

#### Scenario: AI タブの通知は AI ビュー内のみ

- **WHEN** AI タブで生成が成功または失敗する
- **AND** ユーザーが UP タブを表示している
- **THEN** 当該メッセージは UP タブには表示されない

### Requirement: 画像生成はプロンプトとレッスン全文を Claude に渡す

`POST /api/images/generate` は、リクエスト body の **prompt**（AI タブ入力）を受け取らなければならない（SHALL）。**lesson**（未保存 `content` 全文）は **任意** とし、含まれるときは受け取らなければならない（SHALL）。**language**（`ja` / `en`、省略時 `ja`）は任意とし、含まれるときは受け取らなければならない（SHALL）。`canonicalPath` やスロット ID を要求してはならない（MUST NOT）。生成のみでは Markdown を変更してはならない（MUST NOT）。

`lesson` が含まれるとき、Claude 呼び出しには著者プロンプトに加えてレッスン文脈（レッスン名・説明・タグ）と `content` 全文を含めなければならない（SHALL）。`lesson` が含まれないとき、これらの文脈ブロックを含めてはならない（MUST NOT）。このとき生成は **著者プロンプトのみ** を指示として実行しなければならない（SHALL）。`lesson` の有無によって出力形式（`slug` / `alt` / `html` の JSON）を変えてはならない（MUST NOT）。

`language` が `en` のとき、Claude への指示は**図中のテキストと `alt` を英語で書く**ものでなければならない（SHALL）。`ja`（省略時）では従来どおり日本語とする（SHALL）。`language` によって `slug` の規則（英語 kebab-case）と出力形式を変えてはならない（MUST NOT）。`lesson.content` は呼び出し側が**編集言語の本文**（en では `contents.en.md` の本文、原文ハッシュ行なし）を渡す（SHALL）——サーバーが言語に応じて正本ファイルを読みに行ってはならない（MUST NOT）。

#### Scenario: プロンプトと全文が API に含まれる

- **WHEN** ユーザーがレッスンを選択した状態でプロンプトを入力して生成する
- **THEN** Claude 呼び出しにプロンプト文字列とレッスン `content` 全文が含まれる

#### Scenario: 英語ビューでは英語テキストの図解を指示する

- **WHEN** 英語ビューでプロンプトを入力して生成する
- **THEN** 生成 API は `language: "en"` と英語本文を `content` に持つ `lesson` を受け取る
- **AND** Claude への system prompt は図中テキストと alt を英語で書くよう指示している

#### Scenario: language 省略時は従来どおり

- **WHEN** `language` を含めずに生成 API を呼ぶ
- **THEN** 日本語の指示（従来の system prompt）で生成される

`lesson` が含まれるとき、Claude 呼び出しには著者プロンプトに加えてレッスン文脈（レッスン名・説明・タグ）と `content` 全文を含めなければならない（SHALL）。`lesson` が含まれないとき、これらの文脈ブロックを含めてはならない（MUST NOT）。このとき生成は **著者プロンプトのみ** を指示として実行しなければならない（SHALL）。`lesson` の有無によって出力形式（`slug` / `alt` / `html` の JSON）を変えてはならない（MUST NOT）。

#### Scenario: プロンプトと全文が API に含まれる

- **WHEN** ユーザーがレッスンを選択した状態でプロンプトを入力して生成する
- **THEN** Claude 呼び出しにプロンプト文字列とレッスン `content` 全文が含まれる

#### Scenario: レッスンなしで生成する

- **WHEN** レッスンを選択していない状態でプロンプトを入力して生成する
- **THEN** リクエスト body に `lesson` が含まれない
- **AND** API は 400 で拒否せず生成を実行する
- **AND** Claude 呼び出しにレッスン文脈ブロックと本文全文は含まれない

#### Scenario: レッスンなしでも保存形式は同じ

- **WHEN** レッスンなしの生成が成功する
- **THEN** `images/ai/<filename>` に PNG が保存される
- **AND** レスポンスは `file` と `alt` を含む

### Requirement: visual-explainers グラフィックで PNG 化する

生成は Claude が **図 1 ブロック** 分の HTML 断片（`#capture-root` 内）を出力し、Playwright で PNG 化して `images/ai/<filename>` に保存しなければならない（SHALL）。デザイン品質規則の SSoT は `contracts/image-slot-contract.md` の「生成品質」セクションとし、リポジトリ外のスキル・HTML ファイルへの参照を用いてはならない（MUST NOT）。規則には構造図 + UI mock のグラフィック語彙、`custom.*` 配色・Lucide・surface カード、図内テキスト可・図外説明段落不可を含めなければならない（SHALL）。

HTML の横幅は **640〜960 CSS px を目安** とし、UI mock（エディタ・ターミナル等）は広め、フロー図・カードグリッドは狭めとする（SHALL）。768px 固定幅を要求してはならない（MUST NOT）。横並び過多で overflow しそうな場合は縦積みレイアウトを優先してよい（MAY）。

**左右にカードを並べて対比する図は、左右の要素の位置をそろえなければならない**（SHALL）。整列の実現方法（グリッド・固定高さ等）は指定してはならない（MUST NOT）——構成は生成側の裁量に委ねる。

Playwright キャプチャは `#capture-root` の `scrollWidth` / `scrollHeight`（body padding 込み）に viewport を合わせ、`deviceScaleFactor` 2 で **要素全体** を PNG 化しなければならない（SHALL）。固定 viewport 768×600 と `boundingBox` + `page.screenshot({ clip })` のみでキャプチャしてはならない（MUST NOT）。横方向または縦方向に overflow するコンテンツの端が PNG から欠落してはならない（MUST NOT）。

生成 PNG の物理ピクセル長辺は **2048px 以下** でなければならない（SHALL）。超過時はアスペクト比を維持して縮小しなければならない（SHALL）。

**図の地（外枠のカード・図全体の背景）はライトとし、アプリのダークテーマに依存してはならない**（SHALL）。ただし **UI mock の内側は、その UI が実際に既定とする配色で描かなければならない**（SHALL）——VS Code・Cursor・ターミナル・コマンドプロンプトはダーク、GitHub・Claude Code・Notepad++ はライト。エディタ・ターミナル・コードブロックの mock は**判断がつかない場合ダークとする**（SHALL）。受講者が実際に目にする画面と印象が食い違うと、図が実物の手がかりにならないため。

テキストは **図コンポーネント内**（ステップラベル・カード内短説明・UI mock 内ラベル等）に限り、4 ステップフロー例と同程度まで許容する（SHALL）。図コンポーネント **外** の導入段落・まとめ・キャプションを出力してはならない（MUST NOT）。任意で図全体のタイトル 1 行（h3 等）を含めてよい（MAY）。

#### Scenario: エディタの mock がダークで描かれる

- **WHEN** VS Code の画面を含む図解の生成を指示する
- **THEN** エディタ mock の内側はダーク配色で描かれる
- **AND** 図の外枠のカードと地はライトのままである

#### Scenario: ライトが既定のアプリはライトで描かれる

- **WHEN** GitHub の画面を含む図解の生成を指示する
- **THEN** その mock の内側はライト配色で描かれる

#### Scenario: 左右対比の図で位置がそろう

- **WHEN** 左右にカードを並べて対比する図解の生成を指示する
- **THEN** 左右のカードの対応する要素は同じ高さに置かれる

#### Scenario: 生成成功で ai staging に PNG ができる

- **WHEN** ユーザーがプロンプトで生成を実行する
- **AND** Claude と Playwright が成功する
- **THEN** `images/ai/<filename>.png` が staging に作成される

#### Scenario: 契約に従った HTML が生成される

- **WHEN** Claude が図解 HTML を生成する
- **THEN** 出力は単一 diagram ブロック内に収まる
- **AND** 図コンポーネント外に説明段落を含まない

#### Scenario: 横長 UI mock の右端が PNG に含まれる

- **WHEN** 生成 HTML の `#capture-root` の `scrollWidth` が viewport 初期幅（768 CSS px）を超える
- **AND** Playwright が PNG 化する
- **THEN** 出力 PNG の CSS 幅（物理幅 ÷ deviceScaleFactor）は `scrollWidth` 以上である
- **AND** 右端のコンテンツが欠落していない

#### Scenario: 縦長コンテンツの下端が PNG に含まれる

- **WHEN** 生成 HTML の `#capture-root` の `scrollHeight` が viewport 初期高（600 CSS px）を超える
- **AND** Playwright が PNG 化する
- **THEN** 出力 PNG の CSS 高さ（物理高 ÷ deviceScaleFactor）は `scrollHeight` 以上である
- **AND** 下端のコンテンツが欠落していない

#### Scenario: 長辺上限で正規化される

- **WHEN** キャプチャ直後の PNG 物理長辺が 2048px を超える
- **THEN** 保存前にアスペクト比を維持して長辺が 2048px 以下になるよう縮小される

### Requirement: 小さい生成 PNG は警告を返す

生成 PNG の CSS 幅（物理幅 ÷ deviceScaleFactor）が **480px 未満** のとき、生成 API は成功レスポンスに `warning` 文字列を含めなければならない（SHALL）。PNG は staging に保存し、生成自体は拒否してはならない（MUST NOT）。AI タブは `warning` がある場合、当該タブ内バナーに表示しなければならない（SHALL）。

#### Scenario: 小 PNG 生成時に警告が返る

- **WHEN** 生成 HTML が CSS 幅 480px 未満の PNG になる
- **AND** 生成 API が成功する
- **THEN** レスポンスに非空の `warning` が含まれる
- **AND** `images/ai/<filename>.png` は staging に作成される

#### Scenario: AI タブで警告バナーが表示される

- **WHEN** 生成 API が `warning` 付きで成功する
- **THEN** AI タブ内バナーに当該警告が表示される

#### Scenario: 通常サイズでは warning を含めない

- **WHEN** 生成 PNG の CSS 幅が 480px 以上である
- **AND** 生成 API が成功する
- **THEN** レスポンスに `warning` フィールドは含まれない、または空である

### Requirement: 生成時に AI がスラッグと alt を決定する

Claude 応答は HTML 断片に加え、**ファイルスラッグ**（`[a-z0-9-]+`、拡張子 `.png` はサーバー付与）と **短い alt 文**（挿入 Markdown 用、1 行）を構造化して返すか、サーバーが同等情報をパースしなければならない（SHALL）。保存ファイル名は `{slug}.png` とし、`images/` 直下および `images/uploaded/`・`images/ai/`・`images/web/` のいずれかに同名が存在する場合は `{slug}-2.png`・`{slug}-3.png` … と連番でユニーク化しなければならない（SHALL）。

#### Scenario: 初回 slug で保存

- **WHEN** AI が `git-push-flow` をスラッグとし、同名ファイルが存在しない
- **THEN** `images/ai/git-push-flow.png` に保存される

#### Scenario: 衝突時に連番

- **WHEN** `images/git-push-flow.png` が既に存在する
- **AND** AI が同じスラッグ `git-push-flow` を提案する
- **THEN** `images/ai/git-push-flow-2.png` に保存される

### Requirement: AI タブはプロンプト自動入力とリセットを提供する

AI タブのプロンプト入力エリア直下に、左から **生成**・**自動入力**・**リセット** の操作を同一行・左寄せで配置しなければならない（SHALL）。**生成** のみ primary（強調）スタイルとし、**自動入力**・**リセット** は非 primary としなければならない（SHALL）。

**自動入力** を実行したとき:

- 編集モードでカーソルが HTML コメント `<!-- … -->` **内** にある場合、プロンプト欄に当該コメントの内部テキスト（trim 済み）を設定しなければならない（SHALL）。Claude 呼び出しは行ってはならない（MUST NOT）。
- カーソルがコメント **外** にある場合、`POST /api/images/suggest-prompt` を呼び出し、返却されたプロンプト文字列でプロンプト欄を **上書き** しなければならない（SHALL）。

**リセット** を実行したとき、プロンプト欄を空文字列にしなければならない（SHALL）。

自動入力の Claude 呼び出し中は、生成と同様に進行中表示（スピナー等）を **自動入力** ボタン付近に示さなければならない（SHALL）。自動入力中・生成中は相互に操作を無効化してよい（MAY）。

#### Scenario: コメント内で自動入力

- **WHEN** 編集モードでカーソルが `<!-- 4 ステップのフロー -->` 内にある
- **AND** ユーザーが自動入力を実行する
- **THEN** プロンプト欄に `4 ステップのフロー` が設定される
- **AND** suggest-prompt API は呼ばれない

#### Scenario: コメント外で自動入力

- **WHEN** 編集モードでカーソルが HTML コメント外にある
- **AND** ユーザーが自動入力を実行する
- **THEN** suggest-prompt API が lesson と cursorOffset を受け取る
- **AND** 返却 prompt でプロンプト欄が上書きされる

#### Scenario: リセットでプロンプトが空になる

- **WHEN** プロンプト欄に文字列がある
- **AND** ユーザーがリセットを実行する
- **THEN** プロンプト欄は空になる

### Requirement: プロンプト提案 API を提供する

`POST /api/images/suggest-prompt` は、リクエスト body の **lesson**（未保存 `content` 全文）と任意の **cursorOffset**（CodeMirror 文字 offset、省略時 0）、任意の **language**（`ja` / `en`、省略時 `ja`）を受け取らなければならない（SHALL）。Anthropic API キーが未設定のときは 401 等で失敗しなければならない（SHALL）。

成功時は `{ prompt: string }` を返さなければならない（SHALL）。`prompt` は AI タブの画像生成プロンプトとしてそのまま用いられる図解指示文（HTML コメント相当）でなければならない（SHALL）。`language` が `en` のとき `prompt` は英語で書かれなければならない（SHALL）。Markdown 本文は変更してはならない（MUST NOT）。

Claude 呼び出しには、レッスン metadata・全文 body・カーソル付近のテキストスニペットを含めなければならない（SHALL）。`cursorOffset` は渡された `lesson.content`（編集言語の本文）に対するオフセットとして解釈しなければならない（SHALL）。

#### Scenario: suggest-prompt 成功

- **WHEN** API キーが設定されている
- **AND** クライアントが lesson と cursorOffset を POST する
- **THEN** 200 で `{ prompt }` が返る
- **AND** prompt は非空の文字列である

#### Scenario: 英語ビューの自動入力は英語のプロンプトを返す

- **WHEN** 英語ビューでカーソルがコメント外にあり、自動入力を実行する
- **THEN** suggest-prompt API は `language: "en"` と英語本文の `lesson` を受け取る
- **AND** 返る `prompt` は英語である

#### Scenario: キー未設定で suggest 拒否

- **WHEN** API キーが未設定である
- **AND** クライアントが suggest-prompt を POST する
- **THEN** 401 等で失敗する

成功時は `{ prompt: string }` を返さなければならない（SHALL）。`prompt` は AI タブの画像生成プロンプトとしてそのまま用いられる図解指示文（HTML コメント相当）でなければならない（SHALL）。Markdown 本文は変更してはならない（MUST NOT）。

Claude 呼び出しには、レッスン metadata・全文 body・カーソル付近のテキストスニペットを含めなければならない（SHALL）。

#### Scenario: suggest-prompt 成功

- **WHEN** API キーが設定されている
- **AND** クライアントが lesson と cursorOffset を POST する
- **THEN** 200 で `{ prompt }` が返る
- **AND** prompt は非空の文字列である

#### Scenario: キー未設定で suggest 拒否

- **WHEN** API キーが未設定である
- **AND** クライアントが suggest-prompt を POST する
- **THEN** 401 等で失敗する

