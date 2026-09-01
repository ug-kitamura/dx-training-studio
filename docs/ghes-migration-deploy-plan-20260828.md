# 社内 GHES 移植とデュアル配信 — 設計メモ

**作成日**: 2026-08-28
**目的**: `dx-training-studio` を社内 GitHub Enterprise Server（GHES）へ切り出し移植し、リリースタグを契機に **GHES Pages** と **社内ホスティングサービス（SMB 共有）** の両方へ配信する
**前提**: 現行の `AI_Driven_School` モノレポから `dx-training-studio` と GitHub Actions ワークフローだけを新規リポジトリへ切り出す
**ステータス**: 方針決着 ✅ / 実装未着手 / 未確認事項あり（後述のチェックリスト）

---

## 結論サマリ

1. ワークフローは **2本に分ける**（Pages 用・社内ホスティング用）。いずれも `v*` タグ契機。
2. 社内ホスティングは **2-1: Linux ランナー + rclone(SMB)** を第一候補、**2-2: Windows self-hosted ランナー + robocopy** を代替とする。
3. **Pages 用ワークフローを最初に作る。** バックアップであると同時に、GHES 移植全体のスモークテストになるため。

---

## 決まったこと

| 項目 | 決定内容 |
| --- | --- |
| リポジトリ | 社内 GHES に新規作成（モノレポから `dx-training-studio` + ワークフローを切り出し） |
| 公開範囲 | GHES Pages は社内からのみ参照可能。**公開範囲の懸念は解消済み** |
| ワークフロー分割 | **2本に分ける**（Pages / 社内ホスティング） |
| トリガー | 両方とも `v*` タグ push。既存同様「タグが main に含まれること」を検証する |
| 社内配信の第一候補 | 2-1: 共有 Linux ランナー + rclone の SMB バックエンド |
| 社内配信の代替 | 2-2: Windows self-hosted ランナー + robocopy（gMSA 推奨） |
| 実装順序 | ① Pages ワークフロー → ② 疎通スパイク → ③ 社内配信ワークフロー |
| 実ホスト名 | 社内公開情報のため **ワークフロー YAML に直書きで可** |
| rclone 入手 | 社内 Docker レジストリのイメージから取り出す方式が有力（保留・後述） |

---

## 全体構成

### ワークフロー1: GHES Pages 配信

現行の `.github/workflows/dx-training-mandala-release-pages.yml` のほぼ複製。`configure-pages` → `upload-pages-artifact` → `deploy-pages` の artifact 方式。

**GHES 3.8 以降でカスタムワークフローによる Pages 配信がサポートされていることを確認済み。** 構造はそのまま持ち込める。

### ワークフロー2: 社内ホスティング配信

**build ジョブと deploy ジョブに分ける。**

```
build   (runs-on: ubuntu)      → out/ を artifact にアップロード
deploy  (runs-on: 状況による)   → artifact を取得してコピー
```

この構造にする理由:

- **2-1 → 2-2 の切り替えが deploy ジョブだけの変更で済む。** `runs-on` を変え、rclone のステップを robocopy に差し替えるだけ。build ジョブは触らない
- **ビルドは常に Linux で行われる。** 「Next のセグメント `.txt` が Windows でだけディレクトリ化して 404 になる」既知問題（`scripts/flatten-export-segments.mts` で対処済み）の領域に、2-2 でも入らない

> [!IMPORTANT]
> **2-1 と 2-2 を別ファイルにしないこと。** 同じワークフロー内の選択肢であり、ビルド内容は完全に同一。別ファイルにするとリリース用ワークフローが3本になり、必ず片方が腐る。

---

## ビルド設定（両ワークフロー共通の考え方）

### basePath は「URL のパス」であって「UNC のパス」ではない

社内ホスティングは `\\XXXX.COM\aaa\bbb\ccc\ddd\` に置いたものが `https://intranet.xxx.com/doku/ccc/ddd/` で見える仕組み。**basePath に指定するのは後者** = `/doku/ccc/ddd`。

- 末尾スラッシュは付けない（`/doku/ccc/ddd/` は Next がエラーにする）
- **配信先が変わったら必ずビルドし直し。** basePath は 600 以上のファイルに絶対パスとして焼き込まれるので、コピーだけでは移せない

### `trailingSlash: true` を有効にする（社内ホスティング向け）

現行の GitHub Pages 版はリンクが拡張子なし（`/AI_Driven_School/git` → 実体は `git.html`）で、**サーバー側の「`.html` を補って返す」機能に依存**している。社内ホスティングがこれをやってくれる保証はない（IIS の既定では 404）。

`trailingSlash: true` にすると出力が `git/index.html` になり、リンクも `/doku/ccc/ddd/git/` 形式になるので、**最も基本的なディレクトリインデックス機能だけで完結する**。

`mandala/next.config.mjs` の `output: "export"` の直後に1行足す想定（環境変数で切り替え、既存の Pages / Vercel ビルドには影響させない）:

```js
  ...(process.env.SITE_TRAILING_SLASH === "1" ? { trailingSlash: true } : {}),
```

ビルドコマンド（**PowerShell で実行すること**。理由は後述の罠を参照）:

```powershell
cd dx-training-studio/mandala
$env:NEXT_PUBLIC_BASE_PATH="/doku/ccc/ddd"
$env:SITE_TRAILING_SLASH="1"
npm run build
```

### ワークフロー1 と 2 でビルド成果物は共有できない

basePath と trailingSlash が違うため、それぞれ別途ビルドする。現行の Pages / Vercel の関係と同じ。

---

## 2-1: Linux ランナー + rclone(SMB)

### なぜ rclone なのか

| 手段 | 評価 |
| --- | --- |
| `mount -t cifs` | ✕ root 権限（`CAP_SYS_ADMIN`）が要る。非特権コンテナで動く共有ランナーでは実行できない可能性が高い。マウントはホスト全体の状態になり、他ジョブから見える |
| `smbclient` | △ ユーザー空間で動くが、再帰コピーが古風で、**消えたファイルを削除する機能がない**（古い chunk が溜まり続ける） |
| **rclone** | ◎ ユーザー空間で SMB2/3 を直接喋る。特権不要・ホストに状態を残さない。本物の `sync`（差分＋削除）を持つ |

**`net use` / `mount` は「OS にマウントを依頼する」操作、rclone は「SMB クライアント」。** FTP をドライブとしてマウントするか、FTP クライアントを使うかの違い。クライアントなので認証情報は当然渡すが、渡し方が違う（プロセスの環境変数の中だけに存在し、プロセスと一緒に消える）。

### 配信の原子性は `--delete-after` が解決する

Next の資産はファイル名にハッシュが入っており新旧が衝突しない。`rclone sync --delete-after` は **「新しいファイルを全部転送し終えてから、不要になったものを消す」** 順序で動くので、コピー途中に壊れたページを踏む窓がほぼ消える。ワンコマンドで済む。

> [!WARNING]
> `robocopy /MIR` を一発で当てる形（先に削除が走る）は最も危険。対象ディレクトリに他の物が同居していた場合に消し飛ばす点も含めて。

### パス対応

`\\XXXX.COM\aaa\bbb\ccc\ddd` の場合:

- ホスト = `XXXX.COM`（ただし DFS 迂回のため**実ホスト名を直書き**する）
- **共有名 = `aaa`**（最初のセグメントが共有名）
- 宛先 = `:smb:aaa/bbb/ccc/ddd`

### デプロイステップの形

```yaml
- name: Deploy to intranet share
  env:
    RCLONE_SMB_HOST: <実ホスト名>
    RCLONE_SMB_DOMAIN: ${{ secrets.SMB_DOMAIN }}
    RCLONE_SMB_USER: ${{ secrets.SMB_USER }}
    RCLONE_SMB_PASS: ${{ secrets.SMB_PASS_OBSCURED }}
  run: rclone sync ./out ":smb:aaa/bbb/ccc/ddd" --delete-after
```

### 認証情報の扱い

**専用サービスアカウントは取得済み・共有へのアクセス権も付与済み。**

- 資格情報は **GHES の Environment secret** に置く。共有ランナーを使う以上これは避けられない（rclone でも `net use` でも Kerberos でも同じ）
- 社内 GHES が社内資格情報を持つだけなので、github.com に置く場合とは性質がまったく違う。**この構成で問題ない**
- **必ず環境変数で渡すこと。** `--smb-pass` のようなフラグで渡すと、同じランナー上の他ジョブから `ps x -w` でコマンドライン引数が見える
- パスワードは **手元で一度 `rclone obscure` を通した値** を secret に入れる。ランナー上で難読化すると平文がコマンドラインに乗る
- **obscure は暗号化ではなく可逆な難読化。** その値も平文と同格の秘密として扱う

> [!NOTE]
> 秘密を GHES に一切置かない構成は、**自分でランナーホストを持つ場合だけ**成立する（AD 参加 Linux ホストに keytab を置き `rclone --smb-use-kerberos` を使う等）。共有ランナーでは keytab も secret 経由で配ることになるので、パスワードを置くのと同じ。

### DFS の迂回

`\\XXXX.COM\aaa` はホスト名がドメイン名そのものであり、**ドメインベースの DFS 名前空間**。ユーザー空間の SMB クライアントは DFS の参照解決に対応していないことがある。

→ **実ホスト名を入手済みなので、rclone にはそれを直接指定して迂回する。**

> [!IMPORTANT]
> 迂回している理由は、後から読む人には分からない。「みんなが使っている UNC と違う値が書いてある」状態になるので、**なぜ迂回したか、ファイルサーバー移設時にはここの更新が要ることを YAML のコメントに残す**こと。既存ワークフローの ⚠ コメントと同じ作法。

### rclone の入手（**保留中**）

社内 Docker レジストリが利用可能なので、**イメージからバイナリを取り出す方式**が有力。外部へのホワイトリスト申請が不要になる。

```yaml
- name: Install rclone (社内レジストリのイメージから取り出す)
  env:
    RCLONE_IMAGE: <社内レジストリ>/rclone/rclone:1.75.0
  run: |
    docker pull "$RCLONE_IMAGE"
    cid=$(docker create "$RCLONE_IMAGE")
    mkdir -p "$RUNNER_TEMP/bin"
    docker cp "$cid:/usr/local/bin/rclone" "$RUNNER_TEMP/bin/rclone"
    docker rm "$cid" >/dev/null
    chmod +x "$RUNNER_TEMP/bin/rclone"
    echo "$RUNNER_TEMP/bin" >> "$GITHUB_PATH"
    "$RUNNER_TEMP/bin/rclone" version
```

**確認済みの事実**（公式 Dockerfile より）:

- バイナリは `/usr/local/bin/rclone`
- **`CGO_ENABLED=0` の完全な静的バイナリ** → Alpine ベースのイメージから取り出しても Ubuntu でそのまま動く（musl / glibc の問題は起きない）
- ENTRYPOINT は `rclone`、コンテナは UID 1009 の非 root ユーザーで動く

**注意点**:

- `$GITHUB_PATH` への追記が効くのは**次のステップから**。同じステップ内での動作確認はフルパスで叩く
- **`container:` にこのイメージを指定するのは不可。** Node と git が無いため `actions/checkout` の時点で落ちる
- タグでの固定に加え、可能ならダイジェストでも固定する（社内ミラーが上流に追随してタグを差し替える運用だと実体が変わり得る）

**`docker run` で直接使う場合**（取り出しが運用上認められない場合の代替）:

```yaml
run: |
  docker run --rm --network host \
    -e RCLONE_SMB_HOST -e RCLONE_SMB_DOMAIN -e RCLONE_SMB_USER -e RCLONE_SMB_PASS \
    -v "$PWD/dx-training-studio/mandala/out:/data:ro" \
    "$RCLONE_IMAGE" sync /data ":smb:aaa/bbb/ccc/ddd" --delete-after
```

- **`-e VAR` を値なしで書くこと。** `-e VAR=値` と書くと秘密が docker のコマンドラインに乗る
- コンテナから 445 に届くか不明なため `--network host` が要る可能性がある
- イメージは UID 1009 で動くので、マウントした `out/` の読み取り権限で詰まる可能性がある（`--user $(id -u):$(id -g)`）
- **取り出し方式ならこれらは一切発生しない。** 445 到達性という最大の不確実要素に、Docker のネットワーク問題を重ねないほうが切り分けが楽

---

## 2-2: Windows self-hosted ランナー + robocopy（代替案）

2-1 が成立しない場合の代替。**Windows ホストの手配と gMSA の作成は他部署が絡むため、2-1 の失敗が確定してから動くと待ち時間がそのまま遅延になる。可能性があるなら今から手配だけ動かす価値がある。**

### 認証は gMSA が最善

AD に gMSA（グループ管理サービスアカウント）を作り、**ランナーの Windows サービスをその gMSA として動かす**。

- パスワードは **AD が自動生成・自動更新**（既定30日）し、**人間が誰も知らない**
- **GHES Secrets にも、スクリプトにも、どこにも資格情報が現れない**
- ワークフローは単に `robocopy` するだけ。認証は OS が Kerberos で透過的に処理する

必要な準備:

1. AD 管理者に gMSA を作成してもらう（`New-ADServiceAccount` の `-PrincipalsAllowedToRetrieveManagedPassword` にランナーのホストを指定）
2. ランナーのサービスをその account で動かす（`sc.exe config <サービス名> obj= "DOMAIN\svc-dxdeploy$" password= ""`）
3. 共有と NTFS にそのアカウントの書き込み権限を付与

gMSA の作成が組織的に重い場合は、専用のドメインアカウントでも実用上は十分（パスワードは Windows のサービス設定に入り、GHES には何も置かない。更新が手作業になるのが差）。

### robocopy の罠

> [!WARNING]
> **robocopy は正常時にも 0 以外を返す。** 0 = コピーなし、1 = コピーした、3 = コピー＋余分あり…、**8 以上が本当の失敗**。素で呼ぶと**成功しているのにワークフローが赤になる**。明示的な終了コード変換が必須。

原子性については、`/MIR` 一発ではなく **`_next` を先にコピー → HTML を後 → 古い資産の削除はさらに後（あるいは次回）** の順序にすると、壊れた状態を踏む窓をほぼ潰せる。

---

## 未確認事項チェックリスト

着手時に上から潰していく。**①〜④ が1つでも欠けると 2-1 も 2-2 も動かない。**

### GHES 側（ワークフロー1 で一気に確定する）

- [ ] ① `actions/checkout@v5` / `actions/setup-node@v6` が GHES で解決できるか（**GitHub Connect が無効だと解決できない**。`actions-sync` での持ち込みが要る。メジャーバージョンが揃っているとは限らない）
- [ ] ② ランナーが **Node 24** を取得できるか（`setup-node` は nodejs.org から取得する。外向き通信が無い場合、ツールキャッシュに事前配置された版しか使えない）
- [ ] ③ npm レジストリに到達できるか（内部プロキシで可）
- [ ] ④ GHES の Pages カスタムワークフローが有効か（**3.8 以降でサポートされていることは確認済み**。インスタンスでの有効化状況は要確認）
- [ ] ⑤ **GHES Pages の URL 形式**（サブドメイン分離設定によって変わる。これが `NEXT_PUBLIC_BASE_PATH` を決めるので、ワークフロー1 を書く前に必要）
- [ ] ⑥ 共有ランナーが ephemeral か（非 ephemeral だと前ジョブの痕跡が残り、第三者が後続ジョブのトークンを窃取しうる既知リスクがある）

> [!NOTE]
> `pagefind` と `esbuild` は**プラットフォーム別バイナリを npm パッケージとして配布する形**（`@pagefind/linux-x64` 等）であることを確認済み。**npm 以外への追加の外向き通信は発生しない。** レジストリさえ通れば大丈夫。

### 社内ホスティング側（疎通スパイクで一気に確定する）

- [ ] ⑦ 共有 Linux ランナーから実ホストの **445/tcp に到達できるか**
- [ ] ⑧ サービスアカウントでの**認証が通るか**
- [ ] ⑨ **DFS 迂回**（実ホスト直指定）で問題が出ないか
- [ ] ⑩ **SPN** が必要か（接続はできるのに認証で弾かれる場合はこれを疑う。rclone 公式も「クラスタでは設定が必要になることが多い」と記載。`--smb-spn`）
- [ ] ⑪ rclone の入手方式（イメージ取り出し / `docker run` / その他）の確定

---

## 進め方

### ステップ1: ワークフロー1（Pages）を作って緑にする

**これを最初にやる。** 現行 Pages ワークフローのほぼ複製なので最も早く緑にできて、緑になった瞬間に上記 ①〜④ がまとめて確定する。

**ワークフロー1 は「万一の逃げ道」であると同時に、移植全体のスモークテスト。** これが通らなければ 2-1 も 2-2 も同じ理由で動かないので、SMB の疎通を調べる前にここを確定させる。

### ステップ2: 疎通スパイクを1本流す（ステップ1と並行可）

`workflow_dispatch` 限定の使い捨てワークフロー。20行程度。

```
- rclone を入手する（イメージ取り出し）
- rclone version
- rclone lsd ":smb:aaa" --smb-host <実ホスト名>
```

ついでに `sudo -n true` / `docker version` / `curl -I https://downloads.rclone.org` も叩いておくと、入手方式の選択肢（⑪）も同時に判定できる。

**この1回の実行で ⑦〜⑪ が決まり、2-1 でいけるか 2-2 に倒すかが確定する。**

### ステップ3: ワークフロー2 を書く

スパイクの結果に応じて deploy ジョブを実装する。

> [!IMPORTANT]
> **ワークフロー2 を完成させてから疎通を確かめる順序は避けること。** ダメだったときに捨てる量が大きくなる。

---

## 運用上の注意

- **部分成功が起こる。** 同じタグで両方が発火するので、1 が成功して 2 が失敗する状態があり得る。1 をバックアップと位置づけるならむしろ望ましい挙動だが、意識しておく
- **ワークフロー2 は Environment で保護する。** タグ契機にすると「タグを打てる人＝社内共有に書き込める人」になる。承認必須の Environment を挟む
- **`workflow_dispatch` は main 所属の検証を飛ばす。** 既存 Pages ワークフローと同じ穴。社内配信は「本番」なので、手動実行を許すかは Pages より慎重に決める
- 共有ランナーで秘密を扱うので、**ランナーグループを特定の再利用可能ワークフローに限定する**制限も検討に値する

---

## 付録: 今回の調査で実測・確認したこと

### 現行 GitHub Pages 成果物の取得方法

- デプロイは **artifact 方式**（`upload-pages-artifact` → `deploy-pages`）なので **`gh-pages` ブランチは存在しない**。git では取れない
- Actions の run ページから `github-pages` アーティファクトをダウンロードできる。**zip の中に `artifact.tar` が入った二重梱包**なので2段階で展開する
- 保持期間は短いので、過去のリリース分は残っていないことが多い

### `file://` で開くと壊れる理由（実測済み）

ローカルに `AI_Driven_School/` フォルダを作って `index.html` を直接開いても表示できない。理由は3つあり、**2つはパスを書き換えても解消しない**。

1. **絶対パスがドライブのルートを指す。** `file://` にはドキュメントルートの概念がなく、`/AI_Driven_School/_next/...` は `C:\AI_Driven_School\...` を探しに行く（書き換えれば潰せる）
2. **リンクが拡張子なしで `index.html` も無い。** `.html` を補うのはサーバーの仕事（サーバーが要る）
3. **`fetch()` が使えない。** 検索の `_pagefind/pagefind.js` も Next のクライアント遷移（`git.txt` の取得）も `fetch()` を使う。`file://` は不透明オリジンなのでブラウザがブロックする（サーバーが要る）

→ **どうビルドしても HTTP サーバー経由でないと表示できない。** ローカル確認は必ずサーバーを立てる。

```bash
npx -y serve <サイトの1つ上の階層> -l 4321
```

ルートを間違えないこと。`temp\AI_Driven_School` をルートにすると `/AI_Driven_School/...` が二重になって 404 になる。**1つ上の階層**をルートにする。

### basePath + trailingSlash の動作確認（実測済み）

`NEXT_PUBLIC_BASE_PATH=/doku/ccc/ddd` + `trailingSlash: true` でビルドし、`/doku/ccc/ddd/` に配置して配信した結果:

| URL | 結果 |
| --- | --- |
| `/doku/ccc/ddd/` | 200 |
| `/doku/ccc/ddd/git/` | 200 |
| `/doku/ccc/ddd/git/basics/first-commit/` | 200 |
| `/doku/ccc/ddd/en/` | 200 |
| `/doku/ccc/ddd/_next/static/css/...css` | 200 |
| `/doku/ccc/ddd/_pagefind/pagefind.js` | 200 |

HTML 内の絶対パスを走査し、**basePath 配下以外を指すものがゼロ**であることも確認済み。

### ネットワークパス配信の動作確認（実測済み）

`npx serve` に UNC パスをルートとして渡す構成は動作する。バックスラッシュ表記・スラッシュ表記のどちらでも、PowerShell の引用符あり・なしのどちらでも Node が正しく解決した。

- **UNC はカレントディレクトリにはできない**（`cd \\server\share` は cmd が拒否）。引数として渡す分には無関係
- 実測は loopback なので**速度の参考にはならない**。実リモート共有では SMB のレイテンシがそのまま効く（1ページで数十ファイル取得する）

### 罠: Git Bash では basePath の環境変数を渡せない

Git Bash で `NEXT_PUBLIC_BASE_PATH=/doku/ccc/ddd npm run build` を実行すると、**MSYS のパス変換が `/doku/ccc/ddd` を `C:/Program Files/Git/doku/ccc/ddd` に書き換えてビルドが失敗する。**

→ **PowerShell を使う**か、Git Bash なら `MSYS_NO_PATHCONV=1` を付ける。

### 罠: ローカルの `_pagefind` は古い fragment が溜まる

postbuild が `public/_pagefind` を作り直さずに `out/` へコピーするため、ローカルではビルドを重ねるたび古い fragment が溜まる（実測: CI 50 件に対しローカル 326 件）。CI は毎回まっさらな checkout なので現行分だけになる。

`pagefind-entry.json` は現行の fragment しか参照しないので動作に害はないが、**ローカルの `out/` を「公開物と同じもの」として扱うときは注意**。気になるなら `mandala/public/_pagefind` を消してからビルドする。

### ファイル名・パス長の確認

- 記号を含むファイル名は `__next.$oc$mdxPath.__PAGE__.txt`（104 件）。`$` は Windows 共有で問題にならない
- 最長の相対パスは 92 文字。UNC プレフィックスを足しても 260 文字制限には遠い
- **`_next` / `_pagefind` はアンダースコア始まり。** 社内ホスティングが隠しファイル扱いで弾く可能性は**未確認**。小さなテストファイルを `_test/index.html` として置いて開けるか試すと、大掛かりな作業の前に判定できる

---

## 参考リンク

- [SMB / CIFS — rclone](https://rclone.org/smb/)
- [Rclone downloads](https://rclone.org/downloads/)
- [rclone/rclone Dockerfile](https://github.com/rclone/rclone/blob/master/Dockerfile)
- [Using custom workflows with GitHub Pages — GHES 3.16](https://docs.github.com/en/enterprise-server@3.16/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Secure use reference — GitHub Docs](https://docs.github.com/en/actions/reference/security/secure-use)
- [Managing access to self-hosted runners using groups — GHES 3.11](https://docs.github.com/en/enterprise-server@3.11/actions/hosting-your-own-runners/managing-self-hosted-runners/managing-access-to-self-hosted-runners-using-groups)
- [GitHub Actions exploitation: self hosted runners — Synacktiv](https://www.synacktiv.com/en/publications/github-actions-exploitation-self-hosted-runners)

### リポジトリ内の参照先

- `.github/workflows/dx-training-mandala-release-pages.yml` — ワークフロー1 の元になる現行 Pages 配信
- `.github/workflows/dx-training-mandala-release-vercel.yml` — 配信先ごとにファイルを分ける判断の先例（冒頭コメントに理由あり）
- `dx-training-studio/mandala/next.config.mjs` — basePath / trailingSlash の設定箇所
- `dx-training-studio/mandala/scripts/flatten-export-segments.mts` — Windows ビルド時のセグメント平坦化
