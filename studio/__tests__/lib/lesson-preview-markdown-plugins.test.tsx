import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import ReactMarkdown from "react-markdown";
import {
  lessonPreviewRehypePlugins,
  lessonPreviewRemarkPlugins,
} from "@/lib/lesson-preview-markdown";

afterEach(cleanup);

/** ペイン3 プレビューと同一のプラグイン構成でレンダリングする。 */
function renderPreview(markdown: string): HTMLElement {
  const { container } = render(
    <div className="lesson-preview">
      <ReactMarkdown
        remarkPlugins={lessonPreviewRemarkPlugins}
        rehypePlugins={lessonPreviewRehypePlugins}
      >
        {markdown}
      </ReactMarkdown>
    </div>,
  );
  return container;
}

describe("プレビューの details 折りたたみ", () => {
  it("details / summary が要素としてレンダリングされる", () => {
    const container = renderPreview(
      "<details><summary>答え</summary>\n\n中身の段落\n\n</details>",
    );

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.querySelector("summary")?.textContent).toBe("答え");
    expect(details?.textContent).toContain("中身の段落");
  });

  it("open 属性が保たれる", () => {
    const container = renderPreview(
      "<details open><summary>答え</summary>\n\n中身\n\n</details>",
    );

    expect(container.querySelector("details")?.hasAttribute("open")).toBe(true);
  });

  it("script はレンダリングされない", () => {
    const container = renderPreview('<script>alert("x")</script>\n\n本文');

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).not.toContain("alert");
  });

  it("イベントハンドラ属性は除去される", () => {
    const container = renderPreview(
      '<details onclick="alert(1)"><summary>S</summary>b</details>',
    );

    expect(container.querySelector("details")?.hasAttribute("onclick")).toBe(
      false,
    );
  });
});

describe("プレビューの GitHub アラート", () => {
  const ALERTS = [
    ["NOTE", "note"],
    ["TIP", "tip"],
    ["IMPORTANT", "important"],
    ["WARNING", "warning"],
    ["CAUTION", "caution"],
  ] as const;

  it.each(ALERTS)("%s が種別 class 付きで描画される", (label, type) => {
    const container = renderPreview(`> [!${label}]\n> 本文です。`);

    const alert = container.querySelector(`.markdown-alert-${type}`);
    expect(alert).not.toBeNull();
    expect(alert?.classList.contains("markdown-alert")).toBe(true);
    expect(alert?.textContent).toContain("本文です。");
  });

  it("アラート記法の生テキストは本文に残らない", () => {
    const container = renderPreview("> [!NOTE]\n> 補足情報です。");

    expect(container.textContent).not.toContain("[!NOTE]");
  });

  it("5 種がすべて別の class で描画される", () => {
    const source = ALERTS.map(
      ([label]) => `> [!${label}]\n> ${label} の本文。`,
    ).join("\n\n");
    const container = renderPreview(source);

    for (const [, type] of ALERTS) {
      expect(container.querySelectorAll(`.markdown-alert-${type}`)).toHaveLength(
        1,
      );
    }
  });

  it("通常の blockquote はアラートにならない", () => {
    const container = renderPreview("> ふつうの引用。");

    expect(container.querySelector(".markdown-alert")).toBeNull();
    expect(container.querySelector("blockquote")?.textContent).toContain(
      "ふつうの引用。",
    );
  });
});

describe("プレビューの CJK 強調", () => {
  it("全角約物に隣接して閉じる強調が太字になる", () => {
    const container = renderPreview(
      "Git がそれを実現している**3つの場所（三大エリア）**を地図として手に入れます。",
    );

    expect(container.querySelector("strong")?.textContent).toBe(
      "3つの場所（三大エリア）",
    );
    expect(container.textContent).not.toContain("**");
  });

  it("従来どおりの強調も引き続き太字になる", () => {
    const container = renderPreview("これは **強調** です。");

    expect(container.querySelector("strong")?.textContent).toBe("強調");
  });
});

describe("プレビューのコードハイライト", () => {
  it("diff フェンスで追加行・削除行に class が付く", () => {
    const container = renderPreview("```diff\n-old line\n+new line\n```");

    expect(container.querySelector(".hljs-deletion")?.textContent).toContain(
      "-old line",
    );
    expect(container.querySelector(".hljs-addition")?.textContent).toContain(
      "+new line",
    );
  });

  it("bash フェンスがハイライトされる", () => {
    const container = renderPreview('```bash\ngit commit -m "hi"\n```');

    const code = container.querySelector("pre code");
    expect(code?.classList.contains("hljs")).toBe(true);
    expect(code?.classList.contains("language-bash")).toBe(true);
    expect(code?.querySelectorAll("span").length).toBeGreaterThan(0);
  });
});

describe("既存の描画が変わらない", () => {
  it("GFM の表が描画される", () => {
    const container = renderPreview(
      "| 列A | 列B |\n|---|---|\n| a | b |",
    );

    expect(container.querySelectorAll("table th")).toHaveLength(2);
    expect(container.querySelectorAll("table td")).toHaveLength(2);
  });

  it("タスクリストがチェックボックスとして描画される", () => {
    const container = renderPreview("### 確認問題\n\n- [ ] 問1\n- [x] 問2");

    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect((boxes[1] as HTMLInputElement).checked).toBe(true);
  });

  it("HTML コメントは表示されない", () => {
    const container = renderPreview("<!-- 画像プロンプト -->\n\n本文");

    expect(container.textContent).not.toContain("画像プロンプト");
    expect(container.textContent).toContain("本文");
  });
});
