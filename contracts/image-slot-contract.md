# レッスン画像指示契約（骨子 AI スキル向け）

## Markdown 記法

骨子 AI スキルは、画像生成の指示を **HTML コメント** に書く。

```markdown
<!--
Git の commit から push までを
4 ステップのフロー図 + ターミナル UI mock で
-->
```

- **プロンプト本文のみ**（ファイル名行は不要 — 生成時に AI がスラッグを付ける）
- コメントはプレビューに表示されない（制作メモ）
- `![…](images/…)` 形式の **未生成プレースホルダは使わない**

## ワークスペースでの制作フロー

1. 骨子 AI が `<!-- プロンプト -->` を本文に挿入
2. 作者が編集モードでコメント内にカーソルを置く → AI / Web タブのプロンプト欄へ **そのまま同期**
3. **AI**: 必要ならプロンプトを編集し **生成** → `images/ai/` に staging PNG
4. **Web**: 必要なら検索条件（説明文）を編集し **検索** → Pixabay から最大 3 枚を `images/web/` に staging
5. **挿入** → 正本 `images/<file>` へ promote + カーソル位置に `![短い alt](images/<file>)` を追加（コメントは残す）
6. **削除** → 正本・staging とも `images/trash/<file>` へ move（Markdown 参照は残る — 確認ダイアログあり）

| タブ | staging | promote 先 |
|---|---|---|
| UP | `images/uploaded/` | `images/` |
| AI | `images/ai/` | `images/` |
| Web | `images/web/` | `images/` |

### UP タブ（MP4 ショート録画）

- 操作デモ用の短い画面録画（Screenity 等で作成）を **MP4** でアップロードできる
- **上限 3 MB**（超過時は拒否）。**10 秒以内**の録画を推奨（秒数は検証しない）
- 挿入・参照追跡は画像と同様 `![alt](images/<file>.mp4)`。レビュー・Pane4 グリッドではクリック再生

### Web タブ（Pixabay 素材検索）

- プロンプト欄は **人間向けの説明文**（図解指示でも可 — 検索時に Claude が Pixabay キーワードへ変換）
- **検索** で Pixabay 固定・写実ビジネス優先・最大 3 枚を staging へ追加
- **自動入力**: 常に Claude がプロンプト／説明文を生成。コメント内にいる場合はコメント本文を `seedPrompt` として渡し再構成
- 要 **`AI_API_KEY`**（プランナー・自動入力）と **`PIXABAY_API_KEY`**（検索）

## 生成品質

AI タブの図解生成（`lib/ai-image-prompt.ts`）は次の品質規則に従う。

### グラフィック語彙

- 身近な UI を Tailwind mock で再現（ターミナル、エディタ、ブラウザ、チャット、アプリ画面）— 図の外側に prose で説明しない
- 構造図 **と** 体験再現 mock を組み合わせてよい
- 構造パターン: アナロジー、ステップフロー、左右比較、カードグリッド、番号カード、入れ子ブロック、誤解 vs 正解、タイムライン
- 体験 mock: チャット UI、エディタ UI（traffic lights + サイドバー）、ターミナル UI、ブラウザ UI、汎用アプリ mini 画面
- UI mock の内側は**そのアプリが実際に既定とする配色**で描く: VS Code / Cursor / ターミナル・コマンドプロンプトはダーク、GitHub / Claude Code / Notepad++ はライト。判断がつかないときエディタ・ターミナル・コードブロックはダーク。実画面と印象が違う mock は受講者の手がかりにならない
- Lucide は `data-lucide` 属性のみ。絵文字禁止。図内は Tailwind utility のみ
- テキストはステップ・カード・UI mock **内** に置く（短いラベル、2〜3 行ヒント）。図の外側に導入段落・要約・キャプションは **禁止**
- 任意で図タイトル 1 行（h3）可

### 配色・レイアウト

- `custom.*` Tailwind 色: `custom-surface`, `custom-border`, `custom-muted`, `custom-dim`, `custom-accent` 等
- 1 図 1 ブロック（例: `bg-custom-surface rounded-xl` カード）。ページ hero や外側 prose なし
- 横幅目安 640〜960 CSS px（UI mock は広め、フロー図は狭め）。横並び過多は避け、必要なら縦積み。図内テキストは `text-xs`（12px）以上
- **図の地（外枠のカード・図全体の背景）はライト**で、アプリのダークテーマに依存しない。ダークになるのは UI mock の内側だけ（上のグラフィック語彙を参照）
- **左右にカードを並べて対比する図は、左右の要素の位置をそろえる**（実現方法は問わない）
- `<script>`, `<style>`, 外部画像、絵文字は禁止

### 出力形式

Claude 応答は JSON のみ: `{"slug":"english-kebab-case","alt":"短い日本語説明","html":"<div>...</div>"}`
