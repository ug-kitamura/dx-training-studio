import fs from "node:fs";
import path from "node:path";
import { getProjectRoot } from "@/lib/project-root";
import type { AgentChatStorage } from "@/lib/agent-chat-storage";
import { parseAgentChatStorage } from "@/lib/agent-chat-storage";

/**
 * Agent 会話の保存先。フォーカス階層によらず常にこの 1 本を読み書きする。
 *
 * `contents/`（教材の正本ツリー）ではなく作業ファイル側に置くのは、スキルの 1 実行が
 * 複数フォルダを横断して書くため——フォーカス先に会話を残すと、後からどこで話したかを
 * 探せない。教材ツリーの退避・リネームで会話が道連れになる問題も同時に消える。
 *
 * 全セッションが 1 ファイルに入るのは `AgentChatStorage` が元から複数セッション構造の
 * ため。保存のたびの全書き換えが重くなったら per-session 分割を検討する。
 */
export const AGENT_SESSION_DIR = "contents-work/sessions";
export const AGENT_SESSION_FILENAME = "agent-chat.json";
export const AGENT_SESSION_PATH = `${AGENT_SESSION_DIR}/${AGENT_SESSION_FILENAME}`;

export function isAgentSessionFsWritable(): boolean {
  return process.env.AGENT_SESSION_FS !== "disabled";
}

/** 保存先の絶対パス。 */
export function resolveAgentSessionPath(projectRoot: string): string {
  return path.resolve(projectRoot, AGENT_SESSION_PATH);
}

export function readAgentSessionFile(
  projectRoot: string = getProjectRoot(),
): AgentChatStorage | null {
  const sessionPath = resolveAgentSessionPath(projectRoot);
  if (!fs.existsSync(sessionPath)) return null;
  try {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    return parseAgentChatStorage(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeAgentSessionFile(
  storage: AgentChatStorage,
  projectRoot: string = getProjectRoot(),
): void {
  if (!isAgentSessionFsWritable()) {
    throw new Error("AGENT_SESSION_FS_DISABLED");
  }
  const sessionPath = resolveAgentSessionPath(projectRoot);
  const dir = path.dirname(sessionPath);
  // contents-work/ はアプリの作業データルートなので、無ければ作ってよい。
  // （コンテンツのディレクトリは session のためだけには作らない、という旧来の制約は
  //   保存先が contents/ から出たことで不要になった）
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(sessionPath, JSON.stringify(storage, null, 2), "utf-8");
}
