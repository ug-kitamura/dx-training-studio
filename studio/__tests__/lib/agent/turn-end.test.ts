import { describe, expect, it } from "vitest";
import { classifyTurnEnd, hasTextProgress } from "@/lib/agent/turn-end";
import { buildIncompleteArtifactsNotice } from "@/lib/agent/llm/types";

describe("classifyTurnEnd", () => {
  const base = { hadAnyToolCalls: true, leftoverArtifactCount: 0 };

  const cases: Array<{
    name: string;
    input: Parameters<typeof classifyTurnEnd>[0];
    expected: string;
  }> = [
    {
      name: "疑問符で終わる → user-wait",
      input: { ...base, text: "どのファイルを使いますか？" },
      expected: "user-wait",
    },
    {
      name: "半角疑問符＋閉じ括弧 → user-wait",
      input: { ...base, text: "Shall I continue?)" },
      expected: "user-wait",
    },
    {
      name: "確認依頼の定型（minutes-maid Phase 3 相当） → user-wait",
      input: {
        ...base,
        text: "ドラフトを保存しました。内容をご確認・修正いただき、問題なければ「OK」とお知らせください。",
        leftoverArtifactCount: 3,
      },
      expected: "user-wait",
    },
    {
      name: "埋め残しあり → stalled（決定的シグナル）",
      input: {
        ...base,
        text: "セクション3まで作成しました。",
        leftoverArtifactCount: 2,
      },
      expected: "stalled",
    },
    {
      name: "継続予告＋ツール実績あり → stalled",
      input: {
        ...base,
        text: "ここまで作成しました。続きを次の応答で作成します。",
      },
      expected: "stalled",
    },
    {
      name: "継続予告でもツール実績なし → complete（雑談を nudge しない）",
      input: {
        text: "続きを知りたい場合はお申し付けください。残りの部分についても説明できます。続きを",
        hadAnyToolCalls: false,
        leftoverArtifactCount: 0,
      },
      expected: "complete",
    },
    {
      name: "通常の完了報告 → complete",
      input: { ...base, text: "議事録の生成が完了しました。" },
      expected: "complete",
    },
    {
      name: "空テキスト・埋め残しなし → complete",
      input: { ...base, text: "" },
      expected: "complete",
    },
    {
      name: "空テキストでも埋め残しあり → stalled",
      input: { ...base, text: "", leftoverArtifactCount: 1 },
      expected: "stalled",
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(classifyTurnEnd(c.input)).toBe(c.expected);
    });
  }
});

describe("hasTextProgress", () => {
  it("treats new content as progress", () => {
    expect(
      hasTextProgress("セクション1を書きました", "セクション2を書きました"),
    ).toBe(true);
  });

  it("treats identical output as no progress", () => {
    expect(hasTextProgress("同じ内容です", "同じ内容です")).toBe(false);
  });

  it("treats a substring repeat as no progress", () => {
    expect(
      hasTextProgress("AAA BBB CCC を出力しました", "BBB CCC を出力しました"),
    ).toBe(false);
  });

  it("treats empty current output as no progress", () => {
    expect(hasTextProgress("前回の出力", "   ")).toBe(false);
  });

  it("treats first output after empty previous as progress", () => {
    expect(hasTextProgress("", "初回の出力")).toBe(true);
  });
});

describe("buildIncompleteArtifactsNotice", () => {
  it("names the files with unfilled residue and marks incomplete", () => {
    const notice = buildIncompleteArtifactsNotice([
      "output/a.html",
      "output/b.md",
    ]);
    expect(notice).toContain("未完了");
    expect(notice).toContain("output/a.html");
    expect(notice).toContain("output/b.md");
  });
});
