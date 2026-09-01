import type { SkillSummary } from "@/lib/agent/skill-loader";

export type AgentFileOption = {
  path: string;
  name: string;
  relativePath?: string;
};

export type AgentBuiltinCommand = {
  id: "clear" | "export" | "skill" | "summary";
  name: string;
  description: string;
};

export const AGENT_BUILTIN_COMMANDS: AgentBuiltinCommand[] = [
  {
    id: "clear",
    name: "会話を削除",
    description: "現在のセッションを履歴から削除します",
  },
  {
    id: "export",
    name: "会話をエクスポート",
    description: "現在のセッションを Markdown でダウンロードします",
  },
  {
    id: "skill",
    name: "スキル一覧",
    description: "使用可能なスキルを一覧表示します",
  },
  {
    id: "summary",
    name: "会話を要約",
    description: "これまでの会話の要約を Markdown で表示します",
  },
];

/** /summary が通常送信経路へ流す固定の要約指示文 */
export const AGENT_SUMMARY_PROMPT = [
  "これまでのこのセッションの会話を要約してください。",
  "要約は Markdown 形式でチャットに表示するだけとし、ファイルへの書き込みやツールによる作成・編集は行わないでください。",
].join("\n");

export function formatSkillCatalogMessage(skills: SkillSummary[]): string {
  const visible = skills.filter((skill) => !skill.hidden);
  if (visible.length === 0) {
    return "使用可能なスキルはありません。";
  }
  const lines = ["使用可能なスキル", "", "| スキル | 説明 |", "| --- | --- |"];
  for (const skill of visible) {
    const name = escapeMarkdownTableCell(skill.id);
    const description = escapeMarkdownTableCell(
      skill.description || "(説明なし)",
    );
    lines.push(`| **${name}** | ${description} |`);
  }
  return lines.join("\n");
}

/** Markdown 表セル用。CRLF／改行／連続空白を畳み、セル割れを防ぐ。 */
export function escapeMarkdownTableCell(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, " ")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterBuiltinCommands(query: string): AgentBuiltinCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return AGENT_BUILTIN_COMMANDS;
  return AGENT_BUILTIN_COMMANDS.filter((command) => {
    const haystack =
      `${command.id} ${command.name} ${command.description}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function filterSkills(
  skills: SkillSummary[],
  query: string,
): SkillSummary[] {
  const normalized = query.trim().toLowerCase();
  // カタログの並び（host → ebex の区画順、区画内は id 昇順）をそのまま保つ。
  // ここで id 再ソートすると区画順が失われる。
  return skills.filter((skill) => {
    if (skill.hidden) return false;
    if (!normalized) return true;
    const haystack =
      `${skill.id} ${skill.name} ${skill.description}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function orderSlashSuggestionItems<
  TSkill extends { id: string },
  TCommand extends { id: string },
>(
  skills: TSkill[],
  commands: TCommand[],
): Array<
  { kind: "skill"; item: TSkill } | { kind: "command"; item: TCommand }
> {
  return [
    ...skills.map((item) => ({ kind: "skill" as const, item })),
    ...commands.map((item) => ({ kind: "command" as const, item })),
  ];
}

export function filterContentFiles(
  files: AgentFileOption[],
  query: string,
): AgentFileOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return files;
  return files.filter((file) => {
    const haystack = `${file.path} ${file.name}`.toLowerCase();
    return haystack.includes(normalized);
  });
}
