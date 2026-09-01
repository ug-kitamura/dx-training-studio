import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prepareLessonMetaWrite } from "@/lib/agent/tools/lesson-meta-write-guard";

const REL = "contents/S/C/L/.meta.json";
const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

function tmpMetaPath(existing?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-meta-guard-"));
  tmpDirs.push(dir);
  const p = path.join(dir, ".meta.json");
  if (existing !== undefined) fs.writeFileSync(p, existing, "utf-8");
  return p;
}

describe("prepareLessonMetaWrite", () => {
  it("スキーマ適合の JSON を整形して受理する", () => {
    const result = prepareLessonMetaWrite(
      tmpMetaPath(),
      REL,
      JSON.stringify({ slug: "sample", status: "in_progress", tags: ["git"] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    expect(parsed.slug).toBe("sample");
    expect(parsed).not.toHaveProperty("id");
  });

  it("JSON として不正な内容を拒否する", () => {
    const result = prepareLessonMetaWrite(tmpMetaPath(), REL, "status: done");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(REL);
  });

  it("未知キー（order / series 等）を拒否する", () => {
    for (const body of [{ order: [] }, { series: "S" }, { lesson: "L" }]) {
      const result = prepareLessonMetaWrite(
        tmpMetaPath(),
        REL,
        JSON.stringify(body),
      );
      expect(result.ok).toBe(false);
    }
  });

  it("id は agent の値を無視して既存値を保持する", () => {
    const metaPath = tmpMetaPath(JSON.stringify({ id: "lsn-keep-123456" }));
    const result = prepareLessonMetaWrite(
      metaPath,
      REL,
      JSON.stringify({ id: "lsn-evil-999999", status: "done" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    expect(parsed.id).toBe("lsn-keep-123456");
    expect(parsed.status).toBe("done");
  });

  it("既存に id が無ければ id キーを書かない（採番はローダーの責務）", () => {
    const result = prepareLessonMetaWrite(
      tmpMetaPath(),
      REL,
      JSON.stringify({ id: "lsn-made-up-000000", status: "open" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.content)).not.toHaveProperty("id");
  });

  it("en_source_hash は agent の値を無視して既存値を保持する", () => {
    const metaPath = tmpMetaPath(
      JSON.stringify({ id: "lsn-keep-123456", en_source_hash: "sha256:abc" }),
    );
    const result = prepareLessonMetaWrite(
      metaPath,
      REL,
      JSON.stringify({ en_source_hash: "sha256:fff", status: "done" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    expect(parsed.en_source_hash).toBe("sha256:abc");
    expect(parsed.id).toBe("lsn-keep-123456");
  });

  it("既存に無い en_source_hash を agent は導入できない", () => {
    const result = prepareLessonMetaWrite(
      tmpMetaPath(JSON.stringify({ status: "open" })),
      REL,
      JSON.stringify({ en_source_hash: "sha256:fff", status: "done" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.content)).not.toHaveProperty("en_source_hash");
  });

  it("不正な slug を拒否する", () => {
    const result = prepareLessonMetaWrite(
      tmpMetaPath(),
      REL,
      JSON.stringify({ slug: "日本語スラッグ" }),
    );
    expect(result.ok).toBe(false);
  });
});
