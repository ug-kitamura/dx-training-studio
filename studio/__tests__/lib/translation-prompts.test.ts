import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildBodyUserPrompt,
  buildChangelogSystemPrompt,
  buildMetaSystemPrompt,
  buildMetaUserPrompt,
  looksTruncated,
  META_TRANSLATABLE_FIELDS,
  parseBodyResponse,
  parseChangelogResponse,
  parseMetaResponse,
  readTranslationContract,
} from "@/lib/translation/prompts";

describe("readTranslationContract", () => {
  it("契約ファイルを読む", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "contract-"));
    fs.mkdirSync(path.join(root, "contracts"));
    fs.writeFileSync(
      path.join(root, "contracts", "translation-contract.md"),
      "# 契約\n規則\n",
      "utf-8",
    );
    expect(readTranslationContract(root)).toContain("# 契約");
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("無ければ null（黙って続行しない）", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "contract-none-"));
    expect(readTranslationContract(root)).toBeNull();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("実プロジェクトの契約が読める", () => {
    // 契約は入れ物直下（studio の親）に実在する
    const projectRoot = path.resolve(process.cwd(), "..");
    const contract = readTranslationContract(projectRoot);
    expect(contract).toContain("翻訳契約");
    expect(contract).toContain("author");
  });
});

describe("メタ翻訳のプロンプトとパース", () => {
  it("システムプロンプトに契約全文が入る", () => {
    const prompt = buildMetaSystemPrompt("<<CONTRACT-BODY>>");
    expect(prompt).toContain("<<CONTRACT-BODY>>");
    expect(prompt).toContain('"fields"');
  });

  it("ユーザープロンプトに日本語値と既訳が入る", () => {
    const prompt = buildMetaUserPrompt({
      level: "course",
      jaValues: [
        { jaLabel: "コース名 (フォルダ名)", enKey: "name_en", value: "Git の三大エリア" },
      ],
      existingEn: { name_en: "The Three Areas of Git" },
    });
    expect(prompt).toContain("Git の三大エリア");
    expect(prompt).toContain("The Three Areas of Git");
  });

  it("許可キーだけを受け入れる", () => {
    const allowed = META_TRANSLATABLE_FIELDS.course.map((f) => f.enKey);
    const parsed = parseMetaResponse(
      JSON.stringify({
        fields: { name_en: "A", target_en: "B", author_en: "評価しない", junk: "x" },
      }),
      allowed,
    );
    expect(parsed).toEqual({ fields: { name_en: "A", target_en: "B" } });
  });

  it("不正な JSON は null", () => {
    expect(parseMetaResponse("not json", ["name_en"])).toBeNull();
  });
});

describe("本文翻訳のプロンプトとパース", () => {
  it("既訳があればプロンプトに含まれる", () => {
    const prompt = buildBodyUserPrompt({
      jaBody: "# 見出し\n",
      existingEnBody: "# Heading\n",
    });
    expect(prompt).toContain("既存の英訳");
    expect(prompt).toContain("# Heading");
  });

  it("コードフェンス付き応答も剥がして読む", () => {
    const text = '```json\n{"body": "# Heading\\n"}\n```';
    expect(parseBodyResponse(text)).toEqual({ body: "# Heading\n" });
  });

  it("looksTruncated: 見出しが半分未満なら疑う", () => {
    const ja = "# A\n\n## B\n\n## C\n\n## D\n";
    expect(looksTruncated(ja, "# A\n")).toBe(true);
    expect(looksTruncated(ja, "# A\n\n## B\n\n## C\n\n## D\n")).toBe(false);
    expect(looksTruncated("見出しなし\n", "no headings\n")).toBe(false);
  });
});

describe("changelog 追訳のパース", () => {
  it("entries / full を判別する", () => {
    expect(parseChangelogResponse('{"entries": "## 2026-08-21\\n- Added\\n"}')).toEqual({
      kind: "entries",
      text: "## 2026-08-21\n- Added\n",
    });
    expect(parseChangelogResponse('{"full": "# Changelog\\n"}')).toEqual({
      kind: "full",
      text: "# Changelog\n",
    });
    expect(parseChangelogResponse("{}")).toBeNull();
  });

  it("システムプロンプトが既存エントリ不可侵を明言する", () => {
    const prompt = buildChangelogSystemPrompt("契約");
    expect(prompt).toContain("既存エントリを訳し直してはならない");
  });
});
