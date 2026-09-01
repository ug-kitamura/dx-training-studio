import { describe, expect, it } from "vitest";
import {
  bodyFreshness,
  changelogFreshness,
  computeBodySourceHash,
  computeMetaSourceHash,
  EN_FIELDS,
  firstChangelogEntryDate,
  formatSourceHashComment,
  hasAnyEnValue,
  isBodyUntranslated,
  isChangelogUntranslated,
  listMissingEnFields,
  metaFreshness,
  parseEnBody,
  translatedEnKeys,
} from "@/lib/translation/freshness";

describe("computeBodySourceHash", () => {
  it("CRLF と LF で同一ハッシュになる", () => {
    expect(computeBodySourceHash("# 見出し\r\n本文\r\n")).toBe(
      computeBodySourceHash("# 見出し\n本文\n"),
    );
  });

  it("内容が変わればハッシュが変わる", () => {
    expect(computeBodySourceHash("a")).not.toBe(computeBodySourceHash("b"));
  });

  it("sha256:<hex 64桁> 形式を返す", () => {
    expect(computeBodySourceHash("x")).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("parseEnBody / formatSourceHashComment", () => {
  it("1行目のハッシュコメントを解析し本文から剥がす", () => {
    const hash = computeBodySourceHash("原文");
    const en = `${formatSourceHashComment(hash)}\n\n# Title\n\nBody\n`;
    const parsed = parseEnBody(en);
    expect(parsed.sourceHash).toBe(hash);
    expect(parsed.body).toBe("# Title\n\nBody\n");
  });

  it("ハッシュコメントが無ければ本文そのまま", () => {
    const parsed = parseEnBody("# Title\n");
    expect(parsed.sourceHash).toBeNull();
    expect(parsed.body).toBe("# Title\n");
  });

  it("2行目以降のコメントは拾わない", () => {
    const hash = computeBodySourceHash("原文");
    const parsed = parseEnBody(`# Title\n${formatSourceHashComment(hash)}\n`);
    expect(parsed.sourceHash).toBeNull();
  });
});

describe("bodyFreshness", () => {
  const ja = "# 見出し\n\n本文です。\n";

  it("contents.en.md 不在は untranslated", () => {
    expect(bodyFreshness(ja, null)).toBe("untranslated");
  });

  it("ハッシュ一致は fresh", () => {
    const en = `${formatSourceHashComment(computeBodySourceHash(ja))}\n# Heading\n`;
    expect(bodyFreshness(ja, en)).toBe("fresh");
  });

  it("原文が進んだら stale", () => {
    const en = `${formatSourceHashComment(computeBodySourceHash(ja))}\n# Heading\n`;
    expect(bodyFreshness(`${ja}追記\n`, en)).toBe("stale");
  });

  it("ハッシュ未記録は stale（鮮度不明は古い扱い）", () => {
    expect(bodyFreshness(ja, "# Heading\n")).toBe("stale");
  });

  it("原文の改行コードが変わっただけでは stale にならない", () => {
    const en = `${formatSourceHashComment(computeBodySourceHash(ja))}\n# Heading\n`;
    expect(bodyFreshness(ja.replace(/\n/g, "\r\n"), en)).toBe("fresh");
  });
});

describe("computeMetaSourceHash / metaFreshness", () => {
  const course = {
    level: "course" as const,
    name: "Git の三大エリア",
    catch: "キャッチ",
    description: "説明",
    target: "Git 未経験者",
  };

  it("target の変更で stale になる", () => {
    const hash = computeMetaSourceHash(course);
    expect(
      metaFreshness({ ...course, target: "変更後" }, true, hash),
    ).toBe("stale");
  });

  it("フォルダ名（name）の変更で stale になる", () => {
    const hash = computeMetaSourceHash(course);
    expect(metaFreshness({ ...course, name: "改名後" }, true, hash)).toBe(
      "stale",
    );
  });

  it("一致すれば fresh", () => {
    expect(metaFreshness(course, true, computeMetaSourceHash(course))).toBe(
      "fresh",
    );
  });

  it("_en が全て空なら untranslated", () => {
    expect(metaFreshness(course, false, null)).toBe("untranslated");
  });

  it("_en があるのにハッシュ未記録は stale", () => {
    expect(metaFreshness(course, true, null)).toBe("stale");
  });

  it("区切りの曖昧さがない（フィールド跨ぎの改行で衝突しない）", () => {
    const a = computeMetaSourceHash({
      level: "lesson",
      name: "a\nb",
      description: "",
      author: "",
    });
    const b = computeMetaSourceHash({
      level: "lesson",
      name: "a",
      description: "b",
      author: "",
    });
    expect(a).not.toBe(b);
  });

  it("レッスンのハッシュは name と description だけを見る（author を変えても不変）", () => {
    const base = computeMetaSourceHash({
      level: "lesson",
      name: "L01",
      description: "desc",
      author: "北村",
    });
    expect(
      computeMetaSourceHash({
        level: "lesson",
        name: "L01",
        description: "desc",
        author: "Andreas",
      }),
    ).toBe(base);
  });
});

describe("changelogFreshness", () => {
  const ja = "# 変更履歴\n\n## 2026-08-21\n\n- 追加\n\n## 2026-08-15\n\n- 初版\n";

  it("changelog.en.md 不在は untranslated", () => {
    expect(changelogFreshness(ja, null)).toBe("untranslated");
  });

  it("英語側の先頭日付が古ければ stale", () => {
    const en = "# Changelog\n\n## 2026-08-15\n\n- First\n";
    expect(changelogFreshness(ja, en)).toBe("stale");
  });

  it("先頭日付が同じなら fresh", () => {
    const en = "# Changelog\n\n## 2026-08-21\n\n- Added\n";
    expect(changelogFreshness(ja, en)).toBe("fresh");
  });

  it("英語側に日付見出しが無ければ stale", () => {
    expect(changelogFreshness(ja, "# Changelog\n")).toBe("stale");
  });

  it("日本語側が空（日付なし）なら fresh 扱い", () => {
    expect(changelogFreshness("# 変更履歴\n", "# Changelog\n")).toBe("fresh");
  });

  it("先頭エントリ日付の抽出", () => {
    expect(firstChangelogEntryDate(ja)).toBe("2026-08-21");
    expect(firstChangelogEntryDate("本文だけ")).toBeNull();
  });
});

describe("listMissingEnFields / hasAnyEnValue", () => {
  const courseFields = {
    level: "course",
    name: "Git概念コース",
    catch: "地図を手に入れる",
    description: "Git の考え方を掴む",
    target: "Git を入れたが打ったことがない人",
  } as const;

  it("部分的に埋まったメタの欠落を列挙する", () => {
    expect(
      listMissingEnFields(courseFields, {
        name_en: "Git Concepts",
        description_en: "Grasp how Git thinks",
      }),
    ).toEqual(["catch_en", "target_en"]);
  });

  it("全部埋まっていれば空", () => {
    expect(
      listMissingEnFields(courseFields, {
        name_en: "Git Concepts",
        catch_en: "Get the map",
        description_en: "Grasp how Git thinks",
        target_en: "People who installed Git",
      }),
    ).toEqual([]);
  });

  it("空白だけの値は未記入として扱う", () => {
    expect(
      listMissingEnFields(
        {
          level: "lesson",
          name: "最初のコミット",
          description: "add と commit",
          author: "",
        },
        { name_en: "   ", description_en: "add and commit" },
      ),
    ).toEqual(["name_en"]);
  });

  it("原文が空のフィールドは欠落に数えない", () => {
    // ⚠ 訳しようがないものを欠落にすると、未完成の日本語メタを誤検出する
    expect(
      listMissingEnFields(
        { level: "series", name: "Git基礎シリーズ", catch: "", description: "土台" },
        { name_en: "Git Basics" },
      ),
    ).toEqual(["description_en"]);
  });

  it("author_en は翻訳の対象外だが欠落には数える", () => {
    // ⚠ 非対称: 翻訳ボタンは触らない（人名を機械に訳させると Andreas → Andrew の
    // ような、もっともらしく誤った綴りが入る）が、空欄のままだと入れ忘れと
    // 区別できないので赤字の材料にはする
    expect(translatedEnKeys("lesson")).not.toContain("author_en");
    expect(
      listMissingEnFields(
        {
          level: "lesson",
          name: "最初のコミット",
          description: "add と commit",
          author: "北村",
        },
        { name_en: "First commit", description_en: "add and commit" },
      ),
    ).toEqual(["author_en"]);
  });

  it("author が空なら author_en の欠落は数えない", () => {
    expect(
      listMissingEnFields(
        {
          level: "lesson",
          name: "最初のコミット",
          description: "add と commit",
          author: "",
        },
        { name_en: "First commit", description_en: "add and commit" },
      ),
    ).toEqual([]);
  });

  it("author_en は「英訳あり」に数えない（鮮度3状態を濁さない）", () => {
    expect(hasAnyEnValue("lesson", { author_en: "Kitamura" })).toBe(false);
    expect(hasAnyEnValue("lesson", { name_en: "First commit" })).toBe(true);
  });

  it("キーが無い場合と空文字の場合を区別しない", () => {
    const fields = {
      level: "lesson",
      name: "最初のコミット",
      description: "add と commit",
      author: "北村",
    } as const;
    expect(listMissingEnFields(fields, {})).toEqual(
      listMissingEnFields(fields, {
        name_en: "",
        description_en: "",
        author_en: "",
      }),
    );
  });

  it("欠落があっても鮮度判定は変わらない（独立した軸）", () => {
    const stored = computeMetaSourceHash(courseFields);
    const partial = { name_en: "Git Concepts" };
    expect(metaFreshness(courseFields, hasAnyEnValue("course", partial), stored)).toBe(
      "fresh",
    );
    expect(listMissingEnFields(courseFields, partial)).toEqual([
      "catch_en",
      "description_en",
      "target_en",
    ]);
  });

  it("hasAnyEnValue は1つでも非空なら真", () => {
    expect(hasAnyEnValue("course", { target_en: "x" })).toBe(true);
    expect(hasAnyEnValue("course", { name_en: "  " })).toBe(false);
    expect(hasAnyEnValue("course", {})).toBe(false);
  });

  it("翻訳対象キーの並びは階層ごとの原文順と対応する", () => {
    // ⚠ この並びがそのままハッシュの入力配列。入れ替えると既存の
    // en_source_hash が全部不一致になり、翻訳済みユニットが一斉に stale へ落ちる
    expect(translatedEnKeys("root")).toEqual(["name_en", "description_en"]);
    expect(translatedEnKeys("series")).toEqual([
      "name_en",
      "catch_en",
      "description_en",
    ]);
    expect(translatedEnKeys("course")).toEqual([
      "name_en",
      "catch_en",
      "description_en",
      "target_en",
    ]);
    expect(translatedEnKeys("lesson")).toEqual(["name_en", "description_en"]);
  });

  it("欠落判定は翻訳対象より広い（レッスンだけ author_en が増える）", () => {
    expect(EN_FIELDS.lesson.map((f) => f.enKey)).toEqual([
      "name_en",
      "description_en",
      "author_en",
    ]);
  });
});

describe("メタ原文ハッシュの固定値", () => {
  /**
   * ⚠ **この値を書き換えてはならない。**
   *
   * 正本 `contents/` には `en_source_hash` を持つ `.meta.json` が多数あり、
   * ハッシュの入力（対象フィールドとその並び）を変えると全部が不一致になって
   * 翻訳済みユニットが一斉に「翻訳が古い」へ落ちる。落ちたぶんは翻訳し直し＝
   * 既存の英訳を全フィールド再生成してレビューし直すことになる。
   *
   * ここが落ちたら、直すのはこの期待値ではなく実装のほう。値を変えてよいのは
   * 「既存の英訳をすべて作り直す」と決めた change のときだけ。
   */
  it("階層ごとの入力に対して既知のハッシュを返す", () => {
    expect(
      computeMetaSourceHash({
        level: "root",
        name: "DX Training Mandala",
        description: "全体の説明",
      }),
    ).toBe(
      "sha256:9bee5e2b1aab1f5fd2f636bb61faf278176855af26ac6fc7552e81eb135abd36",
    );
    expect(
      computeMetaSourceHash({
        level: "series",
        name: "Git基礎シリーズ",
        catch: "セーブポイントのある開発へ",
        description: "シリーズの説明",
      }),
    ).toBe(
      "sha256:b115e698e9a8fd03680dca0e4514b35ea1cab1747a2814cf51e219c4725fd00c",
    );
    expect(
      computeMetaSourceHash({
        level: "course",
        name: "Git概念コース",
        catch: "道具の前に地図を",
        description: "コースの説明",
        target: "Git未経験の開発者",
      }),
    ).toBe(
      "sha256:90c89b67f2c03c8f156f48263f38cc2d42ec85ab7d71ead1673a1ff378e45d9a",
    );
    expect(
      computeMetaSourceHash({
        level: "lesson",
        name: "最初のコミット",
        description: "レッスンの説明",
        author: "北村",
      }),
    ).toBe(
      "sha256:d4e987d053dd2a220712cc103b37143b5ccb94efb7537a0b84c1d0aac91eb630",
    );
  });
});

describe("isBodyUntranslated", () => {
  const ja = "# 見出し\n本文\n";

  it("contents.en.md が無ければ未翻訳", () => {
    expect(isBodyUntranslated(ja, null)).toBe(true);
  });

  it("空・空白だけなら未翻訳", () => {
    expect(isBodyUntranslated(ja, "")).toBe(true);
    expect(isBodyUntranslated(ja, "  \n\n ")).toBe(true);
  });

  it("ハッシュ行だけなら未翻訳", () => {
    expect(
      isBodyUntranslated(ja, `${formatSourceHashComment(computeBodySourceHash(ja))}\n`),
    ).toBe(true);
  });

  it("本文があれば未翻訳ではない", () => {
    expect(isBodyUntranslated(ja, "# Heading\nBody\n")).toBe(false);
  });

  it("日本語本文が空なら対象外（書きかけを責めない）", () => {
    expect(isBodyUntranslated("", null)).toBe(false);
    expect(isBodyUntranslated("   \n", null)).toBe(false);
  });
});

describe("isChangelogUntranslated", () => {
  const ja = "# 変更履歴\n\n## 2026-08-21\n\n- 追加\n";

  it("changelog.en.md が無ければ未翻訳", () => {
    expect(isChangelogUntranslated(ja, null)).toBe(true);
  });

  it("空白だけなら未翻訳", () => {
    expect(isChangelogUntranslated(ja, "  \n")).toBe(true);
  });

  it("中身があれば未翻訳ではない", () => {
    expect(isChangelogUntranslated(ja, "# Changelog\n\n## 2026-08-21\n")).toBe(
      false,
    );
  });

  it("日本語側にエントリが無ければ対象外", () => {
    expect(isChangelogUntranslated("# 変更履歴\n", null)).toBe(false);
    expect(isChangelogUntranslated(null, null)).toBe(false);
  });
});
