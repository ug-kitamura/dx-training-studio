import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AGENT_SESSION_PATH,
  readAgentSessionFile,
  writeAgentSessionFile,
} from "@/lib/agent-session-store";
import { createInitialStorage } from "@/lib/agent-chat-storage";

describe("agent-session-store", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("会話を contents-work/sessions/agent-chat.json に書く", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    const storage = createInitialStorage();

    writeAgentSessionFile(storage, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, AGENT_SESSION_PATH))).toBe(true);
    expect(readAgentSessionFile(tmpDir)?.activeSessionId).toBe(
      storage.activeSessionId,
    );
  });

  it("保存先ディレクトリが無ければ作る", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    expect(fs.existsSync(path.join(tmpDir, "contents-work"))).toBe(false);

    writeAgentSessionFile(createInitialStorage(), tmpDir);

    expect(fs.existsSync(path.join(tmpDir, AGENT_SESSION_PATH))).toBe(true);
  });

  it("contents/ 配下には書かない（教材ツリーを汚さない）", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));

    writeAgentSessionFile(createInitialStorage(), tmpDir);

    expect(fs.existsSync(path.join(tmpDir, "contents"))).toBe(false);
  });

  it("書き込みは同じ 1 本を上書きし、履歴が分岐しない", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    const first = createInitialStorage();
    const second = createInitialStorage();

    writeAgentSessionFile(first, tmpDir);
    writeAgentSessionFile(second, tmpDir);

    expect(readAgentSessionFile(tmpDir)?.activeSessionId).toBe(
      second.activeSessionId,
    );
    expect(first.activeSessionId).not.toBe(second.activeSessionId);
  });

  it("保存先が無い場合の読み取りは null を返す", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    expect(readAgentSessionFile(tmpDir)).toBeNull();
  });

  it("壊れた JSON は null を返す（例外を投げない）", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    const target = path.join(tmpDir, AGENT_SESSION_PATH);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "{ broken", "utf-8");

    expect(readAgentSessionFile(tmpDir)).toBeNull();
  });
});
