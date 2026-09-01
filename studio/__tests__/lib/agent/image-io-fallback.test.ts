import { describe, expect, it } from "vitest";
import { skillMentionsImageIO } from "@/lib/agent/image-io-fallback";

describe("skillMentionsImageIO", () => {
  it("detects Japanese image generation wording", () => {
    expect(skillMentionsImageIO("Step2: 画像を生成してスライドに貼る")).toBe(
      true,
    );
  });

  it("detects Japanese image reading wording", () => {
    expect(
      skillMentionsImageIO("アップロードされた画像を読み取り要約する"),
    ).toBe(true);
  });

  it("detects English image generation wording", () => {
    expect(skillMentionsImageIO("Use the API to generate an image")).toBe(true);
  });

  it("ignores skills without image instructions", () => {
    expect(skillMentionsImageIO("Markdown を読み込み議事録を作成する")).toBe(
      false,
    );
  });
});
