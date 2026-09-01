# image-storage-backend Specification

## Purpose

正本画像（`images/<filename>`）の物理保存先をローカル fs または Vercel Blob（Private）で切り替えるバックエンド抽象化、API 契約、手動移行スクリプトを定義する。staging は常にローカル fs。
## Requirements
### Requirement: 正本ストレージバックエンドを抽象化する

システムは正本画像（`images/<filename>` 論理パス）の読み書き・一覧・削除について、**ローカル fs** バックエンドと **Vercel Blob（Private）** バックエンドを実装しなければならない（SHALL）。Blob 上のオブジェクトキーは論理パスと同一（例: `images/foo.png`）としなければならない（SHALL）。staging（`images/{uploaded,ai,web}/`）およびローカル `images/trash/` の操作は常にローカル fs とし、バックエンド抽象化の対象外としなければならない（SHALL）。

#### Scenario: ローカルバックエンドが正本を fs に保存する

- **WHEN** `storageMode` が `local` で promote が成功する
- **THEN** `images/<filename>` がプロジェクトルート配下の fs に存在する

#### Scenario: Blob バックエンドが正本を Blob に保存する

- **WHEN** `storageMode` が `storage` で promote が成功する
- **AND** `BLOB_READ_WRITE_TOKEN` が設定されている
- **THEN** Blob キー `images/<filename>` にオブジェクトが存在する
- **AND** fs の `images/<filename>` は作成されない

### Requirement: ストレージモードは資格情報必須とする

`storageMode` が `storage` の正本 API 呼び出しにおいて、`BLOB_READ_WRITE_TOKEN`（または将来のストレージ資格情報）が未設定または無効のとき、サーバーは **503** 等で失敗し、メッセージ **「ストレージに接続できません」** を返さなければならない（SHALL）。ローカル fs へのフォールバックを行ってはならない（MUST NOT）。

#### Scenario: トークンなしでストレージモード promote

- **WHEN** クライアントが `storageMode=storage` で promote を要求する
- **AND** `BLOB_READ_WRITE_TOKEN` が未設定である
- **THEN** レスポンスは失敗する
- **AND** エラーメッセージは「ストレージに接続できません」である

### Requirement: ストレージ接続確認 API を提供する

`GET /api/images/storage-check` は、ストレージモード用バックエンド（Vercel Blob）への接続可否を検証しなければならない（SHALL）。検証は正本一覧キャッシュの取得（キャッシュが有効ならバックエンド操作なし）で行い、失敗時は「ストレージに接続できません」を返さなければならない（SHALL）。

#### Scenario: トークンありで接続確認成功

- **WHEN** `BLOB_READ_WRITE_TOKEN` が有効である
- **AND** `GET /api/images/storage-check` が呼ばれる
- **THEN** レスポンスは成功する

#### Scenario: キャッシュ有効時は追加操作を発行しない

- **WHEN** 一覧キャッシュが TTL 内である
- **AND** `GET /api/images/storage-check` が呼ばれる
- **THEN** Blob への操作は発行されない
- **AND** レスポンスは成功する

### Requirement: 正本 API は storageMode を受け取る

次の API は `storageMode`（`local` | `storage`）を受け取り、正本操作のバックエンド選択に用いなければならない（SHALL）:

- `POST /api/images/promote`（body）
- `GET /api/images/list?scope=used`（query）
- `GET /api/images/file`（query、正本パスのみ）
- `DELETE /api/images/file`（query、正本パスのみ）

staging パス（`images/uploaded/` 等）に対する `GET` / `DELETE` は `storageMode` を無視し、常にローカル fs を用いなければならない（SHALL）。

#### Scenario: staging file GET は storageMode 無関係

- **WHEN** `GET /api/images/file?path=images/uploaded/foo.png` が呼ばれる
- **AND** クライアントの `storageMode` が `storage` である
- **THEN** サーバーはローカル fs からファイルを返す

### Requirement: 正本の同名 promote は上書きする

正本に同一 `images/<filename>` が既に存在する場合、promote は上書きしなければならない（SHALL）。ローカルモードでは fs 上書き、ストレージモードでは Blob `put` 上書きとする。

#### Scenario: ストレージモードで同名正本を上書き promote

- **WHEN** Blob に `images/foo.png` が既に存在する
- **AND** ユーザーが staging から `foo.png` を挿入する
- **THEN** Blob 上の `images/foo.png` が新内容で置換される

### Requirement: 手動アップロードスクリプトを提供する

`scripts/upload-local-images-to-blob.mjs`（`npm run upload-images-to-blob`）を提供し、fs の `images/` 直下の正本ファイル（予約ディレクトリ `uploaded`・`ai`・`web`・`trash` を除く）を Blob キー `images/<filename>` へアップロードできなければならない（SHALL）。`--dry-run` オプションで対象ファイル一覧のみ表示できなければならない（SHALL）。

#### Scenario: dry-run で対象一覧

- **WHEN** 開発者が `node scripts/upload-local-images-to-blob.mjs --dry-run` を実行する
- **THEN** アップロード対象のファイル名が標準出力に表示される
- **AND** Blob への書き込みは行われない

#### Scenario: 正本を Blob にアップロード

- **WHEN** 開発者がスクリプトを実行する（dry-run なし）
- **AND** `images/foo.png` が fs に存在する
- **THEN** Blob キー `images/foo.png` にオブジェクトが作成される

### Requirement: v1 はローカル dev スコープとする

ストレージバックエンドの動作保証はローカル `npm run dev` に限定する（SHALL）。Vercel デプロイ環境でのストレージモード動作は v1 の対象外とする。

#### Scenario: ローカル dev でストレージモードが動作する

- **WHEN** 開発者が `.env.local` にトークンを設定し `npm run dev` で起動する
- **AND** ⚙ でストレージを選択する
- **THEN** promote・プレビュー・Used 一覧が Blob 正本で動作する

### Requirement: 画像 file GET は条件付き応答をサポートする

`GET /api/images/file`（staging および正本）は、レスポンスに `ETag` および `Last-Modified` を含めなければならない（SHALL）。クライアントが `If-None-Match` で既存 ETag を送り、内容が変わっていない場合、サーバーは **304 Not Modified** を返さなければならない（SHALL）。`Cache-Control` は `private, no-cache, must-revalidate` を維持してよい（MAY）。

#### Scenario: 同一ファイルの再 GET で 304

- **WHEN** クライアントが `GET /api/images/file?path=images/ai/foo.png` で 200 を受け取る
- **AND** ファイルが変更されていない
- **AND** 同じ URL で `If-None-Match` 付きの再 GET を送る
- **THEN** レスポンスは 304 である

#### Scenario: ファイル更新後は新しい ETag

- **WHEN** staging 画像が上書きまたは正本が promote で置換された
- **AND** クライアントが古い `If-None-Match` で GET する
- **THEN** レスポンスは 200 と新しいボディである

### Requirement: 正本一覧はサーバー側でキャッシュする

サーバーは正本一覧（`listCanonical` の結果）をプロセス内にキャッシュし、リクエストのたびにバックエンドへ一覧操作を発行してはならない（SHALL NOT）。キャッシュの鮮度検証はバックエンドごとに次とする（SHALL）:

- **Blob バックエンド**: TTL 方式（30〜60秒）。加えて promote・正本削除の成功時にキャッシュを明示的に無効化しなければならない（SHALL）——正本の変更は必ず同一プロセスの API を通るため、TTL は外部変更に対する保険である
- **ローカルバックエンド**: `images/` ディレクトリの mtime による検証。mtime が変わっていなければキャッシュを返し、変わっていれば読み直す（ユーザーが fs へ直接ファイルを置く運用があるため TTL より正確）

#### Scenario: 連続する一覧要求で Blob の list は1回だけ発行される

- **WHEN** `storageMode=storage` で `GET /api/images/list?scope=used` が TTL 内に複数回呼ばれる
- **THEN** Blob への list 操作は1回だけ発行される
- **AND** 2回目以降はキャッシュから同じ一覧が返る

#### Scenario: promote がキャッシュを無効化する

- **WHEN** `storageMode=storage` で promote が成功する
- **AND** 直後に `GET /api/images/list?scope=used` が呼ばれる
- **THEN** 一覧には promote された画像が含まれる（TTL の残り時間に関わらず）

#### Scenario: ローカルは fs 直接変更を検知する

- **WHEN** `storageMode=local` で一覧がキャッシュされた後、`images/` 直下にファイルが直接追加される
- **AND** `GET /api/images/list?scope=used` が呼ばれる
- **THEN** 一覧には追加されたファイルが含まれる

### Requirement: 正本 file GET は毎リクエストのメタデータ取得を発行しない

`GET /api/images/file`（正本パス・`storageMode=storage`）は、ETag / Last-Modified の材料を正本一覧キャッシュのメタデータ（`size`・`uploadedAt`）から得なければならず（SHALL）、リクエストごとにバックエンドへ `head()` 等のメタデータ操作を発行してはならない（SHALL NOT）。要求されたパスがキャッシュに無い場合に限り、メタデータ操作へのフォールバックを許す（MAY）。

#### Scenario: 304 応答がバックエンド操作ゼロで返る

- **WHEN** 一覧キャッシュが有効な状態で、クライアントが既知の ETag を `If-None-Match` に付けて正本画像を GET する
- **AND** 画像が変更されていない
- **THEN** レスポンスは 304 である
- **AND** Blob への操作（head・ダウンロード）は発行されない

#### Scenario: キャッシュに無いパスはフォールバックする

- **WHEN** 一覧キャッシュに存在しない正本パスが GET される
- **THEN** サーバーはメタデータ操作または本体取得で応答を試みる（挙動は従来どおり）

### Requirement: ストレージエラーは3層に分類して伝える

正本画像の読み出し・一覧に失敗したとき、サーバーとクライアントは失敗を次の3層に分類して扱わなければならない（SHALL）。読み出し失敗を「実体なし」として扱ってはならない（SHALL NOT）:

1. **実体なし**: バックエンドが対象キーの不存在を明示した（404 等）。表示は「画像が存在しません」
2. **利用上限ブロック**: ストレージがプランの利用上限でブロックされている（Vercel Blob ではデータプレーンの 403 応答本文 `Your store is blocked` で判別する）。表示は「ストレージが利用上限でブロックされています」
3. **その他の読み出し失敗**: 認証エラー・ネットワーク断など上記以外。表示は「ストレージから読み込めません」

バックエンド実装は失敗理由を例外の握り潰しで消してはならず（SHALL NOT）、API は分類を表すステータス・メッセージで応答しなければならない（SHALL）。

#### Scenario: 実在する画像の読み出し失敗は「存在しない」と表示しない

- **WHEN** Blob に `images/foo.png` が存在するがデータプレーンが 403 を返す
- **AND** プレビューがこの画像を表示しようとする
- **THEN** 表示は「画像が存在しません」ではなく、ストレージ側の失敗である旨（ブロック中または読み込み失敗）を示す

#### Scenario: 上限ブロックを判別して伝える

- **WHEN** Blob のデータプレーンが 403 と本文 `Your store is blocked` を返す
- **THEN** `GET /api/images/file` は上限ブロックを表すエラー（503 とブロック中である旨のメッセージ）で応答する

#### Scenario: 実体なしは従来どおり

- **WHEN** どのバックエンドにも存在しない正本パスが GET される
- **THEN** レスポンスは 404「ファイルが見つかりません」であり、UI は「画像が存在しません」と表示する

### Requirement: storage-check はブロック状態を検知する

`GET /api/images/storage-check` は、一覧が取得できることに加えて、ストレージが利用上限でブロックされていないことを検証しなければならない（SHALL）。ブロック中は接続 NG として、ブロック中である旨のメッセージを返さなければならない（SHALL）。

#### Scenario: ブロック中の storage-check は失敗する

- **WHEN** Blob ストアが利用上限でブロックされている（コントロールプレーンの list は成功するがデータプレーンは 403）
- **AND** `GET /api/images/storage-check` が呼ばれる
- **THEN** レスポンスは失敗し、メッセージはブロック中であることを示す

