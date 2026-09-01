# dx-training-studio

DX ツールトレーニングのプロジェクト一式（入れ物）。アプリ2つと正本データが兄弟で並ぶ。

| | 何 | 起動 | ポート |
|---|---|---|---|
| **studio/** | 執筆スタジオ（3ペイン Next.js） | `start-studio-dev.bat`（開発）/ `start-studio.bat`（本番相当） | 3001 |
| **mandala/** | 公開サイト DX Training Mandala（Nextra） | `start-mandala-dev.bat`（開発）/ `start-mandala.bat`（本番相当） | 3002 |

原稿の正本は `contents/`、画像の正本は `images/`。どちらのアプリのものでもなく、両アプリが読み取る。

- Studio の使い方 → [`studio/readme.md`](studio/readme.md)
- 公開サイトの手順書（起動・検索・デプロイ・制約） → [`mandala/README.md`](mandala/README.md)
- 引き継ぎ・未決事項 → [`docs/handoff.md`](docs/handoff.md)

> [!IMPORTANT]
> この直下に `package.json` やビルド設定を置かないこと（アプリの設定探索が親へ漏れる構造に戻るため）。詳細は [`CLAUDE.md`](CLAUDE.md)。
