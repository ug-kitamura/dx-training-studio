# DX Training Mandala（公開サイト）

`contents/` の原稿を受講者向けの静的サイトに変換して公開する。Nextra 4（Next.js 16 / React 19）＋ React Flow。

Studio（`../studio/`）とは独立した npm プロジェクトで、兄弟に置かれた正本 `../contents` と `../images` を**読み取るだけ**。

## サイト画像

<img width="1560" height="842" alt="image" src="https://github.com/user-attachments/assets/17f84c2c-38aa-4da0-80e8-3ec4391cf454" />

## 使い方

```bash
npm install
npm run dev     # 変換 → 開発サーバー（http://localhost:3002）
npm run build   # 変換 → 静的 export（out/ に出る）＋ 検索インデックス生成
npm run start   # out/ をローカル配信して確認（http://localhost:3002）
npm run test    # 変換・曼陀羅グラフのテスト
```

**入れ物直下（`../`）の `start-mandala-dev.bat` をダブルクリックすれば「ビルド → 開発サーバー」が一発で走る。** 検索インデックスはビルドでしか作られないため、この順序で起動すると開発サーバーでも検索が使える（→ 検索）。本番相当の確認は `start-mandala.bat`（ビルド → `out/` 配信）。

`npm run build:content` だけを単体で実行すれば、変換（`content/` と `public/images/` の生成）のみ走る。

**ポート**: このサイトは **3002**。同時に立ち上げる別アプリは EBEX が 3000、Studio が 3001。

## 検索

全文検索は [Pagefind](https://pagefind.app/) のインデックスを使う。インデックスは **`npm run build` の postbuild で生成される**。

| 出力先              | 用途                                                   |
| ------------------- | ------------------------------------------------------ |
| `public/_pagefind/` | 開発サーバー（`npm run dev`）が配信する                |
| `out/_pagefind/`    | 静的配信・デプロイ（`npm run start` / Pages / Vercel） |

- **ビルドを一度も走らせていないと検索はエラーになる**。`npm run dev` だけで起動した場合はインデックスが存在しない
- **開発サーバーの検索結果は直近ビルド時点のスナップショット**。原稿を直しても、再ビルドするまで検索結果には反映されない（本文表示のほうは dev が変換をやり直すので最新になる）
- ショートカットは Nextra 標準の `Ctrl+K` / `Cmd+K`
- インデックスは生成物なので git 追跡対象外
- **変更履歴ページは検索対象外**。変換が frontmatter に `searchable: false` を入れ、Nextra が `<main>` の `data-pagefind-body` を外すことで Pagefind がページごと索引から除く。⚠ `robots: "noindex"` は実測で Pagefind に**効かない**（meta タグは出るが索引される。2026-08-21 実測）——検索除外に使わないこと
- `public/_pagefind/` には古いビルドの断片ファイルが残るが無害（検索は `pagefind-entry.json` から現行の索引だけをたどる）

## 生成物

変換スクリプト（`scripts/build-content.mts`）が毎回作り直すため、**すべて git 追跡対象外**。

| 生成物                   | 中身                                                   |
| ------------------------ | ------------------------------------------------------ |
| `content/**/*.md`        | レッスン本文（日本語＝ルート、英語＝`en/` サブツリー） |
| `content/**/index.mdx`   | 全体・シリーズ・コースのトップページ                   |
| `content/**/_meta.js`    | サイドバー（slug → 日本語表示名、`order` 順）          |
| `content/changelog.md`   | 変更履歴ページ（正本をそのままコピー。`en/` は英語版か日本語フォールバック） |
| `content/site-data.json` | 全階層のメタと曼陀羅グラフ                             |
| `public/images/*`        | 本文とヒーローが参照する正本画像のコピー               |

### 変更履歴

正本は **`dx-training-studio/contents/changelog.md`**（任意。無ければページもサイドバー項目も出ない）。人が新しいエントリを**上に**書き足す、ただの Markdown で、変換は**パース・並べ替え・書式検証をしない**——丸ごとコピーするだけ。書式が崩れても崩れたまま表示されるだけでビルドは落ちない。載せるのは教材の主な更新のみ（冒頭の宣言文もこの方針を受講者に伝えるためのもの）。

- 英語版は `contents/changelog.en.md`。無ければ日本語＋未翻訳バッジ（レッスンの `contents.en.md` と同じ作法）
- サイドバーでは全シリーズの下、**最後の項目**として出る
- シリーズ slug に `changelog` は使えない（URL `/changelog` と衝突するため変換が予約語として弾く）
- ⚠ **正本 `contents/changelog.md` と生成物 `mandala/content/changelog.md` は 1 文字違い**（contents / content）。文書・コミットメッセージでは常にフルパスで書くこと

## 設定（`site.config.json`）

```json
{
  "siteName": "DX Training Mandala",
  "imageSource": "local",
  "repositoryUrl": "https://github.com/ug-kitamura/AI_Driven_School"
}
```

- **`imageSource`**: `local`（正本画像を `public/images/` へコピー）か `blob`。
  **デプロイ先ごとの環境変数ではなくこのファイルで持つ**——GitHub Pages と Vercel で画像の参照先が食い違うと、画像の有無で挙動差が生まれるため。
- **`blob` は未実装**。現在の Blob は `access: "private"` で公開サイトから参照できない。public 化の手順が決まるまでは `local` を使う（選ぶとエラーで停止する）。

## `basePath`（サブパス配信）

GitHub Pages のプロジェクトページ配信ではサブパスになる。環境変数で渡す。

```bash
NEXT_PUBLIC_BASE_PATH=/AI_Driven_School npm run build
```

未設定ならルート配信（Vercel・ローカル）。生の `<img>` には basePath が自動で付かないため、`lib/asset-path.ts` の `assetPath()` を通す。

## デプロイ

**Pages と Vercel は同じものを2か所へ配るのではなく、役割が違う。**

| | GitHub Pages | Vercel |
| --- | --- | --- |
| 位置づけ | **リリース版**（社内トライアル配信） | **最新版**（理想追求・実験） |
| 契機 | `v*` タグ（＋確認用の手動トリガー） | **`main` へのマージ** |
| 配信の担い手 | GitHub Actions | **Vercel の git 連携** |
| サイドバーの表示 | `2026.08.21 更新 (v1.2.3)`（日付＋タグ名） | `2026.08.21 更新`（日付のみ） |

⚠ **両者の内容は一致しない。**`main` にマージしてタグを打つまでの間、Vercel は最新・Pages は前回リリースのままになる。**どちらを見ているかで判断が変わる場面では URL を明示すること。**

GitHub Actions のワークフローは3本。**契機が違う**ので混ぜない。

| ワークフロー                           | 契機                                                    | やること                                   |
| --------------------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| `dx-training-mandala-ci.yml`               | **`main` への push** / PR / 手動                        | 変換 → ビルド → テスト。**デプロイしない** |
| `dx-training-mandala-release-pages.yml`    | `v*` タグの push / 手動                                 | GitHub Pages へ配信                        |
| `dx-training-mandala-release-vercel.yml`   | **使っていない**（手動のみ・UI でも disable 済み）      | Vercel 配信は git 連携へ移行した。git 連携が壊れたときの逃げ道として残してある |

```bash
git tag v0.1.0 && git push origin v0.1.0
```

- タグは **`main` に含まれるコミット**に打つこと。作業ブランチのコミットに打つとワークフローが検証で止める（`git merge-base --is-ancestor`）
- ⚠ **CI の `push` は `main` に絞ってある。外すと同じ push で2回走る**——`pull_request` と同じ paths を見ているため、PR が開いているブランチへの push で両方が発火する。`concurrency` の group は `github.ref` 依存で、push（`refs/heads/…`）と PR（`refs/pull/…/merge`）は値が違うので相殺されない

### 手動トリガー（動作確認用）

タグを打たずに配信経路を試すためのもの。Actions 画面の **Run workflow** から起動し、`version` 入力でリリース番号を与える（**既定は空＝番号を併記しない**。確認用の配信に偽のバージョンを出さないため。更新日のほうは常に出る）。

|                     | `v*` タグ            | 手動                                         |
| ------------------- | -------------------- | -------------------------------------------- |
| main 祖先チェック   | する                 | **しない**（ワークフロー側）                 |
| リリース番号の併記  | タグ名               | `version` 入力（既定 空＝日付のみ）          |
| 配信先              | Pages の本番サイト   | Pages の本番サイト（プレビューの概念が無いため） |

⚠ **作業ブランチからの手動 Pages 実行は成功しない。**ワークフローが main 祖先チェックを飛ばしても、`github-pages` environment の保護が `main` とタグ以外の ref を弾く（下記）。

⚠ **作業ブランチの内容を「配信して」確認する手段は無い。**Pages は environment 保護で弾かれ、Vercel は `main` 限定にしてある。確認したいときは**ローカルで `npm run build` → `npm run start`** か、**`main` にマージする**かのどちらか。

⚠ `workflow_dispatch` の **Run workflow ボタンは、デフォルトブランチにあるワークフロー定義を見て出る**。手動トリガーを新しく足したときは、**一度 `main` にマージするまでボタンが現れない**。マージ後は任意のブランチを選んで起動できる。
- Pages はサブパス配信なので `NEXT_PUBLIC_BASE_PATH=/AI_Driven_School` 付きでビルドし、Vercel は付けずにビルドする（ルート配信のため）。⚠ **この値はリポジトリ名に由来する**（`https://<owner>.github.io/<repo>/`）。**リポジトリ名を変えたら `dx-training-mandala-release-pages.yml` の `PAGES_BASE_PATH` も変えること**——変えないと配信されたサイトの CSS・JS・画像がすべて 404 になる
- タグ検証（main に含まれるかの確認）は Pages のワークフローに入っている
- **サイドバー最上部の更新日行はすべてのビルドで出る**（`YYYY.MM.DD 更新`）。日付は **HEAD の commit date**（ビルド時刻ではない——再デプロイで動かないため）を `Asia/Tokyo` で整形した値。**時・分は出さない**（受講者には日付で足り、フォールバック経路とも表示が揃う）。⚠ 時刻を出さなくてもタイムゾーンの明示は外せない——UTC のビルドマシンでは日付そのものが前日にズレる。`next.config.mjs` がビルド時に `git show -s --format=%cI HEAD` で解決して `NEXT_PUBLIC_SITE_COMMIT_DATE` に注入し、git が読めない環境では正本 changelog の先頭日付で代替（表示形式は git 経路と同一）、それも無ければ行ごと消える。**どの経路で解決したかはビルドログに必ず出る**——⚠ Vercel の git 連携ビルドに `.git` があるかは未実測。次回 `main` マージ後の Vercel ビルドログで「サイト更新日時:」の行を確認すること
- リリース番号（タグ名）は `NEXT_PUBLIC_SITE_RELEASE` としてビルドに渡され、タグ由来のビルドでは日付の後ろに ` (vX.Y.Z)` が併記される。タグが無ければ日付のみ（`dev` 等の代替文字列は出ない）

### 事前に必要な設定（人が行う）

#### GitHub Pages —— 設定は2つ、**順序がある**

⚠ **どちらもエラーメッセージが原因を指さない。**しかも `github-pages` environment は**ワークフローが参照した時点で自動的に作られる**ため、**Pages サイトが存在しなくても environment の設定画面は開けてルールも足せる**。だから順序を逆にすると「さっき設定したのに」と誤診する。

| 順  | 設定                                                                                             | やらないと出るエラー                                                                                       |
| --- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| ①   | Settings → **Pages** → Build and deployment → Source を **GitHub Actions** に                     | `Error: Get Pages site failed ... Error: Not Found` / `HttpError: Not Found`（`configure-pages` が 404）    |
| ②   | Settings → **Environments** → `github-pages` → Deployment branches and tags に**タグのルール**    | `Tag "vX.Y.Z" is not allowed to deploy to github-pages due to environment protection rules`（deploy が数秒で拒否） |

②のルールは Ref type: **Tag**、パターンは運用中のタグ形式に合わせる（現在は `v*.*.*`）。ブランチ側は `main` のみ。

⚠ **この environment 保護を "No restriction" にしないこと。**作業ブランチの内容が社内トライアルサイトへ出るのを防ぐ安全網として機能している。任意ブランチの確認は Vercel preview が担う。

⚠ **ワークフローの発火条件（`v*`）と environment の許可パターン（`v*.*.*`）は一致していない。**`v6` や `v0.2` のようなタグを打つと**ビルドは走ってから deploy だけが拒否される**。セマンティックな `vX.Y.Z` 形式で運用するか、片方を揃えること。

**Pages 配信にはリポジトリが public である必要がある**（Free プラン）。CI と Vercel は private のままでも動く。

#### Vercel —— git 連携で配る（GitHub Actions は使わない）

公開サイト用のプロジェクトを作り、GitHub リポジトリと**連携する**。Studio 本体とは**別プロジェクト**にすること。設定は次のとおり。

| 設定 | 値 | 忘れると |
| --- | --- | --- |
| Root Directory | `dx-training-studio/mandala` | ビルドコマンドが見つからない |
| **Include files outside the root directory** | **Enabled** | 変換が `../contents` を読めず「正本が見つかりません」で落ちる |
| Framework Preset | **Next.js** | `No framework detected` になり、`out/` ではなく `public/` が配信されて**全ページ 404** |
| Node.js Version | 22.6 以上（現在 24.x） | `build:content` の `--experimental-strip-types` が動かない |
| Production Branch | `main` | — |
| Ignored Build Step | 下記のコマンド | 全ブランチの push で preview ビルドが走る |
| Skip deployments（root に変更が無ければスキップ） | **Disabled** | ⚠ `contents/` は Root Directory の**外**なので、**原稿だけ直したときに黙ってスキップされる** |
| Build Command / Output Directory | 既定のまま（Override しない） | — |

**Ignored Build Step**（Project Settings → Git）:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; else exit 0; fi
```

⚠ **`exit 1` = ビルドする / `exit 0` = スキップ**。向きが直感と逆なので、**両方の分岐を必ず書くこと**。`if [ ... != "main" ]; then exit 0; fi` と片方だけ書くと、条件が偽のとき `if` 文が 0 を返し、**`main` こそがキャンセルされる**（実際に踏んだ）。

⚠ **この Ignored Build Step は、同じリポジトリを見ている Vercel プロジェクトすべてに入れる。**公開サイトと Studio 本体は別プロジェクトだが同じリポジトリを見ているので、片方だけでは他方が毎回ビルドする。

⚠ **Framework Preset を後から変えても、既存の Production デプロイには遡って効かない。**Project Settings と現行デプロイがずれていると黄色い警告（`Configuration Settings in the current Production deployment differ from...`）が出る。**新しいビルドを1回走らせるまで直らない**——Redeploy（Build Cache のチェックを外す）か `main` への push で。

##### 逃げ道のワークフロー

`dx-training-mandala-release-vercel.yml` は git 連携が壊れたときのために残してあるが、**二重に止まっている**。使うには3手が要る。

1. GitHub UI でワークフローを **Enable**（disable 中は `workflow_dispatch` も押せない）
2. Secrets 3本（`VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`）を登録
3. Run workflow

⚠ Secrets が未登録だと `Check Vercel credentials` が**スキップして緑になる**——何も配信されていないのに成功に見える。

### 注意: Pages は1リポジトリ1サイト

この repo の Pages は `commit-track-tool-report.yml`（comitora レポート）とも共有していたが、**現在は `commit-track-tool-ci.yml` / `commit-track-tool-report.yml` とも GitHub 側で Disable 済み**なので競合しない。再有効化するときは、comitora を手動実行する際に `deploy_pages: false` を選ぶ運用に戻すこと。

### 将来: 専用 public リポ方式へ切り替える場合

「成果物のみを別の public リポへ push する」方式に変える場合、変更は `dx-training-mandala-release-pages.yml` の冒頭 `env` と `deploy` ジョブに閉じる。**`mandala/` のコードと `scripts/` の変換処理は変更不要**。

## 正本に必要なもの

変換は **slug が1つでも欠けていると中断する**（URL を決められないため）。

| 階層     | 置き場                                 | 必須   | 任意                                                  |
| -------- | -------------------------------------- | ------ | ----------------------------------------------------- |
| 全体     | `contents/.meta.json`                  | —      | `description` / `description_en`                      |
| シリーズ | `contents/<series>/.meta.json`         | `slug` | `description` / `catch` / `cover` / `*_en`            |
| コース   | `.../<course>/.meta.json`              | `slug` | `description` / `catch` / `target` / `*_en`           |
| レッスン | `.../<lesson>/.meta.json` | `slug` | `id` / `status` / `description` / `estimated_minutes` / `author` / `author_en` / `name_en` / `description_en` |

各階層の `.meta.json` は、メタ翻訳の鮮度ハッシュ `en_source_hash` を持てる（書くのは翻訳の実行主体。サイトは読むだけ）。コースの受講対象者は `target_en` で英語版を持てる。

- **画像**: 本文の `images/<file>` とシリーズの `cover` は、**正本 `../images/<file>` に実体が必要**。無いとビルドが失敗する（参照切れの検出を兼ねる）
- **英語版**: レッスンは同フォルダの `contents.en.md`、メタは同じ `.meta.json` の `*_en` フィールド。無ければ日本語へフォールバックし、未翻訳バッジが出る。`contents.en.md` の1行目には翻訳時の原文ハッシュ（`<!-- source: sha256:… -->`）を持ち、現在の `contents.md` と一致しなければ「翻訳が古い」バッジが出る（ハッシュ行は本文には表示されない）。変更履歴は日英の先頭エントリ日付の比較で同じ判定をする
- **変更履歴**: `contents/changelog.md`（任意）。詳細は「生成物 → 変更履歴」を参照

## 既知の制約

- **`zod` を 4.3.6 に固定している**（`package.json` の `overrides`）。Nextra 4.6.x は zod 4.4.x と衝突し、`Layout` の `children` 検証で全ページのプリレンダが落ちる（[shuding/nextra#5008](https://github.com/shuding/nextra/issues/5008)）。**上流が修正されたら overrides を外す**——判断は Nextra のリリースノートで #5008 の修正を確認してから
- **ビルドは webpack に固定している**（`package.json` の `--webpack`）。`next.config.mjs` が rehype プラグイン（GitHub アラート）を関数で渡しており、Turbopack はローダー options をシリアライズ可能な値に限るため「does not have serializable options」で落ちる。unified は文字列でのプラグイン指定を受け付けないので、外せるのは上流が対応してから
- **トップページを `content/` の `index.mdx` として生成している**。Next.js は同階層に `[series]` と Nextra の `[[...mdxPath]]` を同居できないため、`app/` 直下に独自ルートを作れない
- ⚠ **テーマの `<Layout>` を動的セグメント配下のレイアウトに置かないこと**（いまは `components/SiteShell.tsx` がルートレイアウトから描いている）。`app/[[...mdxPath]]/layout.tsx` に戻すと、クライアント遷移のたびにレイアウトが作り直されて next-themes の `<script>` が再マウントされ、console エラーが再発する
- **更新日＋リリース番号の行はサイドバーの `::before`** で描いている（テーマに差し込み口が無いため）。テーマのクラス名 `.nextra-sidebar` に依存するので、Nextra 更新時に消えることがある。文字色はメニューより**一段引いた**グレー（`--dxm-release-color`。ダークを暗くしすぎるとコントラスト AA を割る——値の根拠は `globals.css` のコメント参照）
- **サイドバーの幅はテーマのユーティリティクラス `x:w-64` を狙って広げている**（`.nextra-sidebar.x\:w-64 { width: 18rem }`）。展開状態だけに効かせるためで、平坦に `.nextra-sidebar` へ書くと手動トグルで畳んだときの `x:w-20` まで潰れて畳めなくなる。テーマが幅のクラスを変えると当たらなくなるが、**壊れ方は「サイドバーが 256px のまま」で機能に影響しない**
- **supergraphic 帯の `z-index: 40` はテーマのナビバー（`z-30`）より上、という前提の数値**。ナビバーの `z-index` が上がると帯がその下に潜る。壊れ方は「帯が隠れる」で機能に影響しないが、クラス名ではなく数値の依存なので更新時に気づきにくい
- **supergraphic 帯は `position: fixed` でフローから外し、その 6px の居場所を `--nextra-navbar-height` を 64px → 70px にして確保している**（ナビバーの中身の行には `padding-top: 6px`）。⚠ `sticky` に戻すと帯が本文フローの先頭 6px を占め、同じく `sticky top:0` のナビバーがスクロール開始直後に 6px ずり上がってから固定される（サイドバーと目次も追随する）。⚠ 変数を戻して帯を覆いかぶせる形にすると、ヘッダーも本文も 6px 上へ詰まって見える。**6px は帯の `height` と変数の加算分の 2 箇所にあるので、片方だけ変えないこと**。サイドバー・目次・モバイルナビの位置と高さはこの変数を見ているので自動で追随する
- **ナビバーのアイコン3種は「見た目の幅」で揃えている**（箱の数字では揃わない）。`GitHubIcon` は `viewBox="3 3 18 18"` で余白を持たず被覆 100%、lucide は `0 0 24 24` で被覆 75〜83%。基準は左上のロゴ（`1.1rem` ＝ 見た目 17.6px）で、GitHub は `18`（被覆 100% なのでそのまま 18px）、lucide `Map` は `21`（見た目 15.75px）。**Map だけ意図的に1割強ちいさい**——丸い絵と矩形の絵を並べると、外接箱を揃えても矩形のほうが大きく見えるため。**サイズを触るときは被覆率ごと計算し直すこと**
- **曼陀羅のホバートレース**は、現在のコンテンツでは見た目に変化が出ない。全コースが1本の鎖で繋がっており、どのノードから辿っても全ノードが経路に入るため（シリーズが増えて枝分かれすると効く）
- **`/en` の `<html lang>` は postbuild（`scripts/set-en-lang.mts`）が生成物を書き換えて `en` にする**。ルートレイアウトが1つ（`lang="ja"` 固定）のため、静的 HTML はビルド後の書き換えでしか直せない。Pagefind はこの lang で日英の索引を分離するので、**このステップは Pagefind 実行より前に走ること**（`package.json` の postbuild の順序）。dev サーバーの HTML は書き換え対象外だが、`SiteShell` の effect が `/en` で lang を同期する
- **検索の索引言語は「検索 UI を最初に開いた時点」の `<html lang>` で決まる**。ja ⇄ en を SPA 遷移で行き来しても effect が lang を追随させるが、遷移前に一度検索を開いていた場合は次のフルロードまで前言語の索引が残る（既知の限界）

## 構成

```
mandala/
├─ scripts/build-content.mts   変換の入口
│  └─ lib/                     content-source（正本読み取り）/ site-model / emit / images
├─ app/                        ルートレイアウト・グローバル CSS・supergraphic / hero・アイコン
├─ components/                 SiteShell（テーマの Layout）/ ページ / 曼陀羅 / ラベル
├─ lib/                        site-data・locale-path・asset-path・mandala（graph / layout）
└─ __tests__/                  変換・曼陀羅グラフ・Studio ローダーとの突き合わせ
```

`__tests__/content-source.parity.test.mts` は、**mandala の読み取りロジックが Studio の `../studio/lib/contents-loader.ts` とずれていないか**を実際の `contents/` を両方で読んで検証する。走査規則を変えるときは両方を直す。
