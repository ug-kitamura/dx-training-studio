import type { ImageListScope } from "@/lib/image-list-client";
import type { WorkspaceSettings } from "@/lib/workspace-settings";
import type { ImageManagerTab } from "@/components/workspace/image-manager/types";

export function tabToScope(tab: ImageManagerTab): ImageListScope {
  switch (tab) {
    case "used":
      return "used";
    case "upload":
      return "uploaded";
    case "ai":
      return "ai";
    case "web":
      return "web";
  }
}

export function aiRequestHeaders(
  settings: WorkspaceSettings,
  includePixabay = false,
): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  headers["x-ai-model"] = settings.aiModel;
  if (settings.aiApiKey) headers["x-ai-api-key"] = settings.aiApiKey;
  if (includePixabay && settings.pixabayApiKey) {
    headers["x-pixabay-api-key"] = settings.pixabayApiKey;
  }
  return headers;
}
