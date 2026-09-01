# ai-contracts Specification

## Purpose

ランタイム AI 向け規則 Markdown（`contracts/`）の配置、社内コンテキスト整形契約、画像 slot 契約の自己完結化とドキュメント参照先を定義する。
## Requirements
### Requirement: contracts フォルダで AI 規則を集約する

`dx-training-studio/contracts/` ディレクトリを作成し、ランタイム AI 向け規則 Markdown を配置しなければならない（SHALL）。`docs/` 内の grill-me・設計記録とは分離しなければならない（SHALL）。

#### Scenario: contracts フォルダが存在する

- **WHEN** リポジトリをクローンする
- **THEN** `contracts/` ディレクトリが存在する

### Requirement: 社内コンテキスト整形契約

`contracts/context-format-contract.md` を作成し、AI 整形 API 向けの規則を自己完結で記載しなければならない（SHALL）。少なくとも次を含めなければならない（SHALL）: 原文にない事実・手順・URL を追加しないこと、Markdown 出力、**title** の生成、**tags 1〜3 個（必須）** の提案、原文から取得できる場合のみ **source_last_updated_at**（`YYYY-MM-DD`）の抽出、既存タグリストが渡された場合は既存タグを優先すること。出力 JSON スキーマは `{"title":"...","body":"...","suggestedTags":["..."],"source_last_updated_at":"YYYY-MM-DD"|null}` でなければならない（SHALL）。

#### Scenario: 契約が創作禁止を規定する

- **WHEN** 開発者が `contracts/context-format-contract.md` を読む
- **THEN** 原文にない内容の追加禁止が明記されている

#### Scenario: 契約が拡張 JSON スキーマを規定する

- **WHEN** 開発者が契約の出力形式セクションを読む
- **THEN** `title` と `source_last_updated_at` が含まれる
- **AND** `suggestedTags` は 1〜3 個必須と明記されている

### Requirement: 画像 slot 契約の移行と自己完結化

`docs/image-slot-contract.md` を `contracts/image-slot-contract.md` に移行しなければならない（SHALL）。移行後、リポジトリ外のスキル・ファイル（`creating-visual-explainers`、`model-answer.html` 等）への参照を削除し、生成品質規則を契約ファイル内に自己完結で記載しなければならない（SHALL）。`CLAUDE.md` および `readme.md` のリンクを `contracts/` に更新しなければならない（SHALL）。

#### Scenario: 外部スキル参照がない

- **WHEN** `contracts/image-slot-contract.md` の「生成品質」セクションを読む
- **THEN** リポジトリ外パスへの参照が含まれない
- **AND** グラフィック語彙・配色・図内/図外テキスト規則が本文に記載されている

#### Scenario: 旧パスへの参照が更新される

- **WHEN** `CLAUDE.md` を読む
- **THEN** 画像契約へのリンクが `contracts/image-slot-contract.md` を指す

### Requirement: 翻訳契約

`contracts/translation-contract.md` に、日本語正本 → 英語派生の翻訳規則を自己完結の Markdown で置かなければならない（SHALL）。最低限含める内容: **英訳するもの**（本文・画像プロンプトコメント・GitHub アラートの中身・コード内のコメント文）、**変えないもの**（URL・画像などのパス・ファイル名・コード本体・コマンド名・Markdown 構造・執筆者向けの空欄マーカー）、**迷ったときの作法**（訳さず `<!-- 訳注: … -->` で執筆者向けコメントを残す）、**`author` / `author_en` に触れないこと**、**トーン**（教材らしい平易な英語。日本語の慣用句と `〜側` を直訳しないこと）、**名前の規則**（シリーズ名・コース名は Title Case で階層語 Series / Course を含め、レッスン名は見出しと同じ Sentence case。いずれも半角 36 字以内）、**用語集**（固有名詞・訳語の統一。運用で育てる。追加は人が行う）。

名前の規則は**上限だけを示さなければならない**（SHALL）。上限を超えたときの手順（語の短縮など）を書いてはならない（MUST NOT）——上限を伝えれば収まる名前が最初から作られるため、二段階の手順はかえって不自然に切り詰めた名前を生む。短縮した名前を報告させる運用も置いてはならない（MUST NOT）。

この契約は Studio の翻訳 API（`studio-translation` capability）と翻訳スキルの両方が読む SSoT でなければならない（SHALL）——スキル側に規則の複製を持たせてはならない（SHALL NOT）。契約の更新は人が行い、実行スキルが書き換えてはならない（MUST NOT）。

#### Scenario: 契約が存在し規則を含む

- **WHEN** `contracts/translation-contract.md` を開く
- **THEN** 英訳する/変えないの規則・訳注の作法・名前の規則（形式と 36 字の上限）・用語集の節が含まれている

#### Scenario: 短縮の手順が書かれていない

- **WHEN** `contracts/translation-contract.md` の名前の規則を読む
- **THEN** 36 字の上限は書かれている
- **AND** 超過時に語を短縮する手順や、短縮した名前を報告する運用は書かれていない

#### Scenario: 翻訳 API が契約を注入する

- **WHEN** Studio の翻訳 API を実行する
- **THEN** プロンプトに契約の全文が含まれている

### Requirement: 翻訳契約は既存の英語表記に合わせる規則と章の定型句を持つ

`contracts/translation-contract.md` は、**訳文の種類を問わず（レッスン本文・`changelog.en.md`・`.meta.json` の `_en` フィールド）既存の英語表記に合わせる**規則を持たなければならない（SHALL）。規則は次の3段の強さで書き分けなければならない（SHALL）——強さを1段に均してはならない（SHALL NOT）。固有名を「参考にする」まで弱めると、表記の食い違いを許す規則になるためである。

1. **固有名は表記をそのまま使う**（SHALL）: シリーズ・コース・レッスンを固有名として参照するとき、その `.meta.json` の `name_en` の表記（大文字小文字・階層語 Series / Course を含む）をそのまま使わなければならない（SHALL）。総称としての "this series" / "the next course" / "the previous lesson" はこの規則の対象外である。
2. **固有名以外の英語表記は語彙と言い回しを合わせる**（SHALL）: `description_en` / `catch_en` / `target_en` に既に英語表記があるとき、訳文はその語彙と言い回しに合わせなければならない（SHALL）。文脈が異なるため丸写ししてはならない（SHALL NOT）。
3. **参照先が未翻訳のときは訳注を残す**（SHALL）: 参照先の `.meta.json` に対応する英語表記がまだ無いときは、自分で訳したうえで訳注を残さなければならない（SHALL）。翻訳はユニット単位で進み、1ユニット内でも本文がメタより先に書かれるため、参照先が未翻訳である状態は通常発生する。訳注の書式は既存の「迷ったときの作法」に従う。

「用語集」には、レッスンの章立てと演習の定型句の英語を含めなければならない（SHALL）: 学習目標 → Learning goals／やってみる → Try it／前提 → Given／考えなくてよいこと → Don't worry about／解答例 → Sample answer／確認問題 → Check your understanding。

#### Scenario: 固有名参照の規則がある

- **WHEN** `contracts/translation-contract.md` の英語表記の規則を読む
- **THEN** シリーズ・コース・レッスン名の参照は `name_en` の表記をそのまま使う旨が書かれている
- **AND** その対象が本文だけでなく changelog とメタも含む旨が書かれている

#### Scenario: 固有名以外は語彙を合わせる

- **WHEN** `contracts/translation-contract.md` の英語表記の規則を読む
- **THEN** `description_en` / `catch_en` / `target_en` は語彙と言い回しを合わせる旨と、丸写ししない旨が書かれている

#### Scenario: 参照先が未翻訳のときの逃げ道がある

- **WHEN** `contracts/translation-contract.md` の英語表記の規則を読む
- **THEN** 参照先に英語表記が無いときは自分で訳して訳注を残す旨が書かれている

#### Scenario: 章見出しの定型句が用語集にある

- **WHEN** `contracts/translation-contract.md` の用語集を読む
- **THEN** 学習目標／やってみる／前提／考えなくてよいこと／解答例／確認問題 の6語に対応する英語が載っている

### Requirement: 翻訳契約は日本語の慣用句と空欄マーカーの扱いを定める

`contracts/translation-contract.md` の「トーン」には、身体・物理の慣用句（骨・手を動かす・目を通す・腑に落ちる・嫌な顔をする等）を直訳してはならない（MUST NOT）旨と、字面ではなく働きを英語の言い方に置き換えなければならない（SHALL）旨を含めなければならない（SHALL）。同じ慣用句の英訳は文ごとに異なってよく、既訳が揃っていないことを理由に統一してはならない（MUST NOT）——統一の対象は「用語集」の語と章の定型句だけである。

「トーン」には、`〜側` を英訳に持ち込んではならない（MUST NOT）旨を含めなければならない（SHALL）。例外はコンフリクトの両側を指す場合（`your side` / `the incoming side`）に限らなければならず（SHALL）、同じレッスン内の他の `〜側` を例外の対象にしてはならない（MUST NOT）。

「変えないもの」には、執筆者向けの空欄マーカー（`> **社内**:` / `> **社内画像**:` のブロック）を英訳してはならない（MUST NOT）旨を含めなければならない（SHALL）。「迷ったときの作法」には、空欄マーカーを残したファイルに添える `<!-- 訳注: … -->` を**1ファイルに1本**とし、マーカーごとに付けてはならない（MUST NOT）旨を含めなければならない（SHALL）。

#### Scenario: 慣用句の直訳禁止と不統一の許容がある

- **WHEN** `contracts/translation-contract.md` の「トーン」を読む
- **THEN** 身体・物理の慣用句を直訳しない旨が書かれている
- **AND** 同じ慣用句の英訳が文ごとに違ってよく、揃っていない既訳を統一しない旨が書かれている

#### Scenario: `〜側` の規則と例外の範囲がある

- **WHEN** `contracts/translation-contract.md` の「トーン」を読む
- **THEN** `〜側` を英訳に残さない旨が書かれている
- **AND** 例外がコンフリクトの両側を指す場合に限られる旨が書かれている

#### Scenario: 空欄マーカーは訳さず訳注は1ファイル1本

- **WHEN** `contracts/translation-contract.md` の「変えないもの」と「迷ったときの作法」を読む
- **THEN** `> **社内**:` / `> **社内画像**:` のブロックを訳さない旨が書かれている
- **AND** 訳注は1ファイルに1本で、マーカーごとには付けない旨が書かれている

