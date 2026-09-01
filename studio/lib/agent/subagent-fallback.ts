/** スキル本文に含まれる場合、このワークスペースはサブエージェント非対応としてフォールバックする */
export const SUBAGENT_KEYWORD = "サブエージェント";

export const SUBAGENT_FALLBACK_USER_MESSAGE =
  "このワークスペースは真のサブエージェントには対応していません。当該の役割は、親の会話とは独立した文脈で実行するツールで代替します。";

export const SUBAGENT_FALLBACK_MODEL_HINT =
  "このワークスペースは真のサブエージェントを起動できない。指示にあっても spawn せず、`run_isolated_task` ツールを使って当該の役割を独立した文脈で実行すること。";

export function skillMentionsSubagent(text: string): boolean {
  return text.includes(SUBAGENT_KEYWORD);
}

export function isLikelySubagentToolName(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.includes("subagent")) return true;
  if (lower === "task") return true;
  if (lower.startsWith("task_")) return true;
  return false;
}
