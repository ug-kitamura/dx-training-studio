import { describe, expect, it } from "vitest";
import { isContextItemStale } from "@/lib/context-freshness";

describe("context-freshness", () => {
  it("treats null as stale", () => {
    expect(isContextItemStale(null)).toBe(true);
  });

  it("treats dates older than one year as stale", () => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 400);
    expect(isContextItemStale(staleDate.toISOString().slice(0, 10))).toBe(true);
  });

  it("treats recent dates as fresh", () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30);
    expect(isContextItemStale(recentDate.toISOString().slice(0, 10))).toBe(false);
  });
});
