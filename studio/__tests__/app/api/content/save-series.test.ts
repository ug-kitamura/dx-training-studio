import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { POST } from "@/app/api/content/save-series/route";

const roots: string[] = [];
let cwdSpy: ReturnType<typeof vi.spyOn> | undefined;

afterEach(() => {
  cwdSpy?.mockRestore();
  for (const root of roots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  roots.length = 0;
});

/** contents/Series/.meta.json を用意して、そのパスを返す */
function setupSeries(meta: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "save-series-"));
  roots.push(root);
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));
  const seriesDir = path.join(root, "contents", "Series");
  fs.mkdirSync(seriesDir, { recursive: true });
  const metaPath = path.join(seriesDir, ".meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
  return metaPath;
}

async function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/content/save-series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series: "Series", ...body }),
    }),
  );
}

function readMeta(metaPath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Record<
    string,
    unknown
  >;
}

describe("POST /api/content/save-series", () => {
  it("slug / catch / description を書き込み、既存フィールドを保全する", async () => {
    const metaPath = setupSeries({
      id: "srs-x",
      order: ["Course"],
      name_en: "Series X",
    });

    const res = await post({
      slug: "git-basics",
      catch: "ここから旅がはじまる",
      description: "説明",
    });

    expect(res.status).toBe(200);
    const meta = readMeta(metaPath);
    expect(meta.slug).toBe("git-basics");
    expect(meta.catch).toBe("ここから旅がはじまる");
    expect(meta.description).toBe("説明");
    // 既存フィールドが消えない
    expect(meta.id).toBe("srs-x");
    expect(meta.order).toEqual(["Course"]);
    expect(meta.name_en).toBe("Series X");
  });

  it("空文字は既存キーを削除する", async () => {
    const metaPath = setupSeries({
      id: "srs-x",
      slug: "old-slug",
      catch: "旧キャッチ",
    });

    const res = await post({ slug: "", catch: "", description: "" });

    expect(res.status).toBe(200);
    const meta = readMeta(metaPath);
    expect(meta).not.toHaveProperty("slug");
    expect(meta).not.toHaveProperty("catch");
    expect(meta).not.toHaveProperty("description");
    expect(meta.id).toBe("srs-x");
  });

  it("不正な slug は 400 で拒否し、ファイルを変更しない", async () => {
    const metaPath = setupSeries({ id: "srs-x", slug: "old-slug" });

    const res = await post({ slug: "Git基礎" });

    expect(res.status).toBe(400);
    expect(readMeta(metaPath).slug).toBe("old-slug");
  });

  it("省略したフィールドは保全される", async () => {
    const metaPath = setupSeries({ id: "srs-x", slug: "keep-me", catch: "残す" });

    const res = await post({ description: "新しい説明" });

    expect(res.status).toBe(200);
    const meta = readMeta(metaPath);
    expect(meta.slug).toBe("keep-me");
    expect(meta.catch).toBe("残す");
    expect(meta.description).toBe("新しい説明");
  });

  it("存在しないシリーズは 404", async () => {
    setupSeries({ id: "srs-x" });
    const res = await post({ series: "Missing", slug: "a" });
    expect(res.status).toBe(404);
  });
});
