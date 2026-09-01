import { describe, expect, it } from "vitest";
import {
  filterBuiltinCommands,
  filterContentFiles,
  filterSkills,
  formatSkillCatalogMessage,
  orderSlashSuggestionItems,
} from "@/lib/agent-chat-suggestions";
import type { SkillSummary } from "@/lib/agent/skill-loader";

const skills: SkillSummary[] = [
  {
    id: "create-draft",
    name: "レッスン草稿作成",
    description: "レッスン本文の草稿を生成します",
  },
  {
    id: "create-structure",
    name: "構造設計",
    description: "シリーズ構成を設計します",
  },
];

describe("filterSkills", () => {
  it("matches skill id by substring", () => {
    expect(filterSkills(skills, "draft").map((skill) => skill.id)).toEqual([
      "create-draft",
    ]);
  });

  it("matches skill name by substring", () => {
    expect(filterSkills(skills, "構造").map((skill) => skill.id)).toEqual([
      "create-structure",
    ]);
  });

  it("keeps create-draft visible without skill-specific gate", () => {
    expect(filterSkills(skills, "").map((skill) => skill.id)).toEqual([
      "create-draft",
      "create-structure",
    ]);
  });

  it("preserves catalog order instead of re-sorting by id", () => {
    // カタログは host → ebex の区画順で届く。ここで id 順に並べ替えてはいけない。
    expect(
      filterSkills([skills[1], skills[0]], "").map((skill) => skill.id),
    ).toEqual(["create-structure", "create-draft"]);
  });

  it("excludes hidden skills", () => {
    expect(
      filterSkills(
        [
          ...skills,
          {
            id: "general-chat",
            name: "通常チャット",
            description: "hidden",
            hidden: true,
          },
        ],
        "",
      ).map((skill) => skill.id),
    ).toEqual(["create-draft", "create-structure"]);
  });
});

describe("filterContentFiles", () => {
  const files = [
    { path: "contents/a/intro/contents.md", name: "intro" },
    { path: "contents/b/lesson/contents.md", name: "lesson" },
  ];

  it("matches file path substring", () => {
    expect(filterContentFiles(files, "contents/b")).toHaveLength(1);
  });

  it("matches file name substring", () => {
    expect(filterContentFiles(files, "intro")).toHaveLength(1);
  });
});

describe("filterBuiltinCommands", () => {
  it("lists commands when query empty", () => {
    expect(filterBuiltinCommands("").map((command) => command.id)).toEqual([
      "clear",
      "export",
      "skill",
      "summary",
    ]);
  });

  it("filters commands by name substring", () => {
    expect(
      filterBuiltinCommands("export").map((command) => command.id),
    ).toEqual(["export"]);
  });

  it("filters skill builtin by id substring", () => {
    expect(filterBuiltinCommands("sk").map((command) => command.id)).toEqual([
      "skill",
    ]);
  });
});

describe("orderSlashSuggestionItems", () => {
  it("lists .claude/skills skills before builtin commands", () => {
    const ordered = orderSlashSuggestionItems(
      skills,
      filterBuiltinCommands(""),
    );
    expect(
      ordered.map((entry) =>
        entry.kind === "skill" ? entry.item.id : entry.item.id,
      ),
    ).toEqual([
      "create-draft",
      "create-structure",
      "clear",
      "export",
      "skill",
      "summary",
    ]);
    expect(ordered.slice(0, 2).every((entry) => entry.kind === "skill")).toBe(
      true,
    );
    expect(ordered.slice(2).every((entry) => entry.kind === "command")).toBe(
      true,
    );
  });
});

describe("formatSkillCatalogMessage", () => {
  it("formats visible skills as a bold-name markdown table", () => {
    const message = formatSkillCatalogMessage(skills);
    expect(message).toContain("使用可能なスキル");
    expect(message).toContain("| スキル | 説明 |");
    expect(message).toContain(
      "| **create-draft** | レッスン本文の草稿を生成します |",
    );
    expect(message).toContain(
      "| **create-structure** | シリーズ構成を設計します |",
    );
    expect(message).not.toContain("host");
    expect(message).not.toContain("ebex");
  });

  it("keeps multiline CRLF description on a single table row", () => {
    const message = formatSkillCatalogMessage([
      {
        id: "minutes-maid",
        name: "minutes-maid",
        description:
          "月例会議の音声文字起こしデータをもとに議事録を生成するスキル。\r\n「議事録を作って」「minutes」と依頼された際に使用する。",
      },
    ]);
    const rows = message.split("\n").filter((line) => line.startsWith("| **"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("minutes-maid");
    expect(rows[0]).not.toContain("/minutes-maid");
    expect(rows[0]).toContain("月例会議の音声文字起こし");
    expect(rows[0]).toContain("議事録を作って");
    expect(rows[0]).not.toMatch(/\r/);
  });

  it("reports when no skills are available", () => {
    expect(formatSkillCatalogMessage([])).toBe(
      "使用可能なスキルはありません。",
    );
  });
});
