import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/agent/skills/route";
import bakedCatalog from "@/lib/agent/skill-catalog.generated.json";

const roots: string[] = [];
let cwdSpy: ReturnType<typeof vi.spyOn> | undefined;

afterEach(() => {
  cwdSpy?.mockRestore();
  for (const root of roots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  roots.length = 0;
});

async function skillsOf(res: Response) {
  return ((await res.json()) as { skills: Array<{ id: string }> }).skills;
}

describe("GET /api/agent/skills", () => {
  it("ファイルシステムにスキルがあれば走査結果を返す", async () => {
    // 実リポジトリ（cwd = studio/ の親に .claude/skills がある）
    const skills = await skillsOf(await GET());
    expect(skills.map((s) => s.id)).toContain("dx-training-create");
  });

  it("走査が空なら焼き込みカタログへフォールバックする", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skills-route-"));
    roots.push(root);
    // `.claude` を持たない projectRoot（Vercel の関数コンテナ相当）
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));

    const skills = await skillsOf(await GET());
    expect(skills).toEqual(bakedCatalog);
    expect(skills.length).toBeGreaterThan(0);
  });
});
