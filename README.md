# DX Training Studio & Mandala

> DX ツールトレーニングのプロジェクト一式。アプリ2つと正本データを並列に配置する。

---

## 1. DX Training Studio

DX ツールトレーニングのコンテンツ計画・作成・編集・翻訳・デプロイを支援する3ペイン統合スタジオ。

### 起動方法

| 起動コマンド | ユースケース | ポート |
|---|---|---|
| `start-studio-dev.bat` | 開発用 | 3001 |
| `start-studio.bat` | 本番用 | 3001 |
| `start-studio.bat rebuild` | 本番用（リビルド） | 3001 |

### 詳細

- [`studio/README.md`](studio/README.md)

---

## 2. DX Training Mandala

DX ツールトレーニングのコンテンツを受講者向けの静的サイトに変換して公開する。

### 起動方法

| 起動コマンド | ユースケース | ポート |
|---|---|---|
| `start-mandala-dev.bat` | 開発用 | 3002 |
| `start-mandala.bat` | 本番用 | 3002 |
| `start-mandala.bat rebuild` | 本番用（リビルド） | 3002 |

### 詳細

- [`mandala/README.md`](mandala/README.md)

---

## 共通の設定

- 原稿の正本 → `contents/`
- 画像の正本 → `images/`
- 引き継ぎ・未決事項 → [`docs/handoff.md`](docs/handoff.md)

> [!IMPORTANT]
> この直下に `package.json` やビルド設定を置かないこと（アプリの設定探索が親へ漏れる構造に戻るため）。
> 詳細は [`CLAUDE.md`](CLAUDE.md)。

