import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET, PUT } from "@/app/api/content/workspace-meta/route";

const roots: string[] = [];
let cwdSpy: ReturnType<typeof vi.spyOn> | undefined;

afterEach(() => {
  cwdSpy?.mockRestore();
  for (const root of roots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  roots.length = 0;
});

function setup(meta: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-meta-"));
  roots.push(root);
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));
  const contentsDir = path.join(root, "contents");
  fs.mkdirSync(contentsDir, { recursive: true });
  const metaPath = path.join(contentsDir, ".meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
  return metaPath;
}

async function put(body: Record<string, unknown>) {
  return PUT(
    new Request("http://localhost/api/content/workspace-meta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function readMeta(metaPath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Record<
    string,
    unknown
  >;
}

describe("workspace-meta API", () => {
  it("GET は name / description / hero / github_url を返す", async () => {
    setup({
      order: ["S"],
      name: "DX Training Mandala",
      hero: "web-1.jpg",
      github_url: "https://github.com/x/y",
    });
    const res = await GET();
    const data = (await res.json()) as Record<string, string>;
    expect(data).toEqual({
      name: "DX Training Mandala",
      description: "",
      hero: "web-1.jpg",
      github_url: "https://github.com/x/y",
      // 英語ビューの読み取りにも同じ GET を使うため _en も返る（未設定は空文字）
      name_en: "",
      description_en: "",
    });
  });

  it("PUT は指定フィールドを保存し、order 等を保全する", async () => {
    const metaPath = setup({ order: ["S"], description: "既存の説明" });
    const res = await put({
      name: "サイト名",
      hero: "hero-2.png",
      github_url: "https://github.com/a/b",
    });
    expect(res.status).toBe(200);
    const meta = readMeta(metaPath);
    expect(meta.name).toBe("サイト名");
    expect(meta.hero).toBe("hero-2.png");
    expect(meta.github_url).toBe("https://github.com/a/b");
    // 省略した description と既存 order は保全
    expect(meta.description).toBe("既存の説明");
    expect(meta.order).toEqual(["S"]);
  });

  it("空文字は既存キーを削除する", async () => {
    const metaPath = setup({ order: [], name: "旧名", hero: "old.png" });
    const res = await put({ name: "", hero: "" });
    expect(res.status).toBe(200);
    const meta = readMeta(metaPath);
    expect(meta).not.toHaveProperty("name");
    expect(meta).not.toHaveProperty("hero");
  });

  it("不正な URL は 400 で拒否する", async () => {
    const metaPath = setup({ order: [], github_url: "https://github.com/a/b" });
    const res = await put({ github_url: "not-a-url" });
    expect(res.status).toBe(400);
    expect(readMeta(metaPath).github_url).toBe("https://github.com/a/b");
  });
});
