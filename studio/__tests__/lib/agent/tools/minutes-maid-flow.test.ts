import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executeRegisteredTool } from "@/lib/agent/tools/registry";
import {
  SCOPE,
  makeScope,
  makeScopeFile,
  scopeAbsolute,
  scopeDisplayPath,
} from "@/__tests__/helpers/work-scope-fixture";

/**
 * minutes-maid 相当の read → write フローを API なしで通し試験する。
 */
describe("minutes-maid-like file flow", () => {
  it("reads VTT and writes HTML output", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-minutes-"));
    makeScope(tmpDir);
    const vtt = [
      "WEBVTT",
      "",
      "00:00:01.000 --> 00:00:05.000",
      "議題: 月次定例",
    ].join("\n");
    makeScopeFile(tmpDir, "meeting.vtt", vtt);

    const context = {
      projectRoot: tmpDir,
      workScopeKey: SCOPE,
    };
    const readOutcome = await executeRegisteredTool(
      "read_file",
      { path: "meeting.vtt" },
      context,
    );
    expect(readOutcome.result).toMatchObject({
      path: scopeDisplayPath("meeting.vtt"),
      content: expect.stringContaining("WEBVTT"),
    });

    const html = "<!DOCTYPE html><html><body><h1>議事録</h1></body></html>";
    const writeOutcome = await executeRegisteredTool(
      "write_file",
      { path: "output/minutes.html", content: html },
      context,
    );
    expect(writeOutcome.result).toEqual({
      path: scopeDisplayPath("output/minutes.html"),
      bytes: Buffer.byteLength(html, "utf-8"),
    });

    const written = fs.readFileSync(
      path.join(scopeAbsolute(tmpDir), "output", "minutes.html"),
      "utf-8",
    );
    expect(written).toBe(html);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
