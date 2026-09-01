import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  deriveDivertRelativePath,
  framedWriteDivertNotice,
  resolveFramedWriteTarget,
} from "@/lib/agent/tools/framed-write-guard";
import { SCOPE, makeScope } from "@/__tests__/helpers/work-scope-fixture";

const FOLDER_ID = SCOPE;

let tmpDir: string;
let projectDir: string;

function projectPath(relative: string): string {
  return path.resolve(projectDir, relative);
}

function writeProjectFile(relative: string, content: string): void {
  const absolute = projectPath(relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, "utf-8");
}

function resolveFor(relative: string) {
  return resolveFramedWriteTarget({
    absolutePath: projectPath(relative),
    relativePath: `contents/${FOLDER_ID}/${relative}`,
    workScopeKey: FOLDER_ID,
    projectRoot: tmpDir,
  });
}

const SINGLE_SECTION_FRAME = [
  "<html><head><script src=cdn></script></head><body>",
  "<!-- CONTENT_START -->",
  "",
  "<!-- CONTENT_END -->",
  "</body></html>",
].join("\n");

const MULTI_SECTION_FRAME = [
  "<html><body>",
  "<!-- AGENDA_LIST_START -->",
  "",
  "<!-- AGENDA_LIST_END -->",
  "<!-- AGENDA_DETAILS_START -->",
  "",
  "<!-- AGENDA_DETAILS_END -->",
  "<!-- ACTION_PLAN_START -->",
  "",
  "<!-- ACTION_PLAN_END -->",
  "<!-- PURPOSE_CONTRIBUTION_START -->",
  "",
  "<!-- PURPOSE_CONTRIBUTION_END -->",
  "</body></html>",
].join("\n");

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-framed-guard-"));
  makeScope(tmpDir);
  projectDir = path.resolve(tmpDir, "contents", ...FOLDER_ID.split("/"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveFramedWriteTarget", () => {
  it("diverts a write to a single-section frame", () => {
    writeProjectFile("output/company-profile.html", SINGLE_SECTION_FRAME);

    const decision = resolveFor("output/company-profile.html");

    expect(decision.kind).toBe("divert");
    if (decision.kind !== "divert") return;
    expect(decision.relativePath).toBe(
      `contents/${FOLDER_ID}/_work/output__company-profile.html`,
    );
    expect(decision.requested.relativePath).toBe(
      `contents/${FOLDER_ID}/output/company-profile.html`,
    );
    expect(decision.markerNames).toEqual(["CONTENT"]);
  });

  it("diverts regardless of how many sections the frame has", () => {
    writeProjectFile("output/minutes.html", MULTI_SECTION_FRAME);

    const decision = resolveFor("output/minutes.html");

    expect(decision.kind).toBe("divert");
    if (decision.kind !== "divert") return;
    expect(decision.markerNames).toEqual([
      "ACTION_PLAN",
      "AGENDA_DETAILS",
      "AGENDA_LIST",
      "PURPOSE_CONTRIBUTION",
    ]);
  });

  it("diverts even when every section is already filled", () => {
    writeProjectFile(
      "output/filled.html",
      SINGLE_SECTION_FRAME.replace(
        "<!-- CONTENT_START -->\n\n",
        "<!-- CONTENT_START -->\n<p>本文</p>\n",
      ),
    );

    expect(resolveFor("output/filled.html").kind).toBe("divert");
  });

  it("writes through when the existing file has no marker sections", () => {
    writeProjectFile("output/plain.html", "<html><body>本文</body></html>");

    const decision = resolveFor("output/plain.html");

    expect(decision.kind).toBe("write");
    expect(decision.relativePath).toBe(
      `contents/${FOLDER_ID}/output/plain.html`,
    );
  });

  it("writes through when the target does not exist yet", () => {
    const decision = resolveFor("output/new.html");

    expect(decision.kind).toBe("write");
    expect(decision.absolutePath).toBe(projectPath("output/new.html"));
  });

  it("writes through when the target is a directory", () => {
    fs.mkdirSync(projectPath("output"), { recursive: true });

    expect(resolveFor("output").kind).toBe("write");
  });

  it("writes through inside the intermediate file area even when markers exist", () => {
    writeProjectFile("_work/partial.html", SINGLE_SECTION_FRAME);

    const decision = resolveFor("_work/partial.html");

    expect(decision.kind).toBe("write");
    expect(decision.relativePath).toBe(
      `contents/${FOLDER_ID}/_work/partial.html`,
    );
  });

  it("returns the same divert target for the same requested path", () => {
    writeProjectFile("output/company-profile.html", SINGLE_SECTION_FRAME);

    const first = resolveFor("output/company-profile.html");
    const second = resolveFor("output/company-profile.html");

    expect(first).toEqual(second);
  });

  it("does not depend on the running skill or model", () => {
    writeProjectFile("output/a.html", SINGLE_SECTION_FRAME);
    writeProjectFile("nested/deep/b.html", SINGLE_SECTION_FRAME);

    // 同一内容・異なる位置でも、判定は内容の形だけで決まる
    expect(resolveFor("output/a.html").kind).toBe("divert");
    expect(resolveFor("nested/deep/b.html").kind).toBe("divert");
  });
});

describe("deriveDivertRelativePath", () => {
  it("flattens nested paths into a single file under the work dir", () => {
    expect(deriveDivertRelativePath("output/company-profile.html")).toBe(
      "_work/output__company-profile.html",
    );
    expect(deriveDivertRelativePath("a/b/c.md")).toBe("_work/a__b__c.md");
  });

  it("keeps project-root files as-is under the work dir", () => {
    expect(deriveDivertRelativePath("report.html")).toBe("_work/report.html");
  });
});

describe("framedWriteDivertNotice", () => {
  it("names the divert target and the next replace_between call", () => {
    writeProjectFile("output/company-profile.html", SINGLE_SECTION_FRAME);
    const decision = resolveFor("output/company-profile.html");
    if (decision.kind !== "divert") throw new Error("expected divert");

    const notice = framedWriteDivertNotice(decision);

    expect(notice).toContain("_work/output__company-profile.html");
    expect(notice).toContain("replace_between");
    expect(notice).toContain("<!-- CONTENT_START -->");
    expect(notice).toContain("<!-- CONTENT_END -->");
  });
});
