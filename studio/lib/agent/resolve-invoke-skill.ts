export const GENERAL_CHAT_SKILL_ID = "general-chat";

export function resolveInvokeSkillId(activeSkillId: string | null): string {
  return activeSkillId ?? GENERAL_CHAT_SKILL_ID;
}
