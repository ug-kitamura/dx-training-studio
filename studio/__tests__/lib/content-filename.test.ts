import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "@/lib/content-filename";

describe("sanitizeFilename", () => {
  it("passes through normal strings", () => {
    expect(sanitizeFilename("Gitブランチ戦略")).toBe("Gitブランチ戦略");
  });

  it("replaces forbidden characters with underscore", () => {
    expect(sanitizeFilename("レッスン/テスト")).toBe("レッスン_テスト");
    expect(sanitizeFilename("a:b*c?d\"e<f>g|h")).toBe("a_b_c_d_e_f_g_h");
    expect(sanitizeFilename("a\\b")).toBe("a_b");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeFilename("  name  ")).toBe("name");
  });
});
