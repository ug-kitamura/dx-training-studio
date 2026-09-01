# dx-training-studio（入れ物）

DX ツールトレーニングのプロジェクト一式。**このディレクトリは「入れ物」であり、`package.json`・`node_modules`・ビルドツール設定を置いてはならない**——置くとアプリからの設定探索・モジュール解決が親へフォールバックする穴が復活する（`project-layout` spec の要件）。

```
dx-training-studio/
├─ start-studio(-dev).bat      Studio 起動（本番相当 / 開発。port 3001）
├─ start-mandala(-dev).bat     公開サイト起動（本番相当 / 開発。port 3002）
├─ studio/    ← 執筆スタジオ（Next.js）。編集ルールは studio/CLAUDE.md
├─ mandala/   ← 公開サイト（Nextra）。手順書は mandala/README.md
├─ contents/       正本: シリーズ / コース / レッスン
├─ images/         正本: 画像（staging と動画は git 除外）
├─ contents-work/  計画書・run 記録・Agent の会話
├─ local-db/       社内コンテキスト（ローカルモード）
├─ contracts/      ランタイム AI 向け契約文書
├─ docs/           handoff.md（引き継ぎ）・grill-me/
├─ .claude/        スキル（dx-training-create 等）
└─ openspec/       仕様・変更管理（planning home はこのディレクトリ）
```

- 正本データとプロジェクト共通ディレクトリは**どちらのアプリの子でもない**。アプリは「兄弟の正本を読む」（Studio は `lib/project-root.ts` の `getProjectRoot()` 経由）
- 両アプリは互いの `node_modules`・設定に依存しない（mandala の独立性は CI が検証する）
- 引き継ぎ・未決事項は `docs/handoff.md`、要件の正本は `openspec/specs/`

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
