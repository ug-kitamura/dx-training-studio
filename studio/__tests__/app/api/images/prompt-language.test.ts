import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lesson } from "@/lib/schema";

/**
 * 画像生成・プロンプト自動入力が編集言語を受け取り、そのまま Claude への
 * 指示に反映されることの検証（image-pane-language）。
 *
 * ⚠ `language` 省略は従来どおり `ja`——既存の呼び出しを壊さない。
 */

const savedFile = {
  path: "images/ai/x.png",
  name: "x.png",
  size: 1,
  updatedAt: "2026-08-22T00:00:00.000Z",
};

vi.mock("@/lib/image-store", () => ({
  saveStagingImage: vi.fn(async () => savedFile),
}));

vi.mock("@/lib/render-diagram-capture.mjs", () => ({
  renderDiagramToPng: vi.fn(async () => ({
    png: Buffer.from("png"),
    cssWidth: 800,
  })),
  buildSmallWidthWarning: vi.fn(() => null),
}));

vi.mock("@/lib/image-slug", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/image-slug")>();
  return { ...actual, resolveUniquePngFileName: vi.fn(async () => "x.png") };
});

const { POST: generateRoute } = await import("@/app/api/images/generate/route");
const { POST: suggestRoute } = await import(
  "@/app/api/images/suggest-prompt/route"
);

const lesson: Lesson = {
  id: "l1",
  series: "s",
  course: "c",
  lesson: "Git 入門",
  name_en: "Getting started with Git",
  status: "open",
  description: "desc",
  tags: [],
  estimated_minutes: 10,
  author: "",
  content: "English body",
};

/** Claude への送信内容を捕まえる fetch スタブ */
function stubClaude(text: string) {
  const calls: Array<{ system: string; user: string }> = [];
  global.fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      system: string;
      messages: Array<{ content: string }>;
    };
    calls.push({ system: body.system, user: body.messages[0].content });
    return new Response(
      JSON.stringify({ content: [{ type: "text", text }] }),
      { status: 200 },
    );
  }) as never;
  return calls;
}

function post(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ai-api-key": "k" },
    body: JSON.stringify(body),
  });
}

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.AI_API_KEY = "test-key";
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.clearAllMocks();
});

describe("画像生成 API の language", () => {
  const generationJson = JSON.stringify({
    slug: "flow",
    alt: "A flow",
    html: "<div>x</div>",
  });

  it("language 省略は日本語の指示のまま", async () => {
    const calls = stubClaude(generationJson);
    const res = await generateRoute(
      post("http://localhost/api/images/generate", { lesson, prompt: "flow" }),
    );

    expect(res.status).toBe(200);
    expect(calls[0].system).toContain("Japanese DX courses");
    expect(calls[0].system).not.toContain("MUST be written in English");
  });

  it("language: en で英語の図解を指示し、英語のレッスン名と本文を渡す", async () => {
    const calls = stubClaude(generationJson);
    const res = await generateRoute(
      post("http://localhost/api/images/generate", {
        lesson,
        prompt: "flow",
        language: "en",
      }),
    );

    expect(res.status).toBe(200);
    expect(calls[0].system).toContain("English DX courses");
    expect(calls[0].system).toContain("MUST be written in English");
    expect(calls[0].user).toContain("lesson: Getting started with Git");
    expect(calls[0].user).toContain("English body");
  });

  it("未知の language は 400 で拒否する", async () => {
    stubClaude(generationJson);
    const res = await generateRoute(
      post("http://localhost/api/images/generate", {
        lesson,
        prompt: "flow",
        language: "fr",
      }),
    );

    expect(res.status).toBe(400);
  });
});

describe("プロンプト自動入力 API の language", () => {
  it("language 省略は日本語の指示のまま", async () => {
    const calls = stubClaude("フロー図");
    const res = await suggestRoute(
      post("http://localhost/api/images/suggest-prompt", {
        lesson,
        cursorOffset: 0,
      }),
    );

    expect(res.status).toBe(200);
    expect(calls[0].system).toContain("a Japanese DX training lesson editor");
  });

  it("language: en で英語のプロンプトを指示する", async () => {
    const calls = stubClaude("A flow diagram");
    const res = await suggestRoute(
      post("http://localhost/api/images/suggest-prompt", {
        lesson,
        cursorOffset: 0,
        language: "en",
      }),
    );

    expect(res.status).toBe(200);
    expect(calls[0].system).toContain("an English DX training lesson editor");
    expect(calls[0].system).toContain("Write the prompt in English");
    expect(calls[0].user).toContain("lesson: Getting started with Git");
  });
});
