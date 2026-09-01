import { describe, expect, it } from "vitest";
import { parseJsonObject, stripCodeFences } from "@/lib/llm-response";

describe("stripCodeFences", () => {
  it("json タグつきフェンスを剥がす", () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("任意の言語タグを許容する", () => {
    expect(stripCodeFences("```html\n<div/>\n```")).toBe("<div/>");
  });

  it("タグ大文字（JSON）も剥がす", () => {
    expect(stripCodeFences('```JSON\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("タグなしフェンスを剥がす", () => {
    expect(stripCodeFences("```\ntext\n```")).toBe("text");
  });

  it("開きフェンス直後に改行がない単一行フェンスも剥がす", () => {
    expect(stripCodeFences('``` {"a":1} ```')).toBe('{"a":1}');
  });

  it("末尾改行なしの閉じフェンスも剥がす", () => {
    expect(stripCodeFences('```json\n{"a":1}```')).toBe('{"a":1}');
  });

  it("CRLF 改行でも剥がす", () => {
    expect(stripCodeFences('```json\r\n{"a":1}\r\n```')).toBe('{"a":1}');
  });

  it("フェンスなしは trim だけ", () => {
    expect(stripCodeFences('  {"a":1}  ')).toBe('{"a":1}');
  });

  it("本文中のフェンスは触らない（全体を包むフェンスだけが対象）", () => {
    const inner = "前置き\n```js\ncode\n```\n後書き";
    expect(stripCodeFences(inner)).toBe(inner);
  });
});

describe("parseJsonObject", () => {
  it("フェンスつき JSON オブジェクトをパースする", () => {
    expect(parseJsonObject('```json\n{"entry":"x"}\n```')).toEqual({
      entry: "x",
    });
  });

  it("素の JSON もパースする", () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("配列は null", () => {
    expect(parseJsonObject("[1,2]")).toBeNull();
  });

  it("壊れた JSON は null", () => {
    expect(parseJsonObject("{oops")).toBeNull();
  });

  it("プリミティブは null", () => {
    expect(parseJsonObject('"text"')).toBeNull();
  });
});
