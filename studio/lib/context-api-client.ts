import { loadWorkspaceSettings, type ContextStorageMode } from "@/lib/workspace-settings";
import { DB_CONNECTION_ERROR_MESSAGE } from "@/lib/context-db/types";

export function getContextStorageMode(): ContextStorageMode {
  return loadWorkspaceSettings().contextStorage;
}

export async function checkContextDatabaseConnection(): Promise<boolean> {
  const res = await fetch("/api/context/db-check");
  return res.ok;
}

export { DB_CONNECTION_ERROR_MESSAGE as CONTEXT_DATABASE_CONNECTION_ERROR_MESSAGE };

export function withContextMode(url: string): string {
  const contextMode = getContextStorageMode();
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}contextMode=${encodeURIComponent(contextMode)}`;
}
