import { describe, expect, it, vi, afterEach } from "vitest";
import {
  awaitToolConfirmDecision,
  resolveToolConfirmDecision,
} from "@/lib/agent/tools/tool-confirm-registry";

describe("tool-confirm-registry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves approve decision", async () => {
    const pending = awaitToolConfirmDecision("tool-1");
    expect(resolveToolConfirmDecision("tool-1", "approve")).toBe(true);
    await expect(pending).resolves.toEqual({ decision: "approve" });
  });

  it("resolves reject decision", async () => {
    const pending = awaitToolConfirmDecision("tool-2");
    expect(resolveToolConfirmDecision("tool-2", "reject")).toBe(true);
    await expect(pending).resolves.toEqual({ decision: "reject" });
  });

  it("carries the manual search text payload on approve", async () => {
    const pending = awaitToolConfirmDecision("tool-manual");
    expect(
      resolveToolConfirmDecision(
        "tool-manual",
        "approve",
        "結果A https://example.com",
      ),
    ).toBe(true);
    await expect(pending).resolves.toEqual({
      decision: "approve",
      manualSearchText: "結果A https://example.com",
    });
  });

  it("returns false for unknown toolUseId", () => {
    expect(resolveToolConfirmDecision("missing", "approve")).toBe(false);
  });

  it("resolves as timeout after TTL", async () => {
    vi.useFakeTimers();
    const pending = awaitToolConfirmDecision("tool-ttl", 1000);
    vi.advanceTimersByTime(1001);
    await expect(pending).resolves.toEqual({ decision: "timeout" });
    expect(resolveToolConfirmDecision("tool-ttl", "approve")).toBe(false);
  });

  it("resolves as reject when the signal aborts while pending", async () => {
    const controller = new AbortController();
    const pending = awaitToolConfirmDecision(
      "tool-abort",
      5 * 60 * 1000,
      controller.signal,
    );
    controller.abort();
    await expect(pending).resolves.toEqual({ decision: "reject" });
    // abort 後は保留が消えているため、後続の解決要求は届かない
    expect(resolveToolConfirmDecision("tool-abort", "approve")).toBe(false);
  });

  it("resolves immediately as reject when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const pending = awaitToolConfirmDecision(
      "tool-preaborted",
      5 * 60 * 1000,
      controller.signal,
    );
    await expect(pending).resolves.toEqual({ decision: "reject" });
  });
});
