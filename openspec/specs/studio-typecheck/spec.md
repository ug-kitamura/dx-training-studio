# studio-typecheck Specification

## Purpose

Studio のソースが、テストコードを含めて TypeScript の型検査を通ることを定める。`next build` の型検査はテストの診断を捨てるため、型健全性の根拠は `tsc --noEmit` に置く。

## Requirements
### Requirement: Studio のソースはテストコードを含めて型検査を通る

`studio/` で `npx tsc --noEmit` を実行したとき、エラーは 0 件でなければならない（SHALL）。この対象には `__tests__/` 配下のテストコードを含む（SHALL）。

`next build` の型検査を型健全性の根拠にしてはならない（SHALL NOT）——Next 本体は tsconfig のプログラムにテストを含めるが、`**/__(tests|mocks)__/**` と `**/*.(spec|test).*` にマッチするファイル由来の診断を捨てるため、テストの型エラーは `next build` では検出できない。`vitest` も既定では型検査を行わない。したがって `tsc --noEmit` が唯一の検出手段である。

この検出は **CI で自動化しなければならない**（SHALL）——手元で回すかどうかに依存させてはならない（SHALL NOT）。実行の契機と順序は `studio-ci` に従う。

#### Scenario: テストを含めて型検査が通る

- **WHEN** `studio/` で `npx tsc --noEmit` を実行する
- **THEN** エラーが 0 件で終了する

#### Scenario: テストの型エラーはビルドでは検出できない

- **WHEN** `__tests__/` 配下のファイルに型エラーを入れて `studio/` で `npm run build` を実行する
- **THEN** 型検査は通過してビルドが成功する
- **AND** 同じ状態で `npx tsc --noEmit` を実行するとエラーとして報告される

#### Scenario: 腐りが main へ入る前に止まる

- **WHEN** `__tests__/` 配下に型エラーを含む pull request を開く
- **THEN** CI が失敗し、main へマージできる状態にならない
### Requirement: 型のずれはテスト側を実装に合わせて直す

テストコードと実装の型がずれた場合、**実装側の型が正本**であり、テスト側を実装に合わせて直さなければならない（SHALL）。テストを通すために実装の型を緩めてはならない（SHALL NOT）。

型エラーを型アサーション（`as`）・`any`・`@ts-expect-error` で黙らせてはならない（SHALL NOT）。ただし、そのテストが**型エラーになること自体を検証している**場合に限り `@ts-expect-error` を使ってよい（MAY）。

#### Scenario: fixture が実装の型からずれている

- **WHEN** 実装のフィールド名が変わり、テストの fixture が古い名前のままになっている
- **THEN** fixture を新しい名前へ揃え、その型が必須とする他のフィールドも補う
- **AND** 実装側のフィールド名やオプショナル性は変更しない
