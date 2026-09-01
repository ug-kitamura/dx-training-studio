import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/content/changelog/route";

describe("/api/content/changelog", () => {
  const roots: string[] = [];
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    cwdSpy?.mockRestore();
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  // ⚠ cwd 偽装を忘れると実 contents/changelog.md を汚染する（過去に実害あり）。
  // すべてのテストで最初に setup() を呼ぶこと
  function setup(): { root: string; file: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-api-"));
    roots.push(root);
    cwdSpy = vi
      .spyOn(process, "cwd")
      .mockReturnValue(path.join(root, "studio"));
    fs.mkdirSync(path.join(root, "contents"), { recursive: true });
    return { root, file: path.join(root, "contents", "changelog.md") };
  }

  function putRequest(body: unknown): Request {
    return new Request("http://localhost/api/content/changelog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("GET: 正本が無ければ exists=false", async () => {
    setup();
    const res = await GET();
    const data = await res.json();
    expect(data.exists).toBe(false);
    expect(data.content).toBe("");
    expect(data.mtimeMs).toBeNull();
  });

  it("GET: 内容と先頭エントリ日付を返す", async () => {
    const { file } = setup();
    fs.writeFileSync(file, "# 変更履歴\n\n## 2026-08-14\n\n- x\n", "utf-8");
    const res = await GET();
    const data = await res.json();
    expect(data.exists).toBe(true);
    expect(data.firstEntryDate).toBe("2026-08-14");
    expect(typeof data.mtimeMs).toBe("number");
  });

  it("PUT: 新規作成（baseMtimeMs=null）で内容をそのまま書く", async () => {
    const { file } = setup();
    // 整形・検証をしないこと: 末尾改行なし・崩れた書式もそのまま
    const content = "#変更履歴（崩れた書式）\nそのまま";
    const res = await PUT(putRequest({ content, baseMtimeMs: null }));
    expect(res.status).toBe(200);
    expect(fs.readFileSync(file, "utf-8")).toBe(content);
  });

  it("PUT: mtime が食い違えば 409 で現在の内容を返す（外部変更の検知）", async () => {
    const { file } = setup();
    fs.writeFileSync(file, "外部の内容\n", "utf-8");
    const res = await PUT(
      putRequest({ content: "上書きしようとした内容\n", baseMtimeMs: 12345 }),
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.content).toBe("外部の内容\n");
    // 正本は守られている
    expect(fs.readFileSync(file, "utf-8")).toBe("外部の内容\n");
  });

  it("PUT: GET で得た mtime を渡せば保存できる", async () => {
    const { file } = setup();
    fs.writeFileSync(file, "v1\n", "utf-8");
    const before = await (await GET()).json();
    const res = await PUT(
      putRequest({ content: "v2\n", baseMtimeMs: before.mtimeMs }),
    );
    expect(res.status).toBe(200);
    expect(fs.readFileSync(file, "utf-8")).toBe("v2\n");
  });
});
