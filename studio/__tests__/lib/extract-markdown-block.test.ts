import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractMarkdownBlock } from "@/lib/extract-markdown-block";

describe("extractMarkdownBlock", () => {
  it("extracts fenced markdown block", () => {
    const input = "説明文\n\n```markdown\n# Title\n\nBody\n```\n\n後書き";
    const result = extractMarkdownBlock(input);
    expect(result).toBe("# Title\n\nBody");
  });

  it("falls back to full content when no fence", () => {
    expect(extractMarkdownBlock("# Title")).toBe("# Title");
  });

  it("strips four-backtick wrapper and inner markdown fences", () => {
    const input = [
      "````markdown",
      "```markdown",
      "---",
      "series: Example",
      "---",
      "",
      "# Title",
      "```",
      "````",
    ].join("\n");

    const result = extractMarkdownBlock(input);
    expect(result).toBe(["---", "series: Example", "---", "", "# Title"].join("\n"));
    expect(result).not.toContain("```markdown");
    expect(result).not.toMatch(/^```/m);
  });

  it("extracts full draft with nested code blocks", () => {
    const input = [
      "````markdown",
      "```markdown",
      "---",
      "series: Example",
      "---",
      "",
      "# Title",
      "",
      "```bash",
      "conda --version",
      "```",
      "",
      "Tail section",
      "```",
      "````",
    ].join("\n");

    const result = extractMarkdownBlock(input);
    expect(result).toContain("```bash\nconda --version\n```");
    expect(result).toContain("Tail section");
    expect(result).not.toContain("```markdown");
  });

  it("extracts from real create-draft session message", () => {
    // 実際の create-draft セッションから取り出した応答を fixture として同梱する。
    // 以前は正本 `contents/` の session.json を直接読んでいたが、正本は移動・整理の
    // 対象なので（実際に contents-old へ退避してテストが壊れた）ここでは固定する。
    const fixturePath = path.join(
      import.meta.dirname,
      "..",
      "fixtures",
      "create-draft-session-message.json",
    );
    const message = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      id: string;
      role: string;
      content: string;
    };

    expect(message.id.endsWith("h72epe")).toBe(true);
    const result = extractMarkdownBlock(message.content);

    expect(result.startsWith("---")).toBe(true);
    expect(result).toContain("# Anaconda セットアップ");
    expect(result).toContain("```bash\nconda --version\n```");
    expect(result).toContain("次のステップ");
    expect(result).not.toContain("```markdown");
  });
});
