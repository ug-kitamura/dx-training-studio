# workspace-pane-layout Specification

## Purpose

DX Training Studio のワークスペースペイン幅の clamp・snap ロジックを定義する。⚠ `tree` / `pane4` は**コード上の識別子**（`clampPaneWidth("pane4")` 等）であり、画面の番号ではない——画面は3ペイン（ツリー・エディタ／メタ・Agent／画像）で、`pane4` は一番右の Agent・画像ペインを指す。`components/workspace/pane-layout.ts` の pure function として実装され、リサイズ UI および設定モーダルから利用される。
## Requirements
### Requirement: ペイン幅は clamp により範囲内に収める

各ペイン（tree / pane4）の幅は `PANE_WIDTH_LIMITS` で定義された min/max の範囲内に収めなければならない（SHALL）。`clampPaneWidth` はこの規則を pure function として実装しなければならない（SHALL）。tree の min/max は **250 / 450**、pane4 の min/max は **400 / 700** でなければならない（SHALL）。`PANE_WIDTH_DEFAULTS` は tree **350**、pane4 **500** でなければならない（SHALL）。

#### Scenario: 下限未満の値を clamp

- **WHEN** `clampPaneWidth("tree", 100)` を呼び出す
- **THEN** 結果は tree の min（250）である

#### Scenario: 上限超過の値を clamp

- **WHEN** `clampPaneWidth("pane4", 1500)` を呼び出す
- **THEN** 結果は pane4 の max（700）である

#### Scenario: pane4 下限 clamp

- **WHEN** `clampPaneWidth("pane4", 200)` を呼び出す
- **THEN** 結果は pane4 の min（400）である

#### Scenario: 旧下限で保存された幅が丸まる

- **WHEN** `localStorage` に旧下限の pane4 幅（例: 300）が保存された状態で起動する
- **THEN** 読み込み時に 400 へ clamp され、エラーにならない

#### Scenario: 旧上限で保存された幅が丸まる

- **WHEN** `localStorage` に旧上限の pane4 幅（例: 1000）が保存された状態で起動する
- **THEN** 読み込み時に 700 へ clamp され、エラーにならない

### Requirement: 設定モーダル用 snap は PANE_WIDTH_STEP 刻みに丸める

`snapPaneWidth` は clamp 後に `PANE_WIDTH_STEP`（5px）刻みで丸めなければならない（SHALL）。`snapPaneWidths` は全ペイン（tree / pane4）に適用しなければならない（SHALL）。

#### Scenario: 刻みに snap

- **WHEN** `snapPaneWidth("tree", 213)` を呼び出す
- **THEN** 結果は 215 である

#### Scenario: snapPaneWidths が全ペインに適用される

- **WHEN** 任意の `WorkspacePaneWidths` を `snapPaneWidths` に渡す
- **THEN** 返却値の各ペイン幅は対応する min/max 内かつ 5px 刻みである

### Requirement: fitPaneLayout は利用可能幅にペインを収める

`fitPaneLayout` pure function は、要求幅（tree / pane4）と利用可能幅を受け取り、Pane3 最小幅を満たすよう tree / pane4 を調整した `WorkspacePaneWidths` を返さなければならない（SHALL）。各 pane は `PANE_WIDTH_LIMITS` の min/max 内に収めなければならない（SHALL）。

#### Scenario: 幅に余裕がある

- **WHEN** 要求幅の合計 + pane3 min + ハンドルが利用可能幅以下である
- **THEN** tree / pane4 は要求値（clamp 後）のまま返される

#### Scenario: 不足時は pane4 から縮小

- **WHEN** 要求幅の合計が利用可能幅を超え、pane4 が開いている
- **THEN** まず pane4 幅を min（400）まで減らす

#### Scenario: 不足時の縮小順

- **WHEN** pane4 を min まで縮めても pane3 が 500 未満である
- **THEN** 次に tree を min（250）まで縮小する

### Requirement: fit はブラウザリサイズとペイン操作で実行する

ワークスペースは、SidebarInset 内ペイン行の幅変化（ResizeObserver）および tree / pane4 のリサイズハンドル操作、設定ダイアログからの横幅適用のたびに `fitPaneLayout` を実行し、返却値を pane 幅 state に反映しなければならない（SHALL）。横スクロールバーをレイアウト救済に用いてはならない（MUST NOT）。

#### Scenario: ウィンドウ幅を狭める

- **WHEN** ユーザーがブラウザウィンドウ幅を狭める
- **THEN** pane4 → tree の順で各 min まで自動縮小される
- **AND** pane3 実幅は 500px 以上が維持される（可能な範囲で）

#### Scenario: tree ハンドルで広げる

- **WHEN** ユーザーが tree を広げようとドラッグする
- **AND** pane3 に譲れる幅が不足する
- **THEN** fit により pane4 が先に縮小され tree 拡大が可能になる

### Requirement: 折りたたみ状態は fit から変更しない

`fitPaneLayout` は tree ペインの sidebar アイコン折りたたみ状態および pane4 の開閉（`pane4Open`）を変更してはならない（MUST NOT）。pane4 閉時は pane4 有効幅を折りたたみストリップ幅（48px）として計算に用いなければならない（SHALL）。

#### Scenario: pane4 閉時は 48px として fit

- **WHEN** pane4 が閉じている
- **THEN** fit の pane4 寄与幅は 48px である
- **AND** fit は pane4 を開く操作を行わない

#### Scenario: fit は sidebar 折りたたみを触らない

- **WHEN** fit が実行される
- **THEN** tree ペインの sidebar collapsible 状態は変化しない

### Requirement: Pane3 最小幅は 500px とする

Pane3（Markdown エディタペイン）の実幅は **500px 未満になってはならない**（SHALL NOT）。`PANE3_MIN_WIDTH` 定数（500）として `pane-layout.ts` に定義しなければならない（SHALL）。Pane3 幅は設定ダイアログの項目に含めてはならない（MUST NOT）。

#### Scenario: fit 後の pane3 が min 以上

- **WHEN** `fitPaneLayout` が任意の入力で実行される
- **THEN** 返却後のレイアウトにおける pane3 実幅は 500px 以上である（利用可能幅が全 min 合計未満の例外を除く）

#### Scenario: 設定 UI に pane3 幅がない

- **WHEN** ユーザーがワークスペース設定ダイアログの横幅セクションを開く
- **THEN** 編集可能なペイン幅入力は tree・pane4 の 2 つのみである

