# skill-host-independence Specification

## Purpose

`.claude/skills/` 配下のスキル文書がホスト非依存であるための規則を定義する。Studio の画面座標を書かないこと、担当先の補足説明を書かないこと、ホストごとの能力差を契約文書へ委ねること、逆に実装契約としての参照は維持すること、および Studio 専用スキルの例外条件を規定する。
## Requirements
### Requirement: スキル文書に Studio の画面座標を書かない

`.claude/skills/` 配下のスキル文書（`SKILL.md` および `references/` の Markdown）は、DX Training Studio の**画面上の位置を指す語**を含んではならない（SHALL NOT）——「ペイン1」「ペイン2」「Pane4」「ペイン3 の Agent」等。スキルは Claude Code・Cursor など任意のホストから読まれる前提であり、特定ホストの画面構成に依存した記述は**そのホストの改修で無言のうちに誤りになる**。

⚠ この規則は Studio 実装の**内部識別子**には及ばない（SHALL NOT apply）——`Pane4Shell`・`Pane4View`・`clampPaneWidth("pane4", …)` 等はコードの名前であり、UI の位置を主張するものではない。

#### Scenario: 画面座標を含む記述が無い

- **WHEN** `.claude/skills/` 配下のスキル文書を「ペイン」「Pane」で検索する
- **THEN** 一致は0件である（`general-chat` を除く。後述の例外要件を参照）

#### Scenario: 実装の内部名は対象外

- **WHEN** Studio の実装が `Pane4Shell` という部品名を持っている
- **THEN** その改名は本要件の対象ではなく、スキル文書の修正も不要である

### Requirement: 担当先の補足説明を書かない

スキル文書は「その作業を**誰が／どこで**やるか」の補足説明を書いてはならない（SHALL NOT）——「画像の生成は Studio が行う」「人が Studio で直す」等。責任範囲は「このスキルがやる／やらない」を示せば足り（SHALL）、やらない作業の担当先まで書かなくても指示は成立する。

ただし、記述が**そのスキルの指示の根拠**になっている場合は削除してはならない（SHALL NOT）——判断の理由が失われ、命令だけが残るため。この場合はホスト名を主語から外し、**機能や挙動を主語にした受動的な書き方へ置き換えなければならない**（SHALL）。

#### Scenario: 担当先の補足を削除する

- **WHEN** 責任範囲の表に「画像そのものの生成（Studio の Pane4 が行う）」と書かれている
- **THEN** 括弧ごと削除し「画像そのものの生成」とする——やらないことの区分は変わらない

#### Scenario: 根拠になっている記述は主語を置き換える

- **WHEN** 「Studio はコメント本文をそのまま生成プロンプト欄へ送るため、印を付けるとプロンプトに混入する」と書かれている
- **THEN** 「コメント本文はそのまま画像生成のプロンプトになるため、印を付けるとプロンプトに混入する」へ置き換え、因果を保ったままホスト名を外す

### Requirement: ホストごとの能力差は契約文書に委ねる

スキル文書は、ホストによる機能制限やモデルの強さの差を**要約して持ってはならない**（SHALL NOT）——正本は `contracts/agent-write-contract.md` であり、スキル側の要約は二重管理になる。制約に触れる必要がある箇所では、契約文書への参照だけを置かなければならない（SHALL）。

⚠ 要約を削除する前に、削除する具体（書き込み可能な階層・保護されるフィールド等）が**契約文書側に記載されていることを確認しなければならない**（SHALL）。無ければ契約文書へ移してから削除すること（SHALL）。

#### Scenario: ホスト差の記述を契約参照へ置き換える

- **WHEN** スキルの制約欄に「理想環境（Claude Code・強いモデル）を前提にする。Studio の Pane4 Agent では動かない」と書かれている
- **THEN** その記述を削除し、必要な制約は `contracts/agent-write-contract.md` の参照で示す

### Requirement: 実装契約としての参照は維持する

スキルが**実際に読み込む・import する実装ファイルへのパス**は、Studio 配下であっても記述を維持しなければならない（SHALL）。これは補足説明ではなく、ロジックの複製を禁じる SSoT 規則そのものである。

#### Scenario: import するパスは残る

- **WHEN** 翻訳スキルの走査スクリプトが `studio/lib/translation/freshness.ts` を import している
- **THEN** SKILL.md とスクリプト内の当該パスの記述は削除されない

### Requirement: Studio 専用スキルは本要件の対象外とする

ホストを Studio に限定して作られたスキルは、上記の要件の対象外とする（SHALL NOT apply）。判定条件は、フロントマターで `hidden: true` であり、かつ Studio 固有のツール（`search_company_context` 等）を `tools:` に宣言していることとする（SHALL）。これらは他ホストでは動作しないため、ホスト非依存にする実益がない。

#### Scenario: general-chat は変更しない

- **WHEN** `general-chat` が「あなたは DX Training Studio の教材制作アシスタントです」と名乗っている
- **THEN** ホスト名の記述は維持され、本 capability の検査対象から除外される
