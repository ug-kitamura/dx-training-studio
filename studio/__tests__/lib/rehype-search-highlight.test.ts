import { describe, expect, it } from "vitest";
import type { Element, Root } from "hast";
import { rehypeSearchHighlight } from "@/lib/rehype-search-highlight";
import { buildLessonPreviewRehypePlugins } from "@/lib/lesson-preview-markdown";

function element(tagName: string, ...children: Element["children"]): Element {
  return { type: "element", tagName, properties: {}, children };
}

function text(value: string): Element["children"][number] {
  return { type: "text", value };
}

function tree(...children: Root["children"]): Root {
  return { type: "root", children };
}

/** 木を「タグ<内容>」の簡易表記へ落として比較しやすくする */
function serialize(node: { type: string; [key: string]: unknown }): string {
  if (node.type === "text") return String(node.value);
  if (node.type === "root" || node.type === "element") {
    const children = (node.children ?? []) as Array<{ type: string }>;
    const inner = children
      .map((child) => serialize(child as { type: string }))
      .join("");
    if (node.type === "root") return inner;
    const properties = node.properties as
      | { className?: unknown }
      | undefined;
    const cls = properties?.className;
    const marker = Array.isArray(cls) && cls.length ? `.${cls.join(".")}` : "";
    return `<${String(node.tagName)}${marker}>${inner}</${String(node.tagName)}>`;
  }
  return "";
}

function run(root: Root, query?: string): string {
  rehypeSearchHighlight({ query })(root);
  return serialize(root as unknown as { type: string });
}

describe("rehypeSearchHighlight", () => {
  it("wraps matches in a mark element", () => {
    const root = tree(element("p", text("最初のコミット")));
    expect(run(root, "コミット")).toBe(
      "<p>最初の<mark.lesson-search-highlight>コミット</mark></p>",
    );
  });

  it("splits text around the match", () => {
    const root = tree(element("h2", text("コミットの話")));
    expect(run(root, "コミット")).toBe(
      "<h2><mark.lesson-search-highlight>コミット</mark>の話</h2>",
    );
  });

  it("highlights inside nested elements", () => {
    const root = tree(element("p", element("a", text("コミット"))));
    expect(run(root, "コミット")).toBe(
      "<p><a><mark.lesson-search-highlight>コミット</mark></a></p>",
    );
  });

  it("highlights every occurrence", () => {
    const root = tree(element("p", text("コミットとコミット")));
    expect(run(root, "コミット")).toBe(
      "<p><mark.lesson-search-highlight>コミット</mark>と" +
        "<mark.lesson-search-highlight>コミット</mark></p>",
    );
  });

  it("ignores case", () => {
    const root = tree(element("p", text("GitHub")));
    expect(run(root, "github")).toBe(
      "<p><mark.lesson-search-highlight>GitHub</mark></p>",
    );
  });

  it("does not descend into marks it created", () => {
    // 二重ラップすると <mark> の中に <mark> が積み上がる
    const root = tree(element("p", text("コミット")));
    const once = run(root, "コミット");
    expect(run(root, "コミット")).toBe(once);
  });

  it("leaves the tree untouched for an empty query", () => {
    for (const query of ["", "   ", undefined]) {
      const root = tree(element("p", text("コミット")));
      expect(run(root, query)).toBe("<p>コミット</p>");
    }
  });
});

describe("buildLessonPreviewRehypePlugins", () => {
  it("appends the highlight plugin last so sanitize cannot strip it", () => {
    const plugins = buildLessonPreviewRehypePlugins("コミット");
    const last = plugins.at(-1);
    expect(Array.isArray(last) && last[0]).toBe(rehypeSearchHighlight);
  });

  it("returns the default list unchanged when there is no query", () => {
    const withQuery = buildLessonPreviewRehypePlugins("コミット");
    const withoutQuery = buildLessonPreviewRehypePlugins("");
    expect(withoutQuery.length).toBe(withQuery.length - 1);
    expect(withoutQuery).not.toContain(rehypeSearchHighlight);
  });
});
