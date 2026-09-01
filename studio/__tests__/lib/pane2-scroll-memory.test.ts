import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPane2ScrollMemory,
  deleteLessonScrollMemory,
  getPane2ScrollTop,
  pane2ScrollFallbackKey,
  pane2ScrollKey,
  resolvePane2ScrollTop,
  setPane2ScrollTop,
} from "@/lib/pane2-scroll-memory";

beforeEach(() => {
  clearPane2ScrollMemory();
});

describe("pane2ScrollKey", () => {
  it("レッスン・言語・ビューの3つで分かれる", () => {
    const keys = new Set([
      pane2ScrollKey("lsn-a", "ja", "raw"),
      pane2ScrollKey("lsn-a", "en", "raw"),
      pane2ScrollKey("lsn-a", "ja", "inline"),
      pane2ScrollKey("lsn-b", "ja", "raw"),
    ]);
    expect(keys.size).toBe(4);
  });
});

describe("pane2ScrollFallbackKey", () => {
  it("言語だけを入れ替える", () => {
    expect(pane2ScrollFallbackKey(pane2ScrollKey("lsn-a", "ja", "raw"))).toBe(
      pane2ScrollKey("lsn-a", "en", "raw"),
    );
    expect(pane2ScrollFallbackKey(pane2ScrollKey("lsn-a", "en", "diff"))).toBe(
      pane2ScrollKey("lsn-a", "ja", "diff"),
    );
  });

  it("レッスン ID にコロンが含まれても壊れない", () => {
    // 英語本文のエディタは `${lesson.id}:en` を lessonId として使う場面がある
    const key = pane2ScrollKey("lsn-a:en", "en", "raw");
    expect(pane2ScrollFallbackKey(key)).toBe(
      pane2ScrollKey("lsn-a:en", "ja", "raw"),
    );
  });
});

describe("resolvePane2ScrollTop", () => {
  it("自分のキーがあればそれを返す", () => {
    const key = pane2ScrollKey("lsn-a", "en", "inline");
    setPane2ScrollTop(key, 320);
    expect(resolvePane2ScrollTop(key)).toBe(320);
  });

  it("自分のキーが無ければもう一方の言語の位置を借りる", () => {
    setPane2ScrollTop(pane2ScrollKey("lsn-a", "ja", "inline"), 150);
    expect(resolvePane2ScrollTop(pane2ScrollKey("lsn-a", "en", "inline"))).toBe(
      150,
    );
  });

  it("自分のキーがあれば、もう一方の言語より優先する", () => {
    setPane2ScrollTop(pane2ScrollKey("lsn-a", "ja", "inline"), 150);
    setPane2ScrollTop(pane2ScrollKey("lsn-a", "en", "inline"), 900);
    expect(resolvePane2ScrollTop(pane2ScrollKey("lsn-a", "en", "inline"))).toBe(
      900,
    );
  });

  it("ビューをまたいでは借りない", () => {
    setPane2ScrollTop(pane2ScrollKey("lsn-a", "ja", "raw"), 400);
    expect(resolvePane2ScrollTop(pane2ScrollKey("lsn-a", "en", "inline"))).toBe(
      0,
    );
  });

  it("どこにも無ければ先頭", () => {
    expect(resolvePane2ScrollTop(pane2ScrollKey("lsn-z", "ja", "raw"))).toBe(0);
  });
});

describe("deleteLessonScrollMemory", () => {
  it("そのレッスンの全言語・全ビューを捨て、他のレッスンは残す", () => {
    setPane2ScrollTop(pane2ScrollKey("lsn-a", "ja", "raw"), 10);
    setPane2ScrollTop(pane2ScrollKey("lsn-a", "en", "inline"), 20);
    setPane2ScrollTop(pane2ScrollKey("lsn-b", "ja", "raw"), 30);

    deleteLessonScrollMemory("lsn-a");

    expect(getPane2ScrollTop(pane2ScrollKey("lsn-a", "ja", "raw"))).toBeUndefined();
    expect(
      getPane2ScrollTop(pane2ScrollKey("lsn-a", "en", "inline")),
    ).toBeUndefined();
    expect(getPane2ScrollTop(pane2ScrollKey("lsn-b", "ja", "raw"))).toBe(30);
  });

  it("ID が前方一致する別レッスンを巻き込まない", () => {
    setPane2ScrollTop(pane2ScrollKey("lsn-a", "ja", "raw"), 10);
    setPane2ScrollTop(pane2ScrollKey("lsn-ab", "ja", "raw"), 20);

    deleteLessonScrollMemory("lsn-a");

    expect(getPane2ScrollTop(pane2ScrollKey("lsn-ab", "ja", "raw"))).toBe(20);
  });
});
