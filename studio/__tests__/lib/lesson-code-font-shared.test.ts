import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const globalsCss = readFileSync(
  join(process.cwd(), "app", "globals.css"),
  "utf8",
);
const editorSetup = readFileSync(
  join(process.cwd(), "lib", "lesson-content-editor-setup.ts"),
  "utf8",
);

/**
 * 編集モード・プレビュー・差分ビューでコードのフォントがズレると、
 * 編集画面で揃っているアスキーアートがプレビューで崩れる。
 * 3 者が同じ CSS カスタムプロパティを参照していることを固定する。
 */
describe("レッスン本文のコード用フォント", () => {
  it("--font-code が 1 度だけ定義されている", () => {
    const defs = globalsCss.match(/^\s*--font-code:/gm) ?? [];
    expect(defs).toHaveLength(1);
  });

  it("プレビューのコードブロックが --font-code を参照する", () => {
    expect(globalsCss).toMatch(
      /\.lesson-preview:not\(\.agent-chat-message\) pre code \{\s*font-family: var\(--font-code\);/,
    );
  });

  it("差分ビューが --font-code を参照する", () => {
    expect(globalsCss).toMatch(
      /\.lesson-diff-view \{\s*font-family: var\(--font-code\);/,
    );
  });

  it("編集モード（CodeMirror）が --font-code を参照する", () => {
    expect(editorSetup).toContain('fontFamily: "var(--font-code)"');
  });

  it("罫線素片や日本語のグリフを持たないフォントを先頭に置かない", () => {
    const decl = globalsCss.match(/--font-code:([\s\S]*?);/)?.[1] ?? "";
    // JetBrains Mono は罫線・日本語を持たず、ASCII だけ別フォントになる混植を招く
    expect(decl).not.toMatch(/JetBrains Mono/);
    expect(decl).toMatch(/ui-monospace/);
  });
});
