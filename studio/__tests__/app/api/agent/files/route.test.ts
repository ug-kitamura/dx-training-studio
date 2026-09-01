import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let projectRoot = "";

vi.mock("@/lib/project-root", () => ({
  getProjectRoot: () => projectRoot,
}));

import { GET } from "@/app/api/agent/files/route";

const SCOPE = "シリーズA/コースB/レッスンC";
const LESSON_CONTENTS = `contents/${SCOPE}/contents.md`;

function writeFile(relative: string, content: string) {
  const absolute = path.join(projectRoot, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, "utf-8");
}

async function listFiles(params: Record<string, string>): Promise<string[]> {
  const query = new URLSearchParams(params).toString();
  const res = await GET(new Request(`http://localhost/api/agent/files?${query}`));
  const data = (await res.json()) as { files: Array<{ path: string }> };
  return data.files.map((file) => file.path);
}

describe("GET /api/agent/files", () => {
  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-files-route-"));
    writeFile("contents/シリーズA/コースA1/レッスンZ/contents.md", "# Z");
    writeFile(LESSON_CONTENTS, "# C");
    writeFile("contents-work/plans/20260811-onenote.md", "# plan");
    writeFile("contents-work/runs/20260811-run/design-note.md", "# note");
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it("offers lesson bodies, plans and recent runs", async () => {
    const files = await listFiles({ scope: SCOPE });
    expect(files).toContain(LESSON_CONTENTS);
    expect(files).toContain("contents-work/plans/20260811-onenote.md");
    expect(files).toContain("contents-work/runs/20260811-run/design-note.md");
  });

  it("puts the open lesson body first when focused on a lesson", async () => {
    const files = await listFiles({ scope: SCOPE, current: LESSON_CONTENTS });
    expect(files[0]).toBe(LESSON_CONTENTS);
  });

  it("does not pin a lesson body when focused above the lesson level", async () => {
    const files = await listFiles({
      scope: "シリーズA/コースB",
      current: LESSON_CONTENTS,
    });
    expect(files[0]).not.toBe(LESSON_CONTENTS);
  });
});
